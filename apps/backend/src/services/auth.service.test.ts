import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { User, PasswordResetToken, Employee } from '../models/index';
import * as passwordUtils from '../utils/password';
import * as jwtUtils from '../utils/jwt';
import AuthService from './auth.service';

function makeMockUser(data: {
  id: string;
  email: string;
  password_hash?: string;
  role: 'admin' | 'staff' | 'manager';
  is_active: boolean;
  employee?: any | null;
}) {
  return {
    update: jest.fn().mockResolvedValue({}),
    getDataValue: (key: string) => {
      const values: Record<string, any> = {
        id: data.id,
        email: data.email,
        password_hash: data.password_hash,
        role: data.role,
        is_active: data.is_active,
      };
      return values[key];
    },
    get: (key: string) => (key === 'employee' ? (data.employee ?? null) : undefined),
  };
}

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

      const includedEmployee = {
        id: 'employee-1',
        full_name: 'Staff One',
        user_id: 'user-1',
        phone: '08123456789',
        address: 'Jl. Test 123',
        photo_url: null,
        join_date: '2026-01-01',
        job_title: 'Staff',
      };

      jest.spyOn(User, 'unscoped').mockReturnValue({
        findOne: jest.fn().mockResolvedValue(makeMockUser({
          id: 'user-1',
          email: 'staff@example.com',
          password_hash: '$2b$10$IfFQaAy6W6KbIOcvFKYh4u.fkxXd21qrLsYxWblA3UXYFTw7/uWPq',
          role: 'staff',
          is_active: true,
          employee: includedEmployee,
        })),
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
        employee: includedEmployee,
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
        findOne: jest.fn().mockResolvedValue(makeMockUser({
          id: 'user-1',
          email: 'staff@example.com',
          password_hash: '$2b$10$IfFQaAy6W6KbIOcvFKYh4u.fkxXd21qrLsYxWblA3UXYFTw7/uWPq',
          role: 'staff',
          is_active: true,
          employee: null,
        })),
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
        role: 'staff',
        getDataValue: (key: string) => {
          if (key === 'id') return 'user-1';
          if (key === 'role') return 'staff';
          return undefined;
        },
      } as any);
      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(null as any);
      jest.spyOn(PasswordResetToken, 'create').mockResolvedValue({
        id: 'token-1',
      } as any);

      const result = await AuthService.generatePasswordReset('staff@example.com');

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'staff@example.com' } });
      expect(PasswordResetToken.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('throws error when request is already pending', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: 'user-1',
        email: 'staff@example.com',
        role: 'staff',
        getDataValue: (key: string) => {
          if (key === 'id') return 'user-1';
          if (key === 'role') return 'staff';
          return undefined;
        },
      } as any);
      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue({
        id: 'token-1',
      } as any);

      await expect(
        AuthService.generatePasswordReset('staff@example.com'),
      ).rejects.toThrow('Reset password masih pending, tidak bisa request lagi');
    });

    it('throws error when admin requests password reset', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        getDataValue: (key: string) => {
          if (key === 'id') return 'admin-1';
          if (key === 'role') return 'admin';
          return undefined;
        },
      } as any);

      await expect(
        AuthService.generatePasswordReset('admin@example.com'),
      ).rejects.toThrow('Admin tidak dapat melakukan reset password');
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
        isApproved: jest.fn().mockReturnValue(true),
        update: jest.fn().mockResolvedValue({}),
      };

      const mockUser = makeMockUser({
        id: 'user-1',
        email: 'user-1@example.com',
        role: 'staff',
        is_active: true,
        employee: null,
      });

      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(mockToken as any);
      jest.spyOn(User, 'findByPk').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('new-hashed-password');

      const result = await AuthService.resetPassword('token-value', 'newpassword123');

      expect(mockUser.update).toHaveBeenCalledWith({ password_hash: 'new-hashed-password' });
      expect(mockToken.update).toHaveBeenCalledWith({ used_at: expect.any(Date) });
      expect(result).toBe(true);
    });

    it('throws error when token has not been approved by admin', async () => {
      const mockToken = {
        getDataValue: (key: string) => (key === 'user_id' ? 'user-1' : undefined),
        isValid: jest.fn().mockReturnValue(true),
        isApproved: jest.fn().mockReturnValue(false),
      };

      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(mockToken as any);

      await expect(
        AuthService.resetPassword('token-value', 'newpassword123'),
      ).rejects.toThrow('Token belum disetujui admin');
    });

    it('throws error when admin tries to reset password', async () => {
      const mockToken = {
        getDataValue: (key: string) => (key === 'user_id' ? 'admin-1' : undefined),
        isValid: jest.fn().mockReturnValue(true),
        isApproved: jest.fn().mockReturnValue(true),
      };

      jest.spyOn(PasswordResetToken, 'findOne').mockResolvedValue(mockToken as any);
      jest.spyOn(User, 'findByPk').mockResolvedValue({
        getDataValue: (key: string) => (key === 'role' ? 'admin' : undefined),
      } as any);

      await expect(
        AuthService.resetPassword('token-value', 'newpassword123'),
      ).rejects.toThrow('Admin tidak dapat melakukan reset password');
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
        isApproved: jest.fn().mockReturnValue(true),
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
      const includedEmployee = {
        id: 'employee-1',
        full_name: 'Staff One',
        user_id: 'user-1',
        phone: '08123456789',
        address: 'Jl. Test 123',
        photo_url: null,
        join_date: '2026-01-01',
        job_title: 'Staff',
      };

      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue(makeMockUser({
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
          is_active: true,
          employee: includedEmployee,
        })),
      } as any);

      const result = await AuthService.getMe('user-1');

      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
        },
        employee: includedEmployee,
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
        findByPk: jest.fn().mockResolvedValue(makeMockUser({
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
          is_active: false,
          employee: null,
        })),
      } as any);

      await expect(AuthService.getMe('user-1')).rejects.toThrow('Akun Anda telah dinonaktifkan');
    });

    it('returns user data without employee if employee not found', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue(makeMockUser({
          id: 'user-1',
          email: 'staff@example.com',
          role: 'staff',
          is_active: true,
          employee: null,
        })),
      } as any);

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

  describe('changePassword', () => {
    it('changes password successfully for non-admin user', async () => {
      const mockUser = makeMockUser({
        id: 'user-1',
        email: 'staff@example.com',
        password_hash: '$2b$10$IfFQaAy6W6KbIOcvFKYh4u.fkxXd21qrLsYxWblA3UXYFTw7/uWPq',
        role: 'staff',
        is_active: true,
        employee: null,
      });

      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue(mockUser),
      } as any);
      jest.spyOn(passwordUtils, 'comparePassword').mockResolvedValue(true);
      jest.spyOn(passwordUtils, 'hashPassword').mockResolvedValue('new-hashed-password');

      const result = await AuthService.changePassword('user-1', 'oldpass', 'newpass123');

      expect(mockUser.update).toHaveBeenCalledWith({ password_hash: 'new-hashed-password' });
      expect(result).toBe(true);
    });

    it('throws error when admin tries to change password', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue(makeMockUser({
          id: 'admin-1',
          email: 'admin@example.com',
          password_hash: '$2b$10$IfFQaAy6W6KbIOcvFKYh4u.fkxXd21qrLsYxWblA3UXYFTw7/uWPq',
          role: 'admin',
          is_active: true,
          employee: null,
        })),
      } as any);

      await expect(
        AuthService.changePassword('admin-1', 'oldpass', 'newpass123'),
      ).rejects.toThrow('Admin tidak dapat mengubah password');
    });

    it('throws error when old password is incorrect', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue(makeMockUser({
          id: 'user-1',
          email: 'staff@example.com',
          password_hash: '$2b$10$IfFQaAy6W6KbIOcvFKYh4u.fkxXd21qrLsYxWblA3UXYFTw7/uWPq',
          role: 'staff',
          is_active: true,
          employee: null,
        })),
      } as any);
      jest.spyOn(passwordUtils, 'comparePassword').mockResolvedValue(false);

      await expect(
        AuthService.changePassword('user-1', 'wrongpass', 'newpass123'),
      ).rejects.toThrow('Password saat ini tidak sesuai');
    });

    it('throws error when user not found', async () => {
      jest.spyOn(User, 'unscoped').mockReturnValue({
        findByPk: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        AuthService.changePassword('non-existent', 'oldpass', 'newpass123'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('getPendingResets', () => {
    it('returns list of pending password reset requests', async () => {
      const mockPendingResets = [
        {
          id: 'token-1',
          toJSON: jest.fn().mockReturnValue({
            id: 'token-1',
            user_id: 'user-1',
            created_at: new Date(),
          }),
        },
        {
          id: 'token-2',
          toJSON: jest.fn().mockReturnValue({
            id: 'token-2',
            user_id: 'user-2',
            created_at: new Date(),
          }),
        },
      ];

      jest.spyOn(PasswordResetToken, 'findAll').mockResolvedValue(mockPendingResets as any);

      const result = await AuthService.getPendingResets();

      expect(result).toHaveLength(2);
      expect(PasswordResetToken.findAll).toHaveBeenCalled();
    });

    it('returns empty array when no pending resets', async () => {
      jest.spyOn(PasswordResetToken, 'findAll').mockResolvedValue([]);

      const result = await AuthService.getPendingResets();

      expect(result).toEqual([]);
    });
  });

  describe('approveReset', () => {
    it('approves password reset request', async () => {
      const mockToken = {
        isValid: jest.fn().mockReturnValue(true),
        isApproved: jest.fn().mockReturnValue(false),
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(PasswordResetToken, 'findByPk').mockResolvedValue(mockToken as any);

      const result = await AuthService.approveReset('token-1', 'admin-1');

      expect(mockToken.update).toHaveBeenCalledWith({
        approved_by: 'admin-1',
        approved_at: expect.any(Date),
      });
      expect(result).toBe(true);
    });

    it('throws error when reset token not found', async () => {
      jest.spyOn(PasswordResetToken, 'findByPk').mockResolvedValue(null);

      await expect(
        AuthService.approveReset('invalid-token', 'admin-1'),
      ).rejects.toThrow('Reset request not found');
    });

    it('throws error when token is expired or used', async () => {
      const mockToken = {
        isValid: jest.fn().mockReturnValue(false),
      };

      jest.spyOn(PasswordResetToken, 'findByPk').mockResolvedValue(mockToken as any);

      await expect(
        AuthService.approveReset('expired-token', 'admin-1'),
      ).rejects.toThrow('Token sudah expired atau sudah digunakan');
    });

    it('throws error when token already approved', async () => {
      const mockToken = {
        isValid: jest.fn().mockReturnValue(true),
        isApproved: jest.fn().mockReturnValue(true),
      };

      jest.spyOn(PasswordResetToken, 'findByPk').mockResolvedValue(mockToken as any);

      await expect(
        AuthService.approveReset('approved-token', 'admin-1'),
      ).rejects.toThrow('Request ini sudah diapprove sebelumnya');
    });
  });

  describe('rejectReset', () => {
    it('rejects password reset request', async () => {
      const mockToken = {
        update: jest.fn().mockResolvedValue({}),
      };

      jest.spyOn(PasswordResetToken, 'findByPk').mockResolvedValue(mockToken as any);

      const result = await AuthService.rejectReset('token-1');

      expect(mockToken.update).toHaveBeenCalledWith({ used_at: expect.any(Date) });
      expect(result).toBe(true);
    });

    it('throws error when reset token not found', async () => {
      jest.spyOn(PasswordResetToken, 'findByPk').mockResolvedValue(null);

      await expect(
        AuthService.rejectReset('invalid-token'),
      ).rejects.toThrow('Reset request not found');
    });
  });
});