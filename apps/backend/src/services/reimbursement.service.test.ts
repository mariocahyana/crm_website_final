import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ActivityLog, Employee, Reimbursement } from '../models/index';
import * as uploadUtils from '../middlewares/upload';
import ReimbursementService from './reimbursement.service';

describe('reimbursement.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Employee, 'findByPk');
    jest.spyOn(Reimbursement, 'findAll');
    jest.spyOn(Reimbursement, 'findByPk');
    jest.spyOn(Reimbursement, 'create');
    jest.spyOn(ActivityLog, 'create');
    jest.spyOn(uploadUtils, 'getReceiptUrl');
    jest.spyOn(uploadUtils, 'deleteReceiptFile');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listRequests', () => {
    it('staff sees only own requests', async () => {
      const auth = { userId: 'user-1', role: 'staff' as const, employeeId: 'emp-1' };

      jest.spyOn(Reimbursement, 'findAll').mockResolvedValue([]);

      const result = await ReimbursementService.listRequests(auth as any);

      expect(result).toBeDefined();
      expect(Reimbursement.findAll).toHaveBeenCalled();
    });

    it('manager sees subordinate requests', async () => {
      const auth = { userId: 'user-1', role: 'manager' as const, employeeId: 'emp-1' };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue({
        id: 'emp-1',
        department_id: 'dept-1',
      } as any);
      jest.spyOn(Reimbursement, 'findAll').mockResolvedValue([]);

      await ReimbursementService.listRequests(auth as any);

      expect(Reimbursement.findAll).toHaveBeenCalled();
    });

    it('admin sees all requests', async () => {
      const auth = { userId: 'admin-1', role: 'admin' as const, employeeId: 'emp-admin' };

      jest.spyOn(Reimbursement, 'findAll').mockResolvedValue([]);

      await ReimbursementService.listRequests(auth as any);

      expect(Reimbursement.findAll).toHaveBeenCalled();
    });
  });

  describe('createRequest', () => {
    it('throws error when category not provided', async () => {
      const auth = { userId: 'user-1', role: 'staff' as const, employeeId: 'emp-1' };

      await expect(
        ReimbursementService.createRequest(auth as any, {
          amount: 500000,
          expense_date: '2026-05-01',
        } as any, undefined, '192.168.1.1')
      ).rejects.toThrow('Kategori dan tanggal pengeluaran wajib diisi');
    });

    it('throws error when amount is invalid', async () => {
      const auth = { userId: 'user-1', role: 'staff' as const, employeeId: 'emp-1' };

      await expect(
        ReimbursementService.createRequest(auth as any, {
          category: 'transport',
          amount: -100,
          expense_date: '2026-05-01',
        } as any, undefined, '192.168.1.1')
      ).rejects.toThrow('Nominal reimburse harus lebih dari 0');
    });

    it('creates reimbursement with pending status', async () => {
      const auth = { userId: 'user-1', role: 'staff' as const, employeeId: 'emp-1' };

      jest.spyOn(Reimbursement, 'create').mockResolvedValue({
        id: 'reimb-1',
        getDataValue: (key: string) => (key === 'id' ? 'reimb-1' : undefined),
      } as any);
      jest.spyOn(Reimbursement, 'findByPk').mockResolvedValue({
        id: 'reimb-1',
        toJSON: () => ({ id: 'reimb-1', status: 'pending' }),
      } as any);

      const result = await ReimbursementService.createRequest(auth as any, {
        category: 'transport',
        amount: 500000,
        expense_date: '2026-05-01',
        description: 'Travel expense',
      } as any, undefined, '192.168.1.1');

      expect(Reimbursement.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('prevents admin from creating reimbursement', async () => {
      const auth = { userId: 'admin-1', role: 'admin' as const, employeeId: 'emp-1' };

      await expect(
        ReimbursementService.createRequest(auth as any, {
          category: 'transport',
          amount: 500000,
          expense_date: '2026-05-01',
        } as any, undefined, '192.168.1.1')
      ).rejects.toThrow('Admin tidak dapat mengajukan reimburse');
    });
  });

  describe('decideRequest', () => {
    it('throws error when request not found', async () => {
      const auth = { userId: 'user-1', role: 'manager' as const, employeeId: 'emp-1' };

      jest.spyOn(Reimbursement, 'findByPk').mockResolvedValue(null);

      await expect(
        ReimbursementService.decideRequest(auth as any, 'non-existent', {
          status: 'approved',
        } as any, '192.168.1.1')
      ).rejects.toThrow('Request reimburse tidak ditemukan');
    });

    it('approves reimbursement request', async () => {
      const auth = { userId: 'user-1', role: 'manager' as const, employeeId: 'emp-1' };

      const mockRequest = {
        id: 'reimb-1',
        status: 'pending',
        employee: {
          id: 'emp-2',
          manager_id: 'emp-1',
          department_id: 'dept-1',
        },
        get: (key: string) => (key === 'employee' ? {
          id: 'emp-2',
          manager_id: 'emp-1',
          department_id: 'dept-1',
        } : undefined),
        getDataValue: (key: string) => (key === 'status' ? 'pending' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(Reimbursement, 'findByPk').mockResolvedValue(mockRequest as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ReimbursementService.decideRequest(auth as any, 'reimb-1', {
        status: 'approved',
      } as any, '192.168.1.1');

      expect(mockRequest.update).toHaveBeenCalled();
    });

    it('rejects with reason', async () => {
      const auth = { userId: 'user-1', role: 'manager' as const, employeeId: 'emp-1' };

      const mockRequest = {
        id: 'reimb-1',
        status: 'pending',
        employee: {
          id: 'emp-2',
          manager_id: 'emp-1',
          department_id: 'dept-1',
        },
        get: (key: string) => (key === 'employee' ? {
          id: 'emp-2',
          manager_id: 'emp-1',
          department_id: 'dept-1',
        } : undefined),
        getDataValue: (key: string) => (key === 'status' ? 'pending' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(Reimbursement, 'findByPk').mockResolvedValue(mockRequest as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ReimbursementService.decideRequest(auth as any, 'reimb-1', {
        status: 'declined',
        decline_reason: 'Invalid receipt',
      } as any, '192.168.1.1');

      expect(mockRequest.update).toHaveBeenCalled();
    });
  });

  describe('deleteRequest', () => {
    it('throws error when request not found', async () => {
      const auth = { userId: 'user-1', role: 'staff' as const, employeeId: 'emp-1' };

      jest.spyOn(Reimbursement, 'findByPk').mockResolvedValue(null);

      await expect(
        ReimbursementService.deleteRequest(auth as any, 'non-existent', '192.168.1.1')
      ).rejects.toThrow('Request reimburse tidak ditemukan');
    });

    it('deletes pending request', async () => {
      const auth = { userId: 'user-1', role: 'staff' as const, employeeId: 'emp-1' };

      const mockRequest = {
        id: 'reimb-1',
        employee_id: 'emp-1',
        status: 'pending',
        destroy: jest.fn().mockResolvedValue({}),
        getDataValue: (key: string) => {
          if (key === 'status') return 'pending';
          if (key === 'employee_id') return 'emp-1';
          if (key === 'receipt_url') return null;
          return undefined;
        },
      };

      jest.spyOn(Reimbursement, 'findByPk').mockResolvedValue(mockRequest as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ReimbursementService.deleteRequest(auth as any, 'reimb-1', '192.168.1.1');

      expect(mockRequest.destroy).toHaveBeenCalled();
    });

    it('prevents deleting approved request', async () => {
      const auth = { userId: 'user-1', role: 'staff' as const, employeeId: 'emp-1' };

      const mockRequest = {
        id: 'reimb-1',
        employee_id: 'emp-1',
        status: 'approved',
        getDataValue: (key: string) => {
          if (key === 'status') return 'approved';
          if (key === 'employee_id') return 'emp-1';
          return undefined;
        },
      };

      jest.spyOn(Reimbursement, 'findByPk').mockResolvedValue(mockRequest as any);

      await expect(
        ReimbursementService.deleteRequest(auth as any, 'reimb-1', '192.168.1.1')
      ).rejects.toThrow('Tidak punya akses untuk menghapus request ini');
    });
  });
});
