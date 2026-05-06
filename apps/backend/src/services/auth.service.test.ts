import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { User, PasswordResetToken, Employee } from '../models/index';
import * as passwordUtils from '../utils/password';
import * as jwtUtils from '../utils/jwt';
import AuthService from './auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('login', () => {
    it('returns token, user, and employee data on successful login', async () => {
      jest.spyOn(passwordUtils, 'comparePassword').mockResolvedValue(true);
      jest.spyOn(jwtUtils, 'signJwt').mockReturnValue('signed-token');

      jest.spyOn(User, 'unscoped').mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'staff@example.com',
          password_hash: '$2b$10$IfFQaAy6W6KbIOcvFKYh4u.fkxXd21qrLsYxWblA3UXYFTw7/uWPq',
          role: 'staff',
          is_active: true,
        }),
        update: jest.fn().mockResolvedValue([1]),
      } as any);

      jest.spyOn(Employee, 'findOne').mockResolvedValue({
        toJSON: () => ({
          id: 'employee-1',
          full_name: 'Staff One',
        }),
      } as any);

      const result = await AuthService.login({
        email: 'staff@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        token: 'signed-token',
        user: {
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
        },
        employee: {
          id: 'employee-1',
          full_name: 'Staff One',
        },
      });

      expect(passwordUtils.comparePassword).toHaveBeenCalled();
      expect(jwtUtils.signJwt).toHaveBeenCalled();
    });

    it('throws error when user not found or inactive', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        AuthService.login({
          email: 'notfound@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Akun Anda telah dinonaktifkan atau kredensial tidak valid');
    });

    it('throws error on invalid password', async () => {
      jest.spyOn(passwordUtils, 'comparePassword').mockResolvedValue(false);

      jest.spyOn(User, 'unscoped').mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'staff@example.com',
          password_hash: '$2b$10$IfFQaAy6W6KbIOcvFKYh4u.fkxXd21qrLsYxWblA3UXYFTw7/uWPq',
          role: 'staff',
          is_active: true,
        }),
      } as any);

      await expect(
        AuthService.login({
          email: 'staff@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('createUser', () => {
    it('creates a new user with default role staff', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('hashed-password');
      jest.spyOn(User, 'create').mockResolvedValue({
        id: 'user-new',
        email: 'new@example.com',
        role: 'staff',
      } as any);

      const result = await AuthService.createUser({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(User.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password_hash: 'hashed-password',
        role: 'staff',
      });
      expect(result).toHaveProperty('id', 'user-new');
    });

    it('creates a new user with specified role', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('hashed-password');
      jest.spyOn(User, 'create').mockResolvedValue({
        id: 'user-admin',
        email: 'admin@example.com',
        role: 'admin',
      } as any);

      const result = await AuthService.createUser({
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      });

      expect(User.create).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password_hash: 'hashed-password',
        role: 'admin',
      });
      expect(result.role).toBe('admin');
    });

    it('throws error if email already exists', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: 'user-existing',
        email: 'existing@example.com',
      } as any);

      await expect(
        AuthService.createUser({
          email: 'existing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('generatePasswordReset', () => {
    it('generates a password reset token for valid user', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: 'user-1',
        email: 'staff@example.com',
        getDataValue: (key: string) => (key === 'id' ? 'user-1' : undefined),
      } as any);
      jest.spyOn(PasswordResetToken, 'create').mockResolvedValue({
        id: 'token-1',
      } as any);

      const result = await AuthService.generatePasswordReset('staff@example.com');

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'staff@example.com' } });
      expect(PasswordResetToken.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('throws error when user not found', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      await expect(
        AuthService.generatePasswordReset('notfound@example.com'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      const mockToken = {
        getDataValue: (key: string) => (key === 'user_id' ? 'user-1' : undefined),
        isValid: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue({}),
      };

      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(mockToken as any);
      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('new-hashed-password');

      const result = await AuthService.resetPassword('token-value', 'newpassword123');

      expect(mockUser.update).toHaveBeenCalledWith({ password_hash: 'new-hashed-password' });
      expect(mockToken.update).toHaveBeenCalledWith({ used_at: expect.any(Date) });
      expect(result).toBe(true);
    });

    it('throws error when token not found', async () => {
      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(null);

      await expect(
        AuthService.resetPassword('invalid-token', 'newpassword123'),
      ).rejects.toThrow('Invalid token');
    });

    it('throws error when token is expired or used', async () => {
      const mockToken = {
        isValid: jest.fn().mockReturnValue(false),
      };

      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(mockToken as any);

      await expect(
        AuthService.resetPassword('expired-token', 'newpassword123'),
      ).rejects.toThrow('Token expired or used');
    });

    it('throws error when user not found during reset', async () => {
      const mockToken = {
        getDataValue: (key: string) => (key === 'user_id' ? 'user-1' : undefined),
        isValid: jest.fn().mockReturnValue(true),
      };

      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(mockToken as any);
      jest.spyOn(User, 'findByPk').mockResolvedValue(null);

      await expect(
        AuthService.resetPassword('token-value', 'newpassword123'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('getMe', () => {
    it('returns user and employee data for valid user', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
          is_active: true,
        }),
      } as any);

      jest.spyOn(Employee, 'findOne').mockResolvedValue({
        toJSON: () => ({
          id: 'employee-1',
          full_name: 'Staff One',
          department_id: 'dept-1',
        }),
      } as any);

      const result = await AuthService.getMe('user-1');

      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
        },
        employee: {
          id: 'employee-1',
          full_name: 'Staff One',
          department_id: 'dept-1',
        },
      });
    });

    it('throws error when user not found', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(AuthService.getMe('non-existent')).rejects.toThrow('User not found');
    });

    it('throws error when user is inactive', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
          is_active: false,
        }),
      } as any);

      await expect(AuthService.getMe('user-1')).rejects.toThrow('Akun Anda telah dinonaktifkan');
    });

    it('returns user data without employee if employee not found', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
          is_active: true,
        }),
      } as any);

      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);

      const result = await AuthService.getMe('user-1');

      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
        },
        employee: null,
      });
    });
  });
});