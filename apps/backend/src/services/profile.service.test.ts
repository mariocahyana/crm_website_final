import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ActivityLog, Employee } from '../models/index';
import * as uploadUtils from '../middlewares/upload';
import ProfileService from './profile.service';

describe('profile.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Employee, 'findByPk');
    jest.spyOn(ActivityLog, 'create');
    jest.spyOn(uploadUtils, 'getReceiptUrl');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateMyProfile', () => {
    it('throws error when employee not found', async () => {
      jest.spyOn(Employee, 'findByPk').mockResolvedValue(null);

      await expect(
        ProfileService.updateMyProfile('user-1', 'emp-1', { full_name: 'John' }, undefined, '192.168.1.1')
      ).rejects.toThrow('Employee not found');
    });

    it('updates only whitelisted fields for self', async () => {
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'emp-1', full_name: 'John Doe' }),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ProfileService.updateMyProfile(
        'user-1',
        'emp-1',
        { full_name: 'John Doe', role: 'admin' },
        undefined,
        '192.168.1.1'
      );

      expect(mockEmployee.update).toHaveBeenCalledWith({ full_name: 'John Doe' });
    });

    it('prevents role change attempt', async () => {
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'emp-1', role: 'staff' }),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ProfileService.updateMyProfile(
        'user-1',
        'emp-1',
        { role: 'admin' },
        undefined,
        '192.168.1.1'
      );

      const updateArgs = (mockEmployee.update as jest.Mock).mock.calls[0][0];
      expect(updateArgs).not.toHaveProperty('role');
    });

    it('updates phone number', async () => {
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'emp-1', phone: '081234567890' }),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ProfileService.updateMyProfile(
        'user-1',
        'emp-1',
        { phone: '081234567890' },
        undefined,
        '192.168.1.1'
      );

      expect(mockEmployee.update).toHaveBeenCalledWith({ phone: '081234567890' });
    });

    it('returns updated employee data', async () => {
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'emp-1', full_name: 'John Doe' }),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      const result = await ProfileService.updateMyProfile(
        'user-1',
        'emp-1',
        { full_name: 'John Doe' },
        undefined,
        '192.168.1.1'
      );

      expect(result).toHaveProperty('message', 'Profile berhasil diperbarui');
      expect(result).toHaveProperty('employee');
    });
  });

  describe('updateEmployeeProfile', () => {
    it('throws error when employee not found', async () => {
      jest.spyOn(Employee, 'findByPk').mockResolvedValue(null);

      await expect(
        ProfileService.updateEmployeeProfile('admin-1', 'non-existent', { full_name: 'Jane' }, undefined, '192.168.1.1')
      ).rejects.toThrow('Employee not found');
    });

    it('prevents updating salary via profile endpoint', async () => {
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'emp-1', base_salary: 5000000 }),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ProfileService.updateEmployeeProfile(
        'admin-1',
        'emp-1',
        { base_salary: 10000000 },
        undefined,
        '192.168.1.1'
      );

      const updateArgs = (mockEmployee.update as jest.Mock).mock.calls[0][0];
      expect(updateArgs).not.toHaveProperty('base_salary');
    });

    it('logs UPDATE_PROFILE_ADMIN activity', async () => {
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'emp-1' }),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await ProfileService.updateEmployeeProfile(
        'admin-1',
        'emp-1',
        { full_name: 'Jane Doe' },
        undefined,
        '192.168.1.1'
      );

      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_PROFILE_ADMIN', target_id: 'emp-1' }),
      );
    });

    it('returns updated employee data with confirmation message', async () => {
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'emp-1', full_name: 'Jane Doe' }),
      };

      jest.spyOn(Employee, 'findByPk').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      const result = await ProfileService.updateEmployeeProfile(
        'admin-1',
        'emp-1',
        { full_name: 'Jane Doe' },
        undefined,
        '192.168.1.1'
      );

      expect(result).toHaveProperty('message', 'Profile employee berhasil diperbarui');
      expect(result).toHaveProperty('employee');
    });
  });
});
