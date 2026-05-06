import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ActivityLog, Employee, LeaveRequest, LeaveType } from '../models/index';
import LeaveService from './leave.service';

describe('leave.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Employee, 'findByPk');
    jest.spyOn(LeaveRequest, 'findAll');
    jest.spyOn(LeaveRequest, 'findByPk');
    jest.spyOn(LeaveRequest, 'create');
    jest.spyOn(LeaveType, 'count');
    jest.spyOn(LeaveType, 'bulkCreate');
    jest.spyOn(LeaveType, 'findAll');
    jest.spyOn(ActivityLog, 'create');
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue({
        id: 'emp-admin',
        department_id: 'dept-1',
      } as any);
      jest.spyOn(LeaveRequest, 'findByPk').mockResolvedValue(mockRequest as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await LeaveService.decideRequest(auth as any, 'leave-1', {
        status: 'approved',
      } as any, '192.168.1.1');

      expect(mockRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved',
        approved_by: 'emp-admin',
      }));
    });

    it('rejects manager request unless handled by admin', async () => {
      const auth = { userId: 'manager-1', role: 'manager' as const, employeeId: 'emp-manager' };

      const mockRequest = {
        id: 'leave-2',
        getDataValue: (key: string) => (key === 'status' ? 'pending' : undefined),
        get: (key: string) => (key === 'employee' ? {
          id: 'emp-manager-2',
          manager_id: 'emp-manager',
          department_id: 'dept-1',
          user: { role: 'manager' },
        } : undefined),
        update: jest.fn(),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue({
        id: 'emp-manager',
        department_id: 'dept-1',
      } as any);
      jest.spyOn(LeaveRequest, 'findByPk').mockResolvedValue(mockRequest as any);

      await expect(
        LeaveService.decideRequest(auth as any, 'leave-2', {
          status: 'approved',
        } as any, '192.168.1.1')
      ).rejects.toThrow('Request cuti manager hanya bisa diproses oleh admin');
    });

    it('allows manager to process staff request from the same department', async () => {
      const auth = { userId: 'manager-1', role: 'manager' as const, employeeId: 'emp-manager' };

      const mockRequest = {
        id: 'leave-3',
        getDataValue: (key: string) => (key === 'status' ? 'pending' : undefined),
        get: (key: string) => (key === 'employee' ? {
          id: 'emp-staff',
          manager_id: 'emp-other',
          department_id: 'dept-1',
          user: { role: 'staff' },
        } : undefined),
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue({
        id: 'emp-manager',
        department_id: 'dept-1',
      } as any);
      jest.spyOn(LeaveRequest, 'findByPk').mockResolvedValue(mockRequest as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await LeaveService.decideRequest(auth as any, 'leave-3', {
        status: 'declined',
        decline_reason: 'Tidak sesuai jadwal',
      } as any, '192.168.1.1');

      expect(mockRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'declined',
        approved_by: 'emp-manager',
      }));
    });
  });
});
