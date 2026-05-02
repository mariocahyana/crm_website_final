'use strict';

import { Op } from 'sequelize';
import { sequelize, Employee, Reimbursement, LeaveRequest, LeaveType, Attendance, Payslip, PayrollItem, PayrollPeriod } from '../models/index';
import { NotFoundError, ValidationError } from '../utils/errors';

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // last day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function countWorkingDays(start: Date, end: Date) {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1; // Mon-Fri
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function normalizeDate(value: Date | string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function overlapInclusiveDays(aStart: Date | string, aEnd: Date | string, bStart: Date, bEnd: Date) {
  const start = normalizeDate(aStart);
  const end = normalizeDate(aEnd);
  const overlapStart = start > bStart ? start : bStart;
  const overlapEnd = end < bEnd ? end : bEnd;
  if (overlapEnd < overlapStart) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / msPerDay) + 1;
}

function summarizePayrollItems(items: any[]) {
  return items.reduce((acc, item) => {
    const amount = Number(item.amount || 0);
    if (item.type === 'incentive' || item.type === 'bonus') acc.totalIncentive += amount;
    if (item.type === 'penalty') acc.totalPenalty += amount;
    if (item.type === 'reimburse') acc.totalReimburse += amount;
    if (item.type === 'bonus') acc.totalBonus += amount;
    return acc;
  }, {
    totalIncentive: 0,
    totalPenalty: 0,
    totalReimburse: 0,
    totalBonus: 0,
  });
}

class PayrollService {
  static async listPeriods() {
    return PayrollPeriod.findAll({
      order: [['year', 'DESC'], ['month', 'DESC'], ['created_at', 'DESC']],
    });
  }

  static async createPeriod(input: { month: number; year: number; actorId: string }) {
    const month = Number(input.month);
    const year = Number(input.year);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new ValidationError('month harus antara 1 sampai 12');
    }

    if (!Number.isInteger(year) || year < 2000) {
      throw new ValidationError('year tidak valid');
    }

    const existing = await PayrollPeriod.findOne({ where: { month, year } });
    if (existing) {
      throw new ValidationError('Payroll period untuk bulan dan tahun tersebut sudah ada');
    }

