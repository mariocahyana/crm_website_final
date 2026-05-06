import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  sequelize,
  PayrollPeriod,
  Employee,
  Payslip,
  PayrollItem,
  Reimbursement,
  LeaveRequest,
  Attendance,
  ActivityLog,
} from '../models/index';
import PayrollService from './payroll.service';

describe('payroll.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(PayrollPeriod, 'findAll');
    jest.spyOn(PayrollPeriod, 'findOne');
    jest.spyOn(PayrollPeriod, 'findByPk');
    jest.spyOn(PayrollPeriod, 'create');
    jest.spyOn(Employee, 'findAll');
    jest.spyOn(Employee, 'findByPk');
    jest.spyOn(Employee, 'findOne');
    jest.spyOn(Payslip, 'create');
    jest.spyOn(Payslip, 'findAll');
    jest.spyOn(Payslip, 'findByPk');
    jest.spyOn(Payslip, 'count');
    jest.spyOn(PayrollItem, 'create');
    jest.spyOn(PayrollItem, 'findAll');
    jest.spyOn(PayrollItem, 'findOne');
    jest.spyOn(Reimbursement, 'scope');
    jest.spyOn(LeaveRequest, 'findAll');
    jest.spyOn(Attendance, 'findAll');
    jest.spyOn(ActivityLog, 'create');
    jest.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) => {
      const mockTransaction = {};
      return callback(mockTransaction);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listPeriods', () => {
    it('returns all payroll periods ordered by year and month descending', async () => {
      const mockPeriods = [
        { id: 'period-1', month: 5, year: 2026, status: 'draft' },
        { id: 'period-2', month: 4, year: 2026, status: 'draft' },
      ];

      jest.spyOn(PayrollPeriod, 'findAll').mockResolvedValue(mockPeriods as any);

      const result = await PayrollService.listPeriods();

      expect(result).toHaveLength(2);
      expect(PayrollPeriod.findAll).toHaveBeenCalled();
    });

    it('returns empty array when no periods exist', async () => {
      jest.spyOn(PayrollPeriod, 'findAll').mockResolvedValue([]);

      const result = await PayrollService.listPeriods();

      expect(result).toHaveLength(0);
    });
  });

  describe('createPeriod', () => {
    it('throws error when month is invalid', async () => {
      await expect(
        PayrollService.createPeriod({ month: 0, year: 2026, actorId: 'admin-1' })
      ).rejects.toThrow('month harus antara 1 sampai 12');

      await expect(
        PayrollService.createPeriod({ month: 13, year: 2026, actorId: 'admin-1' })
      ).rejects.toThrow('month harus antara 1 sampai 12');
    });

    it('throws error when year is invalid', async () => {
      await expect(
        PayrollService.createPeriod({ month: 5, year: 1999, actorId: 'admin-1' })
      ).rejects.toThrow('year tidak valid');
    });

    it('throws error when period already exists', async () => {
      jest.spyOn(PayrollPeriod, 'findOne').mockResolvedValue({
        id: 'period-1',
        month: 5,
        year: 2026,
      } as any);

      await expect(
        PayrollService.createPeriod({ month: 5, year: 2026, actorId: 'admin-1' })
      ).rejects.toThrow('Payroll period untuk bulan dan tahun tersebut sudah ada');
    });

    it('creates period with draft status', async () => {
      jest.spyOn(PayrollPeriod, 'findOne').mockResolvedValue(null);
      jest.spyOn(PayrollPeriod, 'create').mockResolvedValue({
        id: 'period-new',
        month: 5,
        year: 2026,
        status: 'draft',
        created_by: 'admin-1',
      } as any);

      const result = await PayrollService.createPeriod({ month: '5' as any, year: '2026' as any, actorId: 'admin-1' });

      expect(PayrollPeriod.create).toHaveBeenCalledWith({
        month: 5,
        year: 2026,
        status: 'draft',
        created_by: 'admin-1',
      });
      expect(result).toHaveProperty('status', 'draft');
    });
  });

  describe('generatePeriod', () => {
    it('throws error when period not found', async () => {
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(null);

      await expect(
        PayrollService.generatePeriod('non-existent', 'admin-1')
      ).rejects.toThrow('Payroll period tidak ditemukan');
    });

    it('generates payslips for all active employees', async () => {
      const mockPeriod = {
        id: 'period-1',
        month: 5,
        year: 2026,
        status: 'draft',
      };

      const mockEmployee = {
        id: 'emp-1',
        base_salary: 5000000,
      };

      const mockPayslip = {
        getDataValue: (key: string) => (key === 'id' ? 'payslip-1' : key === 'base_salary' ? 5000000 : undefined),
        toJSON: () => ({ id: 'payslip-1', employee_id: 'emp-1' }),
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(Payslip, 'count').mockResolvedValue(0 as any);
      jest.spyOn(Employee, 'findAll').mockResolvedValue([mockEmployee] as any);
      jest.spyOn(Reimbursement, 'scope').mockReturnValue({
        findAll: jest.fn().mockResolvedValue([]),
      } as any);
      jest.spyOn(LeaveRequest, 'findAll').mockResolvedValue([] as any);
      jest.spyOn(Attendance, 'findAll').mockResolvedValue([] as any);
      jest.spyOn(Payslip, 'create').mockResolvedValue(mockPayslip as any);
      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);
      jest.spyOn(PayrollItem, 'findAll').mockResolvedValue([] as any);

      const result = await PayrollService.generatePeriod('period-1', 'admin-1');

      expect(result).toHaveLength(1);
      expect(Payslip.create).toHaveBeenCalled();
      expect(Employee.findAll).toHaveBeenCalled();
    });
  });

  describe('finalizePeriod', () => {
    it('updates period status to finalized', async () => {
      const mockPeriod = {
        id: 'period-1',
        status: 'draft',
        year: 2026,
        month: 5,
        update: jest.fn().mockResolvedValue({}),
        getDataValue: (key: string) => {
          if (key === 'status') return 'draft';
          if (key === 'year') return 2026;
          if (key === 'month') return 5;
          return undefined;
        },
      };

      const mockPayslip = {
        getDataValue: (key: string) => {
          if (key === 'employee_id') return 'emp-1';
          if (key === 'id') return 'payslip-1';
          if (key === 'base_salary') return 5000000;
          return undefined;
        },
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(Payslip, 'count').mockResolvedValue(1 as any);
      jest.spyOn(Payslip, 'findAll').mockResolvedValue([mockPayslip] as any);
      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);
      jest.spyOn(PayrollItem, 'findOne').mockResolvedValue(null);
      jest.spyOn(PayrollItem, 'create').mockResolvedValue({ getDataValue: () => 'item-1' } as any);
      jest.spyOn(PayrollItem, 'findAll').mockResolvedValue([] as any);
      jest.spyOn(Employee, 'findByPk').mockResolvedValue({ base_salary: 5000000 } as any);
      jest.spyOn(Reimbursement, 'findAll').mockResolvedValue([] as any);
      jest.spyOn(LeaveRequest, 'findAll').mockResolvedValue([] as any);
      jest.spyOn(Attendance, 'findAll').mockResolvedValue([] as any);

      await PayrollService.finalizePeriod('period-1');

      expect(mockPeriod.update).toHaveBeenCalled();
    });
  });

  describe('listPayslips', () => {
    it('returns payslips for specified period', async () => {
      const mockPeriod = {
        id: 'period-1',
        month: 5,
        year: 2026,
        status: 'finalized',
        getDataValue: (key: string) => {
          if (key === 'status') return 'finalized';
          if (key === 'year') return 2026;
          if (key === 'month') return 5;
          return undefined;
        },
        toJSON: () => ({ id: 'period-1', status: 'finalized' }),
      };

      const mockPayslips = [
        { toJSON: () => ({ id: 'payslip-1', employee_id: 'emp-1', amount: 5000000, items: [] }) },
      ];

      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(Payslip, 'findAll').mockResolvedValue(mockPayslips as any);

      const result = await PayrollService.listPayslips('period-1');

      expect(result.payslips).toHaveLength(1);
      expect(result.period).toHaveProperty('id', 'period-1');
    });
  });

  describe('listMyPayslips', () => {
    it('returns payslips for authenticated employee', async () => {
      jest.spyOn(Employee, 'findOne').mockResolvedValue({
        id: 'emp-1',
        getDataValue: (key: string) => (key === 'id' ? 'emp-1' : undefined),
      } as any);

      jest.spyOn(Payslip, 'findAll').mockResolvedValue([
        {
          id: 'payslip-1',
          employee_id: 'emp-1',
          amount: 5000000,
          period: { id: 'period-1', month: 5, year: 2026 },
        },
      ] as any);

      const result = await PayrollService.listMyPayslips('user-1', 'emp-1');

      expect(result.employee_id).toBe('emp-1');
      expect(Payslip.findAll).toHaveBeenCalled();
    });

    it('throws error when employee not found', async () => {
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);

      await expect(
        PayrollService.listMyPayslips('user-1'),
      ).rejects.toThrow('Employee tidak ditemukan');
    });
  });

  describe('getPayslipDetail', () => {
    it('returns complete payslip details with items', async () => {
      const mockItems = [
        { type: 'incentive', amount: 500000 },
        { type: 'bonus', amount: 300000 },
        { type: 'reimburse', amount: 100000 },
        { type: 'penalty', amount: 200000 },
      ];

      const mockPayslip = {
        id: 'payslip-1',
        employee_id: 'emp-1',
        base_salary: 5000000,
        total_incentive: 500000,
        total_penalty: 200000,
        total_bonus: 300000,
        total_reimburse: 100000,
        net_salary: 5700000,
        getDataValue: (key: string) => {
          const data: any = {
            base_salary: 5000000,
            total_incentive: 500000,
            total_penalty: 200000,
            total_bonus: 300000,
            total_reimburse: 100000,
            net_salary: 5700000,
            period: { id: 'period-1', status: 'finalized', year: 2026, month: 5 },
          };
          return data[key];
        },
        toJSON: () => ({
          id: 'payslip-1',
          employee_id: 'emp-1',
          base_salary: 5000000,
          total_incentive: 500000,
          total_penalty: 200000,
          total_bonus: 300000,
          total_reimburse: 100000,
          net_salary: 5700000,
          period: { id: 'period-1', status: 'finalized', year: 2026, month: 5 },
          items: mockItems,
        }),
      };

      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);

      const result = await PayrollService.getPayslipDetail('payslip-1');

      expect(result.payslip).toHaveProperty('id', 'payslip-1');
      expect(result.totals).toHaveProperty('base_salary', 5000000);
      expect(result.totals).toHaveProperty('net_salary', 5700000);
    });

    it('throws error when payslip not found', async () => {
      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(null);

      await expect(
        PayrollService.getPayslipDetail('non-existent'),
      ).rejects.toThrow('Payslip tidak ditemukan');
    });
  });

  describe('getMyPayslipDetail', () => {
    it('returns payslip detail for employee own payslip', async () => {
      jest.spyOn(Employee, 'findOne').mockResolvedValue({
        id: 'emp-1',
        getDataValue: (key: string) => (key === 'id' ? 'emp-1' : undefined),
      } as any);

      const mockPayslip = {
        id: 'payslip-1',
        employee_id: 'emp-1',
        base_salary: 5000000,
        total_incentive: 0,
        total_penalty: 0,
        total_bonus: 0,
        total_reimburse: 0,
        net_salary: 5000000,
        getDataValue: (key: string) => {
          const data: any = {
            period: { id: 'period-1', status: 'finalized', year: 2026, month: 5 },
          };
          return data[key];
        },
        toJSON: () => ({
          id: 'payslip-1',
          employee_id: 'emp-1',
          base_salary: 5000000,
          total_incentive: 0,
          total_penalty: 0,
          total_bonus: 0,
          total_reimburse: 0,
          net_salary: 5000000,
          items: [],
        }),
      };

      jest.spyOn(Payslip, 'findOne').mockResolvedValue(mockPayslip as any);

      const result = await PayrollService.getMyPayslipDetail('user-1', 'payslip-1', 'emp-1');

      expect(result.payslip).toHaveProperty('id', 'payslip-1');
      expect(result.payslip.employee_id).toBe('emp-1');
    });

    it('throws error when payslip belongs to different employee', async () => {
      jest.spyOn(Employee, 'findOne').mockResolvedValue({
        id: 'emp-1',
        getDataValue: (key: string) => (key === 'id' ? 'emp-1' : undefined),
      } as any);

      jest.spyOn(Payslip, 'findOne').mockResolvedValue(null);

      await expect(
        PayrollService.getMyPayslipDetail('user-1', 'payslip-1', 'emp-1'),
      ).rejects.toThrow('Payslip tidak ditemukan');
    });

    it('throws error when payslip not found', async () => {
      jest.spyOn(Employee, 'findOne').mockResolvedValue({
        id: 'emp-1',
        getDataValue: (key: string) => (key === 'id' ? 'emp-1' : undefined),
      } as any);

      jest.spyOn(Payslip, 'findOne').mockResolvedValue(null);

      await expect(
        PayrollService.getMyPayslipDetail('user-1', 'non-existent', 'emp-1'),
      ).rejects.toThrow('Payslip tidak ditemukan');
    });
  });

  describe('addManualItem', () => {
    it('adds incentive item to payslip in draft period', async () => {
      const mockPayslipForUpdate = {
        id: 'payslip-1',
        getDataValue: (key: string) => {
          if (key === 'base_salary') return 5000000;
          if (key === 'id') return 'payslip-1';
          if (key === 'period_id') return 'period-1';
          return undefined;
        },
        update: jest.fn().mockResolvedValue({}),
      };

      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'draft' : undefined),
      };

      jest.spyOn(Payslip, 'findByPk')
        .mockResolvedValueOnce({ ...mockPayslipForUpdate })
        .mockResolvedValueOnce({ ...mockPayslipForUpdate })
        .mockResolvedValueOnce({
          id: 'payslip-1',
          toJSON: () => ({ id: 'payslip-1', items: [] }),
        } as any);

      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(PayrollItem, 'create').mockResolvedValue({ id: 'item-1' } as any);
      jest.spyOn(PayrollItem, 'findAll').mockResolvedValue([
        { type: 'incentive', amount: 500000 } as any,
      ]);

      const result = await PayrollService.addManualItem('admin-1', 'payslip-1', {
        type: 'incentive',
        amount: 500000,
        description: 'Performance bonus',
      });

      expect(PayrollItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payslip_id: 'payslip-1',
          type: 'incentive',
          source: 'manual',
          amount: 500000,
          description: 'Performance bonus',
        }),
        expect.any(Object)
      );
      expect(result).toBeTruthy();
    });

    it('throws error when payslip not found', async () => {
      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(null);

      await expect(
        PayrollService.addManualItem('admin-1', 'non-existent', {
          type: 'incentive',
          amount: 500000,
        }),
      ).rejects.toThrow('Payslip tidak ditemukan');
    });

    it('throws error when period is not draft', async () => {
      const mockPayslip = {
        id: 'payslip-1',
        getDataValue: (key: string) => (key === 'period_id' ? 'period-1' : undefined),
      };

      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'finalized' : undefined),
      };

      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);

      await expect(
        PayrollService.addManualItem('admin-1', 'payslip-1', {
          type: 'incentive',
          amount: 500000,
        }),
      ).rejects.toThrow('Hanya period draft yang bisa ditambah item manual');
    });

    it('throws error when amount is invalid', async () => {
      const mockPayslip = {
        id: 'payslip-1',
        getDataValue: (key: string) => (key === 'period_id' ? 'period-1' : undefined),
      };

      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'draft' : undefined),
      };

      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);

      await expect(
        PayrollService.addManualItem('admin-1', 'payslip-1', {
          type: 'incentive',
          amount: -500000,
        }),
      ).rejects.toThrow('amount harus lebih besar dari 0');
    });

    it('throws error when type is invalid', async () => {
      const mockPayslip = {
        id: 'payslip-1',
        getDataValue: (key: string) => (key === 'period_id' ? 'period-1' : undefined),
      };

      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'draft' : undefined),
      };

      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);

      await expect(
        PayrollService.addManualItem('admin-1', 'payslip-1', {
          type: 'invalid',
          amount: 500000,
        }),
      ).rejects.toThrow('type harus salah satu: incentive, penalty');
    });
  });

  describe('addManualItemToPeriod', () => {
    it('adds manual item to period with existing payslip', async () => {
      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => {
          if (key === 'status') return 'draft';
          if (key === 'year') return 2026;
          if (key === 'month') return 5;
          if (key === 'id') return 'period-1';
          return undefined;
        },
      };

      const mockEmployee = {
        id: 'emp-1',
      };

      const mockPayslipForUpdate = {
        id: 'payslip-1',
        getDataValue: (key: string) => {
          if (key === 'id') return 'payslip-1';
          if (key === 'base_salary') return 5000000;
          return undefined;
        },
        update: jest.fn().mockResolvedValue({}),
      };

      const mockPayslipForReturn = {
        id: 'payslip-1',
        toJSON: () => ({ id: 'payslip-1', items: [] }),
        getDataValue: (key: string) => (key === 'id' ? 'payslip-1' : undefined),
      };

      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(Payslip, 'findOne').mockResolvedValue({ ...mockPayslipForUpdate } as any);
      jest.spyOn(PayrollItem, 'create').mockResolvedValue({
        id: 'item-1',
        getDataValue: (key: string) => (key === 'id' ? 'item-1' : undefined),
      } as any);
      jest.spyOn(PayrollItem, 'findAll').mockResolvedValue([] as any);
      jest.spyOn(Payslip, 'findByPk')
        .mockResolvedValueOnce({ ...mockPayslipForUpdate } as any)  // for recalculatePayslipTotals
        .mockResolvedValueOnce(mockPayslipForReturn as any);         // for final return

      const result = await PayrollService.addManualItemToPeriod('admin-1', 'period-1', {
        employee_id: 'emp-1',
        type: 'incentive',
        amount: 300000,
      });

      expect(result).toBeTruthy();
      expect(PayrollItem.create).toHaveBeenCalled();
    });

    it('throws error when period not found', async () => {
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(null);

      await expect(
        PayrollService.addManualItemToPeriod('admin-1', 'non-existent', {
          employee_id: 'emp-1',
          type: 'incentive',
          amount: 300000,
        }),
      ).rejects.toThrow('Payroll period tidak ditemukan');
    });

    it('throws error when employee not found', async () => {
      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'draft' : undefined),
      };

      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(Employee, 'findByPk').mockResolvedValue(null);

      await expect(
        PayrollService.addManualItemToPeriod('admin-1', 'period-1', {
          employee_id: 'non-existent',
          type: 'incentive',
          amount: 300000,
        }),
      ).rejects.toThrow('Employee tidak ditemukan');
    });

    it('throws error when period is not draft', async () => {
      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'finalized' : undefined),
      };

      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);

      await expect(
        PayrollService.addManualItemToPeriod('admin-1', 'period-1', {
          employee_id: 'emp-1',
          type: 'incentive',
          amount: 300000,
        }),
      ).rejects.toThrow('Hanya period draft yang bisa ditambah item manual');
    });
  });

  describe('deleteManualItem', () => {
    it('deletes manual item from payslip in draft period', async () => {
      const mockPayslipForUpdate = {
        id: 'payslip-1',
        getDataValue: (key: string) => {
          if (key === 'base_salary') return 5000000;
          if (key === 'period_id') return 'period-1';
          if (key === 'id') return 'payslip-1';
          return undefined;
        },
        update: jest.fn().mockResolvedValue({}),
      };

      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'draft' : undefined),
      };

      const mockItem = {
        id: 'item-1',
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(Payslip, 'findByPk')
        .mockResolvedValueOnce({ ...mockPayslipForUpdate })
        .mockResolvedValueOnce({ ...mockPayslipForUpdate })
        .mockResolvedValueOnce({
          id: 'payslip-1',
          toJSON: () => ({ id: 'payslip-1', items: [] }),
        } as any);
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(PayrollItem, 'findOne').mockResolvedValue(mockItem as any);
      jest.spyOn(PayrollItem, 'findAll').mockResolvedValue([] as any);

      const result = await PayrollService.deleteManualItem('admin-1', 'payslip-1', 'item-1');

      expect(mockItem.destroy).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('throws error when payslip not found', async () => {
      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(null);

      await expect(
        PayrollService.deleteManualItem('admin-1', 'non-existent', 'item-1'),
      ).rejects.toThrow('Payslip tidak ditemukan');
    });

    it('throws error when period is not draft', async () => {
      const mockPayslip = {
        id: 'payslip-1',
        getDataValue: (key: string) => (key === 'period_id' ? 'period-1' : undefined),
      };

      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'finalized' : undefined),
      };

      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);

      await expect(
        PayrollService.deleteManualItem('admin-1', 'payslip-1', 'item-1'),
      ).rejects.toThrow('Hanya period draft yang bisa diubah');
    });

    it('throws error when manual item not found', async () => {
      const mockPayslip = {
        id: 'payslip-1',
        getDataValue: (key: string) => (key === 'period_id' ? 'period-1' : undefined),
      };

      const mockPeriod = {
        id: 'period-1',
        getDataValue: (key: string) => (key === 'status' ? 'draft' : undefined),
      };

      jest.spyOn(Payslip, 'findByPk').mockResolvedValue(mockPayslip as any);
      jest.spyOn(PayrollPeriod, 'findByPk').mockResolvedValue(mockPeriod as any);
      jest.spyOn(PayrollItem, 'findOne').mockResolvedValue(null);

      await expect(
        PayrollService.deleteManualItem('admin-1', 'payslip-1', 'item-1'),
      ).rejects.toThrow('Manual payroll item tidak ditemukan');
    });
  });
});
