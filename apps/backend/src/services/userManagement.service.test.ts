import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { sequelize, User, Employee, Department, ActivityLog } from '../models/index';
import * as passwordUtils from '../utils/password';
import UserManagementService from './userManagement.service';

describe('userManagement.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) => callback({}));
    jest.spyOn(User, 'findAll');
    jest.spyOn(User, 'findOne');
    jest.spyOn(User, 'findByPk');
    jest.spyOn(User, 'create');
    jest.spyOn(Employee, 'findAll');
    jest.spyOn(Employee, 'findOne');
    jest.spyOn(Employee, 'findByPk');
    jest.spyOn(Employee, 'create');
    jest.spyOn(Department, 'findAll');
    jest.spyOn(Department, 'findByPk').mockResolvedValue(null);
    jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);
    jest.spyOn(passwordUtils, 'hashPassword');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getOptions', () => {
    it('returns departments list ordered by name', async () => {
      const mockDepartments = [
        { toJSON: () => ({ id: 'dept-1', name: 'HR' }) },
        { toJSON: () => ({ id: 'dept-2', name: 'IT' }) },
      ];

      const mockManagers = [
        { toJSON: () => ({ id: 'emp-1', full_name: 'John Manager', employee_number: 'EMP-001' }) },
      ];

      jest.spyOn(Department, 'findAll').mockResolvedValue(mockDepartments as any);
      jest.spyOn(Employee, 'findAll').mockResolvedValue(mockManagers as any);

      const result = await UserManagementService.getOptions();

      expect(result.departments).toHaveLength(2);
      expect(result.managers).toHaveLength(1);
      expect(Department.findAll).toHaveBeenCalled();
      expect(Employee.findAll).toHaveBeenCalled();
    });

    it('returns managers list', async () => {
      const mockDepartments = [
        { toJSON: () => ({ id: 'dept-1', name: 'HR' }) },
      ];
      const mockManagers = [
        { toJSON: () => ({ id: 'emp-1', full_name: 'John Manager', employee_number: 'EMP-001' }) },
      ];

      jest.spyOn(Department, 'findAll').mockResolvedValue(mockDepartments as any);
      jest.spyOn(Employee, 'findAll').mockResolvedValue(mockManagers as any);

      const result = await UserManagementService.getOptions();

      expect(result).toHaveProperty('managers');
      expect(Employee.findAll).toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    it('returns all users with employee data', async () => {
      const mockUsers = [
        {
          toJSON: () => ({
            id: 'user-1',
            email: 'user1@test.com',
            role: 'staff',
            is_active: true,
            created_at: '2026-05-01',
            employee: { id: 'emp-1', employee_number: 'EMP-001', full_name: 'John Doe' },
          }),
        },
      ];

      jest.spyOn(User, 'findAll').mockResolvedValue(mockUsers as any);

      const result = await UserManagementService.listUsers();

      expect(result).toHaveLength(1);
      expect(User.findAll).toHaveBeenCalled();
    });

    it('returns users ordered by created_at descending', async () => {
      jest.spyOn(User, 'findAll').mockResolvedValue([] as any);

      await UserManagementService.listUsers();

      expect(User.findAll).toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('throws error when email not provided', async () => {
      await expect(
        UserManagementService.createUser('admin-1', {
          password: 'pass123',
          full_name: 'John Doe',
          join_date: '2026-05-01',
          base_salary: 5000000,
          role: 'staff',
        } as any)
      ).rejects.toThrow('email, password, dan full_name wajib diisi');
    });

    it('throws error when email already registered', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({ id: 'user-1' } as any);

      await expect(
        UserManagementService.createUser('admin-1', {
          email: 'existing@test.com',
          password: 'pass123',
          full_name: 'John Doe',
          join_date: '2026-05-01',
          base_salary: 5000000,
          role: 'staff',
        } as any)
      ).rejects.toThrow('Email sudah terdaftar');
    });

    it('normalizes email to lowercase', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('hashed_pass');
      jest.spyOn(User, 'create').mockResolvedValue({
        getDataValue: (key: string) => (key === 'id' ? 'user-1' : undefined),
        toJSON: () => ({ id: 'user-1', email: 'user@test.com' }),
      } as any);
      jest.spyOn(Employee, 'create').mockResolvedValue({
        toJSON: () => ({ id: 'emp-1' }),
      } as any);

      await UserManagementService.createUser('admin-1', {
        email: 'User@Test.COM',
        password: 'pass123',
        full_name: 'John Doe',
        join_date: '2026-05-01',
        base_salary: 5000000,
        role: 'staff',
      } as any);

      expect(User.create).toHaveBeenCalled();
      expect((User.create as jest.Mock).mock.calls[0][0]).toMatchObject({ email: 'user@test.com' });
    });

    it('hashes password before storing', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('hashed_password');
      jest.spyOn(User, 'create').mockResolvedValue({
        getDataValue: (key: string) => (key === 'id' ? 'user-1' : undefined),
        toJSON: () => ({ id: 'user-1' }),
      } as any);
      jest.spyOn(Employee, 'create').mockResolvedValue({
        toJSON: () => ({ id: 'emp-1' }),
      } as any);

      await UserManagementService.createUser('admin-1', {
        email: 'user@test.com',
        password: 'secure123',
        full_name: 'John Doe',
        join_date: '2026-05-01',
        base_salary: 5000000,
        role: 'staff',
      } as any);

      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('secure123');
    });

    it('creates user with is_active true by default', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('hashed_pass');
      jest.spyOn(User, 'create').mockResolvedValue({
        getDataValue: (key: string) => (key === 'id' ? 'user-1' : undefined),
        toJSON: () => ({ id: 'user-1', is_active: true }),
      } as any);
      jest.spyOn(Employee, 'create').mockResolvedValue({
        toJSON: () => ({ id: 'emp-1' }),
      } as any);

      await UserManagementService.createUser('admin-1', {
        email: 'user@test.com',
        password: 'pass123',
        full_name: 'John Doe',
        join_date: '2026-05-01',
        base_salary: 5000000,
        role: 'staff',
      } as any);

      expect((User.create as jest.Mock).mock.calls[0][0]).toHaveProperty('is_active', true);
    });
  });

  describe('updateUser', () => {
    it('throws error when user not found', async () => {
      jest.spyOn(User, 'findByPk').mockResolvedValue(null);

      await expect(
        UserManagementService.updateUser('admin-1', 'non-existent', { email: 'new@test.com' } as any)
      ).rejects.toThrow('User tidak ditemukan');
    });

    it('updates user email', async () => {
      const targetUser = {
        getDataValue: (key: string) => (key === 'email' ? 'old@test.com' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      const targetEmployee = {
        getDataValue: (key: string) => (key === 'id' ? 'emp-1' : key === 'user_id' ? 'user-1' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValueOnce(targetUser as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'user-1', email: 'newemail@test.com', role: 'staff' }),
      } as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValueOnce(targetEmployee as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'emp-1', full_name: 'John Doe' }),
      } as any);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUser('admin-1', 'user-1', {
        email: 'newemail@test.com',
      } as any);

      expect(targetUser.update).toHaveBeenCalledWith({ email: 'newemail@test.com' }, expect.any(Object));
    });

    it('updates user role', async () => {
      const targetUser = {
        getDataValue: (key: string) => (key === 'email' ? 'old@test.com' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      const targetEmployee = {
        getDataValue: (key: string) => (key === 'id' ? 'emp-1' : key === 'user_id' ? 'user-1' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValueOnce(targetUser as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'user-1', role: 'manager' }),
      } as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValueOnce(targetEmployee as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'emp-1' }),
      } as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUser('admin-1', 'user-1', {
        role: 'manager',
      } as any);

      expect(targetUser.update).toHaveBeenCalledWith({ role: 'manager' }, expect.any(Object));
    });
  });

  describe('getUserTree', () => {
    it('returns tree with admins, managers with staff, and unassigned staff', async () => {
      const mockUsers = [
        {
          toJSON: () => ({
            id: 'user-1',
            email: 'admin@test.com',
            role: 'admin',
            employee: { id: 'emp-admin', full_name: 'Admin User', manager_id: null, department_id: null },
          }),
        },
        {
          toJSON: () => ({
            id: 'user-2',
            email: 'manager@test.com',
            role: 'manager',
            employee: { id: 'emp-manager', full_name: 'Manager User', manager_id: null, department_id: 'dept-1' },
          }),
        },
        {
          toJSON: () => ({
            id: 'user-3',
            email: 'staff1@test.com',
            role: 'staff',
            employee: { id: 'emp-staff1', full_name: 'Staff 1', manager_id: 'emp-manager', department_id: 'dept-1' },
          }),
        },
        {
          toJSON: () => ({
            id: 'user-4',
            email: 'staff2@test.com',
            role: 'staff',
            employee: { id: 'emp-staff2', full_name: 'Staff 2', manager_id: null, department_id: 'dept-1' },
          }),
        },
      ];

      jest.spyOn(User, 'findAll').mockResolvedValue(mockUsers as any);

      const result = await UserManagementService.getUserTree();

      expect(result).toHaveProperty('admins');
      expect(result).toHaveProperty('managers');
      expect(result).toHaveProperty('unassigned_staff');
      expect(result.admins).toHaveLength(1);
    });

    it('filters only active users', async () => {
      const mockUsers = [
        {
          toJSON: () => ({
            id: 'user-1',
            email: 'admin@test.com',
            role: 'admin',
            employee: null,
          }),
        },
      ];

      jest.spyOn(User, 'findAll').mockResolvedValue(mockUsers as any);

      const result = await UserManagementService.getUserTree();

      expect(User.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: true }),
        })
      );
    });

    it('handles users without employee records', async () => {
      const mockUsers = [
        {
          toJSON: () => ({
            id: 'user-1',
            email: 'admin@test.com',
            role: 'admin',
            employee: null,
          }),
        },
      ];

      jest.spyOn(User, 'findAll').mockResolvedValue(mockUsers as any);

      const result = await UserManagementService.getUserTree();

      expect(result.admins).toHaveLength(1);
      expect(result.admins[0].employee).toBeNull();
    });
  });

  describe('createUser - additional validation', () => {
    it('throws error when password not provided', async () => {
      await expect(
        UserManagementService.createUser('admin-1', {
          email: 'user@test.com',
          full_name: 'John Doe',
          join_date: '2026-05-01',
          base_salary: 5000000,
          role: 'staff',
        } as any)
      ).rejects.toThrow('email, password, dan full_name wajib diisi');
    });

    it('throws error when full_name not provided', async () => {
      await expect(
        UserManagementService.createUser('admin-1', {
          email: 'user@test.com',
          password: 'pass123',
          join_date: '2026-05-01',
          base_salary: 5000000,
          role: 'staff',
        } as any)
      ).rejects.toThrow('email, password, dan full_name wajib diisi');
    });

    it('throws error when join_date not provided', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      await expect(
        UserManagementService.createUser('admin-1', {
          email: 'user@test.com',
          password: 'pass123',
          full_name: 'John Doe',
          base_salary: 5000000,
          role: 'staff',
        } as any)
      ).rejects.toThrow('join_date dan base_salary wajib diisi');
    });

    it('throws error when base_salary not provided', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      await expect(
        UserManagementService.createUser('admin-1', {
          email: 'user@test.com',
          password: 'pass123',
          full_name: 'John Doe',
          join_date: '2026-05-01',
          role: 'staff',
        } as any)
      ).rejects.toThrow('join_date dan base_salary wajib diisi');
    });

    it('throws error when invalid role provided', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      await expect(
        UserManagementService.createUser('admin-1', {
          email: 'user@test.com',
          password: 'pass123',
          full_name: 'John Doe',
          join_date: '2026-05-01',
          base_salary: 5000000,
          role: 'invalid',
        } as any)
      ).rejects.toThrow('role harus admin, staff, atau manager');
    });

    it('generates employee number correctly', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('hashed_pass');
      jest.spyOn(User, 'create').mockResolvedValue({
        getDataValue: (key: string) => (key === 'id' ? 'user-1' : undefined),
        toJSON: () => ({ id: 'user-1' }),
      } as any);
      jest.spyOn(Employee, 'create').mockResolvedValue({
        toJSON: () => ({ id: 'emp-1', employee_number: 'EMP-01001' }),
      } as any);

      await UserManagementService.createUser('admin-1', {
        email: 'user@test.com',
        password: 'pass123',
        full_name: 'John Doe',
        join_date: '2026-05-01',
        base_salary: 5000000,
        role: 'staff',
      } as any);

      expect(Employee.create).toHaveBeenCalled();
    });
  });

  describe('updateUser - additional validation', () => {
    it('throws error when employee not found', async () => {
      jest.spyOn(User, 'findByPk').mockResolvedValue({} as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);

      await expect(
        UserManagementService.updateUser('admin-1', 'user-1', {})
      ).rejects.toThrow('Employee tidak ditemukan');
    });

    it('throws error when manager is self', async () => {
      const targetUser = {
        getDataValue: (key: string) => (key === 'email' ? 'user@test.com' : undefined),
      };
      const targetEmployee = {
        getDataValue: (key: string) => (key === 'id' ? 'emp-1' : undefined),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValueOnce(targetUser as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValueOnce(targetEmployee as any);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      await expect(
        UserManagementService.updateUser('admin-1', 'user-1', {
          manager_id: 'emp-1',
        } as any)
      ).rejects.toThrow('Manager tidak boleh diri sendiri');
    });

    it('updates user is_active status', async () => {
      const targetUser = {
        getDataValue: (key: string) => (key === 'email' ? 'user@test.com' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      const targetEmployee = {
        getDataValue: (key: string) => undefined,
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValueOnce(targetUser as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'user-1', is_active: false }),
      } as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValueOnce(targetEmployee as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'emp-1' }),
      } as any);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUser('admin-1', 'user-1', {
        is_active: false,
      } as any);

      expect(targetUser.update).toHaveBeenCalled();
    });

    it('updates employee fields', async () => {
      const targetUser = {
        getDataValue: (key: string) => (key === 'email' ? 'user@test.com' : undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      const targetEmployee = {
        getDataValue: (key: string) => undefined,
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValueOnce(targetUser as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'user-1' }),
      } as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValueOnce(targetEmployee as any).mockResolvedValueOnce({
        toJSON: () => ({ id: 'emp-1' }),
      } as any);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUser('admin-1', 'user-1', {
        full_name: 'Jane Doe',
        job_title: 'Senior Dev',
      } as any);

      expect(targetEmployee.update).toHaveBeenCalled();
    });
  });

  describe('updateUserStatus', () => {
    it('throws error when user not found', async () => {
      jest.spyOn(User, 'findByPk').mockResolvedValue(null);

      await expect(
        UserManagementService.updateUserStatus('admin-1', 'non-existent', true)
      ).rejects.toThrow('User tidak ditemukan');
    });

    it('activates user', async () => {
      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUserStatus('admin-1', 'user-1', true);

      expect(mockUser.update).toHaveBeenCalledWith({ is_active: true }, expect.any(Object));
    });

    it('deactivates user', async () => {
      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUserStatus('admin-1', 'user-1', false);

      expect(mockUser.update).toHaveBeenCalledWith({ is_active: false }, expect.any(Object));
    });

    it('logs status change activity', async () => {
      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUserStatus('admin-1', 'user-1', false);

      expect(ActivityLog.create).toHaveBeenCalled();
    });

    it('also deactivates employee if exists', async () => {
      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };
      const mockEmployee = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUserStatus('admin-1', 'user-1', false);

      expect(mockEmployee.update).toHaveBeenCalledWith({ is_active: false }, expect.any(Object));
    });

    it('logs USER_ACTIVATE action when activating', async () => {
      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUserStatus('admin-1', 'user-1', true);

      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_ACTIVATE',
        }),
        expect.any(Object)
      );
    });

    it('logs USER_DEACTIVATE action when deactivating', async () => {
      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);
      jest.spyOn(ActivityLog, 'create').mockResolvedValue({} as any);

      await UserManagementService.updateUserStatus('admin-1', 'user-1', false);

      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_DEACTIVATE',
        }),
        expect.any(Object)
      );
    });
  });
});