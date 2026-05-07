import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

// Mock models BEFORE importing service
jest.mock('../models/index', () => ({
  LeaveType: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
    bulkCreate: jest.fn(),
  },
  LeaveRequest: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Employee: {
    findByPk: jest.fn(),
  },
  ActivityLog: {
    create: jest.fn(),
  },
}));

import { ActivityLog, Employee, LeaveRequest, LeaveType } from '../models/index';
import LeaveService from './leave.service';

describe('leave.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listTypes', () => {
    it('should return list of leave types', async () => {
      const mockTypes = [
        { id: 'type-1', name: 'Cuti Bersama', quota_type: 'unlimited' },
        { id: 'type-2', name: 'Cuti Tahunan', quota_type: 'yearly' },
      ];
      (LeaveType.findAll as jest.Mock).mockResolvedValue(mockTypes);

      const result = await LeaveService.listTypes();

      expect(result).toEqual(mockTypes);
      expect(LeaveType.findAll).toHaveBeenCalled();
    });

    it('should handle empty leave types', async () => {
      (LeaveType.findAll as jest.Mock).mockResolvedValue([]);

      const result = await LeaveService.listTypes();

      expect(result).toEqual([]);
      expect(LeaveType.findAll).toHaveBeenCalled();
    });
  });

  describe('listRequests', () => {
    it('should return all requests for admin', async () => {
      const auth = { userId: 'admin-1', role: 'admin' as const, employeeId: 'emp-admin' };
      const mockRequests = [
        { id: 'req-1', status: 'pending' },
        { id: 'req-2', status: 'approved' },
      ];
      (LeaveRequest.findAll as jest.Mock).mockResolvedValue(mockRequests);

      const result = await LeaveService.listRequests(auth as any);

      expect(result).toEqual(mockRequests);
      expect(LeaveRequest.findAll).toHaveBeenCalled();
    });

    it('should return only own requests for staff', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: 'emp-1' };
      const mockRequests = [{ id: 'req-1', employee_id: 'emp-1', status: 'pending' }];
      (LeaveRequest.findAll as jest.Mock).mockResolvedValue(mockRequests);

      const result = await LeaveService.listRequests(auth as any);

      expect(result).toEqual(mockRequests);
      expect(LeaveRequest.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employee_id: 'emp-1' }),
        })
      );
    });

    it('should return requests for manager department and subordinates', async () => {
      const auth = { userId: 'manager-1', role: 'manager' as const, employeeId: 'emp-manager' };
      (Employee.findByPk as jest.Mock).mockResolvedValue({
        id: 'emp-manager',
        department_id: 'dept-1',
      });
      (LeaveRequest.findAll as jest.Mock).mockResolvedValue([
        { id: 'req-1', employee_id: 'emp-sub1' },
      ]);

      const result = await LeaveService.listRequests(auth as any);

      expect(result).toEqual(expect.any(Array));
      expect(Employee.findByPk).toHaveBeenCalledWith('emp-manager', expect.any(Object));
      expect(LeaveRequest.findAll).toHaveBeenCalled();
    });
  });

  describe('createRequest', () => {
    it('should create leave request successfully', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: 'emp-1' };
      const input = {
        leave_type_id: 'type-1',
        start_date: '2025-04-01',
        end_date: '2025-04-05',
        reason: 'Personal reason',
      };

      (LeaveType.findByPk as jest.Mock).mockResolvedValue({ id: 'type-1' });
      (LeaveRequest.findOne as jest.Mock).mockResolvedValue(null);
      
      const mockCreated = {
        getDataValue: jest.fn((key: string) => key === 'id' ? 'req-1' : undefined),
      };
      (LeaveRequest.create as jest.Mock).mockResolvedValue(mockCreated);
      (LeaveRequest.findByPk as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: 'pending',
      });
      (ActivityLog.create as jest.Mock).mockResolvedValue({});

      const result = await LeaveService.createRequest(auth as any, input as any, '192.168.1.1');

      expect(result).toBeDefined();
      expect(LeaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employee_id: 'emp-1',
          leave_type_id: 'type-1',
          status: 'pending',
        })
      );
    });

    it('should fail when leave type not found', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: 'emp-1' };
      const input = {
        leave_type_id: 'invalid-type',
        start_date: '2025-04-01',
        end_date: '2025-04-05',
        reason: 'Personal reason',
      };

      (LeaveType.findByPk as jest.Mock).mockResolvedValue(null);

      await expect(
        LeaveService.createRequest(auth as any, input as any, '192.168.1.1')
      ).rejects.toThrow('Jenis cuti tidak ditemukan');
    });

    it('should fail when dates overlap with existing request', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: 'emp-1' };
      const input = {
        leave_type_id: 'type-1',
        start_date: '2025-04-01',
        end_date: '2025-04-05',
        reason: 'Personal reason',
      };

      (LeaveType.findByPk as jest.Mock).mockResolvedValue({ id: 'type-1' });
      (LeaveRequest.findOne as jest.Mock).mockResolvedValue({
        id: 'existing-req',
      });

      await expect(
        LeaveService.createRequest(auth as any, input as any, '192.168.1.1')
      ).rejects.toThrow('Tanggal cuti bertabrakan dengan request lain');
    });

    it('should fail when missing required fields', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: 'emp-1' };
      const input = {
        leave_type_id: 'type-1',
        start_date: '2025-04-01',
        end_date: undefined,
        reason: 'Personal reason',
      };

      await expect(
        LeaveService.createRequest(auth as any, input as any, '192.168.1.1')
      ).rejects.toThrow('Jenis cuti, tanggal mulai, dan tanggal selesai wajib diisi');
    });

    it('should fail when employee context not found', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: undefined };
      const input = {
        leave_type_id: 'type-1',
        start_date: '2025-04-01',
        end_date: '2025-04-05',
        reason: 'Personal reason',
      };

      await expect(
        LeaveService.createRequest(auth as any, input as any, '192.168.1.1')
      ).rejects.toThrow('Employee context tidak ditemukan');
    });
  });

  describe('decideRequest', () => {
    it('allows admin to approve staff request', async () => {
      const auth = { userId: 'admin-1', role: 'admin' as const, employeeId: 'emp-admin' };

      const mockRequest = {
        id: 'leave-1',
        getDataValue: (key: string) => (key === 'status' ? 'pending' : undefined),
        get: (key: string) => (key === 'employee' ? {
          id: 'emp-staff',
          manager_id: 'emp-manager',
          department_id: 'dept-1',
          user: { role: 'staff' },
        } : undefined),
        update: jest.fn().mockResolvedValue({} as never),
      };

      (Employee.findByPk as jest.Mock).mockResolvedValue({
        id: 'emp-admin',
        department_id: 'dept-1',
      });
      (LeaveRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest as any);
      (ActivityLog.create as jest.Mock).mockResolvedValue({});

      await LeaveService.decideRequest(auth as any, 'leave-1', {
        status: 'approved',
      } as any, '192.168.1.1');

      expect(mockRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved',
      }));
    });

    it('should fail when decision status invalid', async () => {
      const auth = { userId: 'admin-1', role: 'admin' as const, employeeId: 'emp-admin' };

      await expect(
        LeaveService.decideRequest(auth as any, 'leave-1', {
          status: 'invalid',
        } as any, '192.168.1.1')
      ).rejects.toThrow('Status harus approved atau declined');
    });

    it('should require decline reason when declining', async () => {
      const auth = { userId: 'admin-1', role: 'admin' as const, employeeId: 'emp-admin' };

      await expect(
        LeaveService.decideRequest(auth as any, 'leave-1', {
          status: 'declined',
          decline_reason: '',
        } as any, '192.168.1.1')
      ).rejects.toThrow('Alasan penolakan wajib diisi');
    });

    it('should fail when no employee context', async () => {
      const auth = { userId: 'admin-1', role: 'admin' as const, employeeId: undefined };

      await expect(
        LeaveService.decideRequest(auth as any, 'leave-1', {
          status: 'approved',
        } as any, '192.168.1.1')
      ).rejects.toThrow('Employee context tidak ditemukan');
    });
  });

  describe('cancelRequest', () => {
    it('should cancel pending request', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: 'emp-1' };

      const mockRequest = {
        id: 'leave-1',
        getDataValue: (key: string) => {
          if (key === 'status') return 'pending';
          if (key === 'employee_id') return 'emp-1';
          return undefined;
        },
        update: jest.fn().mockResolvedValue({} as never),
      };

      (LeaveRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest as any);
      (ActivityLog.create as jest.Mock).mockResolvedValue({});

      await LeaveService.cancelRequest(auth as any, 'leave-1', '192.168.1.1');

      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' })
      );
    });

    it('should fail when only can cancel pending requests', async () => {
      const auth = { userId: 'staff-1', role: 'staff' as const, employeeId: 'emp-1' };

      const mockRequest = {
        id: 'leave-1',
        getDataValue: (key: string) => {
          if (key === 'status') return 'approved';
          if (key === 'employee_id') return 'emp-1';
          return undefined;
        },
      };

      (LeaveRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest as any);

      await expect(
        LeaveService.cancelRequest(auth as any, 'leave-1', '192.168.1.1')
      ).rejects.toThrow();
    });
  });
});