    return PayrollPeriod.create({
      month,
      year,
      status: 'draft',
      created_by: input.actorId,
    });
  }

  static async previewPeriod(periodId: string) {
    const period: any = await PayrollPeriod.findByPk(periodId, { raw: true });
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');

    const { start, end } = monthRange(period.year, period.month);
    const workingDays = Math.max(1, countWorkingDays(start, end));

    // fetch employees active
    const employees = (await Employee.findAll({ where: { is_active: true }, raw: true })) as any[];

    const results: any[] = [];

    for (const emp of employees) {
      const baseSalary = Number(emp.base_salary || 0);

      // reimbursements: approved and unprocessed within period
      const reimbursements = (await Reimbursement.scope('unprocessed').findAll({
        where: {
          employee_id: emp.id,
          expense_date: { [Op.between]: [start, end] },
        },
        raw: true,
      })) as any[];

      const totalReimburse = reimbursements.reduce((s: number, r: any) => s + Number(r.amount), 0);

      // unpaid leaves: approved leave requests where leave type is unpaid
      const leaveRequests = await LeaveRequest.findAll({
        where: {
          employee_id: emp.id,
          status: 'approved',
          start_date: { [Op.lte]: end },
          end_date: { [Op.gte]: start },
        },
        include: [{ model: LeaveType, as: 'leaveType' }],
      });

      let unpaidDays = 0;
      for (const lr of leaveRequests as any[]) {
        const lt = lr.getDataValue ? lr.getDataValue('leaveType') : lr.leaveType;
        if (lt && lt.is_paid === false) {
          const days = overlapInclusiveDays(lr.start_date, lr.end_date, start, end);
          unpaidDays += Math.max(0, days);
        }
      }

      const perDay = baseSalary / workingDays;
      const unpaidPenalty = unpaidDays * perDay;

      // late penalty: sum late_minutes in attendance
      const attendances = (await Attendance.findAll({
        where: {
          employee_id: emp.id,
          status: 'late',
          date: { [Op.between]: [start, end] },
        },
        raw: true,
      })) as any[];
      const totalLateMinutes = (attendances || []).reduce((s: number, a: any) => s + Number(a.late_minutes || 0), 0);
      const latePenalty = totalLateMinutes * 10000;

      const totalPenalty = unpaidPenalty + latePenalty;

      const totalIncentive = 0; // manual incentives not included in preview

      const net = baseSalary + totalIncentive + totalReimburse - totalPenalty;

      results.push({
        employee: emp,
        baseSalary,
        total_incentive: totalIncentive,
        total_reimburse: totalReimburse,
        unpaid_days: unpaidDays,
        unpaid_penalty: unpaidPenalty,
        total_late_minutes: totalLateMinutes,
        late_penalty: latePenalty,
        late_rate_per_minute: 10000,
        total_penalty: totalPenalty,
        net_salary: net,
      });
    }

    return { period, workingDays, results };
  }

  static async generatePeriod(periodId: string, actorId: string) {
    const period: any = await PayrollPeriod.findByPk(periodId, { raw: true });
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');

    if (period.status === 'paid') {
      throw new ValidationError('Payroll period yang sudah paid tidak bisa digenerate ulang');
    }

    const { start, end } = monthRange(period.year, period.month);
    const workingDays = Math.max(1, countWorkingDays(start, end));

    return await sequelize.transaction(async (t: any) => {
      const existingPayslipsCount = await Payslip.count({ where: { period_id: periodId }, transaction: t });
      if (existingPayslipsCount > 0) {
        throw new ValidationError('Payslip untuk period ini sudah pernah digenerate');
      }

      const employees = (await Employee.findAll({ where: { is_active: true }, raw: true, transaction: t })) as any[];
      const createdPayslips: any[] = [];

      for (const emp of employees) {
        const baseSalary = Number(emp.base_salary || 0);

        // reimbursements
        const reimbursements = await Reimbursement.scope('unprocessed').findAll({
          where: {
            employee_id: emp.id,
            expense_date: { [Op.between]: [start, end] },
          },
          transaction: t,
        });

        const totalReimburse = reimbursements.reduce((s: number, r: any) => s + Number(r.amount), 0);

        // unpaid leaves
        const leaveRequests = await LeaveRequest.findAll({
          where: {
            employee_id: emp.id,
            status: 'approved',
            start_date: { [Op.lte]: end },
            end_date: { [Op.gte]: start },
          },
          include: [{ model: LeaveType, as: 'leaveType' }],
          transaction: t,
        });

        let unpaidDays = 0;
        for (const lr of leaveRequests as any[]) {
          const lt = lr.getDataValue ? lr.getDataValue('leaveType') : lr.leaveType;
          if (lt && lt.is_paid === false) {
            const days = overlapInclusiveDays(lr.start_date, lr.end_date, start, end);
            unpaidDays += Math.max(0, days);
          }
        }

        const perDay = baseSalary / workingDays;
        const unpaidPenalty = unpaidDays * perDay;

        // late
        const attendances = await Attendance.findAll({
          where: {
            employee_id: emp.id,
            status: 'late',
            date: { [Op.between]: [start, end] },
          },
          transaction: t,
        });
        const totalLateMinutes = (attendances || []).reduce((s: number, a: any) => s + Number(a.late_minutes || 0), 0);
        const latePenalty = totalLateMinutes * 10000;

        const totalPenalty = unpaidPenalty + latePenalty;

        const totalIncentive = 0;

        const net = baseSalary + totalIncentive + totalReimburse - totalPenalty;

        // create payslip
        const payslip = await Payslip.create({
          employee_id: emp.id,
          period_id: periodId,
          base_salary: baseSalary,
          total_incentive: totalIncentive,
          total_penalty: totalPenalty,
          total_bonus: 0,
          total_reimburse: totalReimburse,
          net_salary: net,
        }, { transaction: t });

        // create payroll items for reimbursements
        for (const r of reimbursements as any[]) {
          const item = await PayrollItem.create({
            payslip_id: payslip.getDataValue('id'),
            type: 'reimburse',
            source: 'auto_reimburse',
            amount: r.amount,
            description: `Auto reimburse: ${r.category}`,
            ref_id: r.id,
            ref_type: 'Reimbursement',
            created_by: actorId,
          }, { transaction: t });

          // mark reimbursement processed
          try {
            await r.update({ payroll_item_id: item.getDataValue('id') }, { transaction: t });
          } catch {}
        }

        // create payroll items for unpaid leave (per leave request)
        for (const lr of leaveRequests as any[]) {
          const lt = lr.getDataValue ? lr.getDataValue('leaveType') : lr.leaveType;
          if (lt && lt.is_paid === false) {
            const days = overlapInclusiveDays(lr.start_date, lr.end_date, start, end);
            const amount = days * perDay;
            await PayrollItem.create({
              payslip_id: payslip.getDataValue('id'),
              type: 'penalty',
              source: 'auto_leave',
              amount,
              description: `Unpaid leave deduction (${days} days)`,
              ref_id: lr.id,
              ref_type: 'LeaveRequest',
              created_by: actorId,
            }, { transaction: t });
          }
        }

        // create payroll item for late penalty (single item)
        if (latePenalty > 0) {
          await PayrollItem.create({
            payslip_id: payslip.getDataValue('id'),
            type: 'penalty',
            source: 'auto_late',
            amount: latePenalty,
            description: `Late penalty (${totalLateMinutes} minutes)`,
            created_by: actorId,
          }, { transaction: t });
        }

        createdPayslips.push(payslip.toJSON());
      }

      // mark period finalized as draft generated (we keep status as-is; caller can finalize)
      return createdPayslips;
    });
  }

  static async listPayslips(periodId: string) {
    const period = await PayrollPeriod.findByPk(periodId);
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');

    const payslips = await Payslip.findAll({
      where: { period_id: periodId },
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'employee_number', 'full_name', 'base_salary'],
        },
        {
          model: PayrollItem,
          as: 'items',
        },
      ],
      order: [['created_at', 'ASC']],
    });

    return { period, payslips };
  }

  static async getPayslipDetail(payslipId: string) {
    const payslip = await Payslip.findByPk(payslipId, {
      include: [
        { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name', 'base_salary', 'job_title', 'department_id'] },
        { model: PayrollPeriod, as: 'period' },
        { model: PayrollItem, as: 'items' },
      ],
    });

    if (!payslip) throw new NotFoundError('Payslip tidak ditemukan');

    const plain = payslip.toJSON() as any;
    const items = plain.items || [];
    const totals = summarizePayrollItems(items);

    return {
      payslip: plain,
      totals: {
        base_salary: Number(plain.base_salary || 0),
        total_incentive: Number(plain.total_incentive || 0),
        total_bonus: Number(plain.total_bonus || 0),
        total_reimburse: Number(plain.total_reimburse || 0),
        total_penalty: Number(plain.total_penalty || 0),
        net_salary: Number(plain.net_salary || 0),
      },
      breakdown: totals,
      items,
    };
  }

  static async listMyPayslips(userId: string, employeeId?: string, periodId?: string) {
    const resolvedEmployee = await this.resolveEmployeeId(userId, employeeId);

    const where: Record<string, any> = { employee_id: resolvedEmployee };
    if (periodId) where.period_id = periodId;

    const payslips = await Payslip.findAll({
      where,
      include: [{ model: PayrollPeriod, as: 'period' }],
      order: [['created_at', 'DESC']],
    });

    return {
      employee_id: resolvedEmployee,
      payslips,
    };
  }

  static async getMyPayslipDetail(userId: string, payslipId: string, employeeId?: string) {
    const resolvedEmployee = await this.resolveEmployeeId(userId, employeeId);

    const payslip = await Payslip.findOne({
      where: {
        id: payslipId,
        employee_id: resolvedEmployee,
      },
      include: [
        { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name', 'base_salary', 'job_title', 'department_id'] },
        { model: PayrollPeriod, as: 'period' },
        { model: PayrollItem, as: 'items' },
      ],
    });

    if (!payslip) throw new NotFoundError('Payslip tidak ditemukan');

    const plain = payslip.toJSON() as any;
    const items = plain.items || [];
    const totals = summarizePayrollItems(items);

    return {
      payslip: plain,
      totals: {
        base_salary: Number(plain.base_salary || 0),
        total_incentive: Number(plain.total_incentive || 0),
        total_bonus: Number(plain.total_bonus || 0),
        total_reimburse: Number(plain.total_reimburse || 0),
        total_penalty: Number(plain.total_penalty || 0),
        net_salary: Number(plain.net_salary || 0),
      },
      breakdown: totals,
      items,
    };
  }

  static async addManualItem(actorId: string, payslipId: string, input: { type: string; amount: number; description?: string }) {
    const payslip = await Payslip.findByPk(payslipId);
    if (!payslip) throw new NotFoundError('Payslip tidak ditemukan');

    const period = await PayrollPeriod.findByPk(payslip.getDataValue('period_id'));
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');
    if (period.getDataValue('status') !== 'draft') {
      throw new ValidationError('Hanya period draft yang bisa ditambah item manual');
    }

    const allowedTypes = ['incentive', 'penalty', 'bonus'];
    if (!allowedTypes.includes(input.type)) {
      throw new ValidationError('type harus salah satu: incentive, penalty, bonus');
    }

    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new ValidationError('amount harus lebih besar dari 0');
    }

    await sequelize.transaction(async (t: any) => {
      await PayrollItem.create({
        payslip_id: payslipId,
        type: input.type,
        source: 'manual',
        amount,
        description: input.description || null,
        created_by: actorId,
      }, { transaction: t });

      await this.recalculatePayslipTotals(payslipId, t);
    });

    return Payslip.findByPk(payslipId, {
      include: [{ model: PayrollItem, as: 'items' }],
    });
  }

  static async finalizePeriod(periodId: string) {
    const period = await PayrollPeriod.findByPk(periodId);
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');
    if (period.getDataValue('status') === 'paid') {
      throw new ValidationError('Period yang sudah paid tidak bisa difinalize ulang');
    }

    await period.update({ status: 'finalized', finalized_at: new Date() });
    return period;
  }

  private static async recalculatePayslipTotals(payslipId: string, transaction?: any) {
    const payslip = await Payslip.findByPk(payslipId, { transaction });
    if (!payslip) throw new NotFoundError('Payslip tidak ditemukan');

    const items = await PayrollItem.findAll({
      where: { payslip_id: payslipId },
      raw: true,
      transaction,
    });

    let totalIncentive = 0;
    let totalPenalty = 0;
    let totalReimburse = 0;

    for (const item of items as any[]) {
      const amount = Number(item.amount || 0);
      if (item.type === 'incentive') totalIncentive += amount;
      if (item.type === 'penalty') totalPenalty += amount;
      if (item.type === 'bonus') totalIncentive += amount;
      if (item.type === 'reimburse') totalReimburse += amount;
    }

    const baseSalary = Number(payslip.getDataValue('base_salary') || 0);
    const netSalary = baseSalary + totalIncentive + totalReimburse - totalPenalty;

    await payslip.update({
      total_incentive: totalIncentive,
      total_penalty: totalPenalty,
      total_bonus: 0,
      total_reimburse: totalReimburse,
      net_salary: netSalary,
    }, { transaction });
  }

  private static async resolveEmployeeId(userId: string, employeeId?: string) {
    if (employeeId) return employeeId;

    const employee = await Employee.findOne({
      where: { user_id: userId },
      attributes: ['id'],
      raw: true,
    }) as any;

    if (!employee?.id) {
      throw new NotFoundError('Employee tidak ditemukan');
    }

    return employee.id;
  }
}

export default PayrollService;
