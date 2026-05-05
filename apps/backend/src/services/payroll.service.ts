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

function overlapWorkingDays(aStart: Date | string, aEnd: Date | string, bStart: Date, bEnd: Date) {
  const start = normalizeDate(aStart);
  const end = normalizeDate(aEnd);
  const overlapStart = start > bStart ? start : bStart;
  const overlapEnd = end < bEnd ? end : bEnd;
  if (overlapEnd < overlapStart) return 0;
  return countWorkingDays(overlapStart, overlapEnd);
}

function summarizePayrollItems(items: any[]) {
  return items.reduce((acc, item) => {
    const amount = Number(item.amount || 0);
    if (item.type === 'incentive') acc.totalIncentive += amount;
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

  static async generatePeriod(periodId: string, actorId: string) {
    const period: any = await PayrollPeriod.findByPk(periodId, { raw: true });
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');

    if (period.status !== 'draft') {
      throw new ValidationError('Hanya payroll period draft yang bisa digenerate');
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
            const days = overlapWorkingDays(lr.start_date, lr.end_date, start, end);
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
        const lateDays = attendances.length; // jumlah hari telat
        const latePenalty = lateDays * 50000; // Rp 50.000 per hari telat

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
            const days = overlapWorkingDays(lr.start_date, lr.end_date, start, end);
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
            description: `Late penalty (${lateDays} days @ Rp 50.000/day)`,
            created_by: actorId,
          }, { transaction: t });
        }

        // attach any manual items that were created for this period and employee (payslip_id IS NULL)
        const periodItems = await PayrollItem.findAll({
          where: {
            payroll_period_id: periodId,
            employee_id: emp.id,
            source: 'manual',
            payslip_id: null,
          },
          transaction: t,
        });

        for (const pi of periodItems) {
          try {
            await pi.update({ payslip_id: payslip.getDataValue('id') }, { transaction: t });
          } catch {}
        }

        // recalculate totals to include attached manual items
        await this.recalculatePayslipTotals(payslip.getDataValue('id'), t);

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

    // For draft periods, add calculated auto items to each payslip
    const result = payslips.map((ps: any) => {
      const plain = ps.toJSON();
      return plain;
    });

    if (period.getDataValue('status') === 'draft') {
      const { start, end } = monthRange(period.getDataValue('year'), period.getDataValue('month'));
      const workingDays = Math.max(1, countWorkingDays(start, end));

      for (const plain of result) {
        const calculatedAutoItems = await this.calculateAutoItems(plain.employee_id, start, end, workingDays);
        if (!plain.items) plain.items = [];
        plain.items = [...(plain.items || []), ...calculatedAutoItems];
      }
    }

    return { period: period.toJSON(), payslips: result };
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
    let items = plain.items || [];

    // For draft periods, add calculated auto items
    if (plain.period && plain.period.status === 'draft') {
      const period = plain.period;
      const { start, end } = monthRange(period.year, period.month);
      const workingDays = Math.max(1, countWorkingDays(start, end));
      const calculatedAutoItems = await this.calculateAutoItems(plain.employee_id, start, end, workingDays);
      items = items.concat(calculatedAutoItems);
    }

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

    const allowedTypes = ['incentive', 'penalty'];
    if (!allowedTypes.includes(input.type)) {
      throw new ValidationError('type harus salah satu: incentive, penalty');
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

  static async addManualItemToPeriod(actorId: string, periodId: string, input: { employee_id: string; type: string; amount: number; description?: string }) {
    const period = await PayrollPeriod.findByPk(periodId);
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');
    if (period.getDataValue('status') !== 'draft') {
      throw new ValidationError('Hanya period draft yang bisa ditambah item manual');
    }

    const allowedTypes = ['incentive', 'penalty'];
    if (!allowedTypes.includes(input.type)) {
      throw new ValidationError('type harus salah satu: incentive, penalty');
    }

    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new ValidationError('amount harus lebih besar dari 0');
    }

    const employee = await Employee.findByPk(input.employee_id);
    if (!employee) throw new NotFoundError('Employee tidak ditemukan');

    return await sequelize.transaction(async (t: any) => {
      // check if payslips already generated
      let payslip = await Payslip.findOne({
        where: {
          period_id: periodId,
          employee_id: input.employee_id,
        },
        transaction: t,
      });

      // if payslip doesn't exist, auto-generate payslips for period first
      if (!payslip) {
        // generate all payslips
        const { start, end } = monthRange(period.getDataValue('year'), period.getDataValue('month'));
        const workingDays = Math.max(1, countWorkingDays(start, end));

        const employees = (await Employee.findAll({ where: { is_active: true }, raw: true, transaction: t })) as any[];

        for (const emp of employees) {
          const baseSalary = Number(emp.base_salary || 0);

          const reimbursements = await Reimbursement.scope('unprocessed').findAll({
            where: {
              employee_id: emp.id,
              expense_date: { [Op.between]: [start, end] },
            },
            transaction: t,
          });
          const totalReimburse = reimbursements.reduce((s: number, r: any) => s + Number(r.amount), 0);

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
              const days = overlapWorkingDays(lr.start_date, lr.end_date, start, end);
              unpaidDays += Math.max(0, days);
            }
          }

          const perDay = baseSalary / workingDays;
          const unpaidPenalty = unpaidDays * perDay;

          const attendances = await Attendance.findAll({
            where: {
              employee_id: emp.id,
              status: 'late',
              date: { [Op.between]: [start, end] },
            },
            transaction: t,
          });
          const lateDays = attendances.length; // jumlah hari telat
          const latePenalty = lateDays * 50000; // Rp 50.000 per hari telat

          const totalPenalty = unpaidPenalty + latePenalty;
          const totalIncentive = 0;
          const net = baseSalary + totalIncentive + totalReimburse - totalPenalty;

          const ps = await Payslip.create({
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
              payslip_id: ps.getDataValue('id'),
              type: 'reimburse',
              source: 'auto_reimburse',
              amount: r.amount,
              description: `Auto reimburse: ${r.category}`,
              ref_id: r.id,
              ref_type: 'Reimbursement',
              created_by: actorId,
            }, { transaction: t });
            try {
              await r.update({ payroll_item_id: item.getDataValue('id') }, { transaction: t });
            } catch {}
          }

          // create payroll items for unpaid leave
          for (const lr of leaveRequests as any[]) {
            const lt = lr.getDataValue ? lr.getDataValue('leaveType') : lr.leaveType;
            if (lt && lt.is_paid === false) {
              const days = overlapWorkingDays(lr.start_date, lr.end_date, start, end);
              const amount = days * perDay;
              await PayrollItem.create({
                payslip_id: ps.getDataValue('id'),
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

          // create payroll item for late penalty
          if (latePenalty > 0) {
            await PayrollItem.create({
              payslip_id: ps.getDataValue('id'),
              type: 'penalty',
              source: 'auto_late',
              amount: latePenalty,
              description: `Late penalty (${lateDays} days @ Rp 50.000/day)`,
              created_by: actorId,
            }, { transaction: t });
          }

          // set payslip for matching employee
          if (emp.id === input.employee_id) {
            payslip = ps;
          }
        }

        // ensure payslip exists for target employee
        if (!payslip) {
          throw new Error('Payslip gagal dibuat untuk employee');
        }
      }

      // now create the manual item and attach to payslip
      const createdItem = await PayrollItem.create({
        payslip_id: payslip!.getDataValue('id'),
        payroll_period_id: periodId,
        employee_id: input.employee_id,
        type: input.type,
        source: 'manual',
        amount,
        description: input.description || null,
        created_by: actorId,
      }, { transaction: t });

      // recalculate payslip totals
      await this.recalculatePayslipTotals(payslip!.getDataValue('id'), t);

      // return updated payslip
      return await Payslip.findByPk(payslip!.getDataValue('id'), {
        include: [
          { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name', 'base_salary'] },
          { model: PayrollItem, as: 'items' },
        ],
        transaction: t,
      });
    });
  }

  static async deleteManualItem(actorId: string, payslipId: string, itemId: string) {
    const payslip = await Payslip.findByPk(payslipId);
    if (!payslip) throw new NotFoundError('Payslip tidak ditemukan');

    const period = await PayrollPeriod.findByPk(payslip.getDataValue('period_id'));
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');
    if (period.getDataValue('status') !== 'draft') {
      throw new ValidationError('Hanya period draft yang bisa diubah');
    }

    const item = await PayrollItem.findOne({
      where: {
        id: itemId,
        payslip_id: payslipId,
        source: 'manual',
      },
    });

    if (!item) {
      throw new NotFoundError('Manual payroll item tidak ditemukan');
    }

    await sequelize.transaction(async (t: any) => {
      await item.destroy({ transaction: t });
      await this.recalculatePayslipTotals(payslipId, t);
    });

    return Payslip.findByPk(payslipId, {
      include: [{ model: PayrollItem, as: 'items' }],
    });
  }

  static async finalizePeriod(periodId: string) {
    const period = await PayrollPeriod.findByPk(periodId);
    if (!period) throw new NotFoundError('Payroll period tidak ditemukan');
    if (period.getDataValue('status') !== 'draft') {
      throw new ValidationError('Hanya period draft yang bisa difinalize');
    }

    const payslipsCount = await Payslip.count({ where: { period_id: periodId } });
    if (payslipsCount === 0) {
      throw new ValidationError('Generate payslip terlebih dahulu sebelum finalize');
    }

    await sequelize.transaction(async (t: any) => {
      // Before finalizing, permanently store all calculated auto items
      const { start, end } = monthRange(period.getDataValue('year'), period.getDataValue('month'));
      const workingDays = Math.max(1, countWorkingDays(start, end));

      const payslips = await Payslip.findAll({ where: { period_id: periodId }, transaction: t });
      for (const ps of payslips as any[]) {
        const empId = ps.getDataValue('employee_id');
        const psId = ps.getDataValue('id');

        // Calculate and store auto items that don't exist yet
        const calculatedItems = await this.calculateAutoItems(empId, start, end, workingDays);
        for (const calcItem of calculatedItems) {
          // Check if similar item already exists
          const existing = await PayrollItem.findOne({
            where: { payslip_id: psId, source: calcItem.source, type: calcItem.type },
            transaction: t,
          });
          if (!existing && calcItem.amount > 0) {
            await PayrollItem.create({
              payslip_id: psId,
              type: calcItem.type,
              source: calcItem.source,
              amount: calcItem.amount,
              description: calcItem.description,
              ref_id: calcItem.ref_id || null,
              ref_type: calcItem.ref_type || null,
              created_by: 'system',
            }, { transaction: t });
          }
        }

        // Recalculate totals
        await this.recalculatePayslipTotals(psId, t);
      }

      // Now finalize the period
      await period.update({ status: 'finalized', finalized_at: new Date() }, { transaction: t });
    });

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
    let totalBonus = 0;
    let totalPenalty = 0;
    let totalReimburse = 0;

    for (const item of items as any[]) {
      const amount = Number(item.amount || 0);
      if (item.type === 'incentive') totalIncentive += amount;
      if (item.type === 'penalty') totalPenalty += amount;
      if (item.type === 'bonus') totalBonus += amount;
      if (item.type === 'reimburse') totalReimburse += amount;
    }

    const baseSalary = Number(payslip.getDataValue('base_salary') || 0);
    const netSalary = baseSalary + totalIncentive + totalBonus + totalReimburse - totalPenalty;

    await payslip.update({
      total_incentive: totalIncentive,
      total_penalty: totalPenalty,
      total_bonus: totalBonus,
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

  // Calculate auto items dynamically for a payslip (reimbursements, unpaid leaves, late penalties)
  private static async calculateAutoItems(employeeId: string, start: Date, end: Date, workingDays: number) {
    const items: any[] = [];
    const baseSalary = (await Employee.findByPk(employeeId, { attributes: ['base_salary'], raw: true }) as any)?.base_salary || 0;
    const perDay = Number(baseSalary) / workingDays;

    // -- Reimbursements (approved, regardless of payroll_item_id status)
    // This ensures we include reimbursements even if they were previously processed
    const reimbursements = await Reimbursement.findAll({
      where: {
        employee_id: employeeId,
        status: 'approved',
        expense_date: { [Op.between]: [start, end] },
      },
      raw: true,
    });

    for (const r of reimbursements as any[]) {
      items.push({
        type: 'reimburse',
        source: 'auto_reimburse',
        amount: Number(r.amount),
        description: `Auto reimburse: ${r.category}`,
        ref_id: r.id,
        ref_type: 'Reimbursement',
      });
    }

    // -- Unpaid Leave Deductions
    const leaveRequests = await LeaveRequest.findAll({
      where: {
        employee_id: employeeId,
        status: 'approved',
        start_date: { [Op.lte]: end },
        end_date: { [Op.gte]: start },
      },
      include: [{ model: LeaveType, as: 'leaveType' }],
      raw: true,
      nest: true,
    });

    for (const lr of leaveRequests as any[]) {
      if (lr.leaveType && lr.leaveType.is_paid === false) {
        const days = overlapWorkingDays(lr.start_date, lr.end_date, start, end);
        const amount = days * perDay;
        if (amount > 0) {
          items.push({
            type: 'penalty',
            source: 'auto_leave',
            amount,
            description: `Unpaid leave deduction (${days} days)`,
            ref_id: lr.id,
            ref_type: 'LeaveRequest',
          });
        }
      }
    }

    // -- Late Penalties
    const attendances = await Attendance.findAll({
      where: {
        employee_id: employeeId,
        status: 'late',
        date: { [Op.between]: [start, end] },
      },
      raw: true,
    });

    const lateDays = attendances.length;
    const latePenalty = lateDays * 50000;

    if (latePenalty > 0) {
      items.push({
        type: 'penalty',
        source: 'auto_late',
        amount: latePenalty,
        description: `Late penalty (${lateDays} days @ Rp 50.000/day)`,
      });
    }

    return items;
  }
}

export default PayrollService;
