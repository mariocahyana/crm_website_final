import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as authController from './auth.controller';
import AuthService from '../services/auth.service';
import * as responseUtils from '../utils/response';

jest.mock('../services/auth.service');
jest.mock('../utils/response');

describe('AuthController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      query: {},
      params: {},
      authUser: { id: 'user-1', email: 'user@example.com', role: 'staff' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('login', () => {
    it('should return login successful with token and user data', async () => {
      mockReq.body = { email: 'user@example.com', password: 'password123' };
      (AuthService.login as jest.Mock).mockResolvedValue({
        token: 'jwt-token',
        user: { id: 'user-1', email: 'user@example.com', role: 'staff' },
        employee: { id: 'emp-1', full_name: 'John Doe' },
      });

      await authController.login(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({ token: 'jwt-token' }),
        'Login successful'
      );
    });

    it('should return error when email is missing', async () => {
      mockReq.body = { password: 'password123' };

      await authController.login(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Email and password required',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should return error when password is missing', async () => {
      mockReq.body = { email: 'user@example.com' };

      await authController.login(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Email and password required',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should call next with error if service throws', async () => {
      mockReq.body = { email: 'user@example.com', password: 'password123' };
      const error = new Error('Service error');
      (AuthService.login as jest.Mock).mockRejectedValue(error);

      await authController.login(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset link when email exists', async () => {
      mockReq.body = { email: 'user@example.com' };
      (AuthService.generatePasswordReset as jest.Mock).mockResolvedValue('reset-token-123');

      await authController.forgotPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({ reset_token: 'reset-token-123' }),
        'Forgot password email sent'
      );
    });

    it('should return error when email is missing', async () => {
      mockReq.body = {};

      await authController.forgotPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Email required',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { email: 'user@example.com' };
      const error = new Error('Service error');
      (AuthService.generatePasswordReset as jest.Mock).mockRejectedValue(error);

      await authController.forgotPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockReq.body = { token: 'reset-token', newPassword: 'newpassword123' };
      (AuthService.resetPassword as jest.Mock).mockResolvedValue(undefined);

      await authController.resetPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({ message: 'Password berhasil diperbarui' }),
        'Password reset successful'
      );
    });

    it('should return error when token is missing', async () => {
      mockReq.body = { newPassword: 'newpassword123' };

      await authController.resetPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Token and newPassword required',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should return error when newPassword is missing', async () => {
      mockReq.body = { token: 'reset-token' };

      await authController.resetPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Token and newPassword required',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { token: 'reset-token', newPassword: 'newpassword123' };
      const error = new Error('Invalid token');
      (AuthService.resetPassword as jest.Mock).mockRejectedValue(error);

      await authController.resetPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getPendingResets', () => {
    it('should return pending reset requests', async () => {
      const mockResets = [{ id: 'reset-1', email: 'user@example.com' }];
      (AuthService.getPendingResets as jest.Mock).mockResolvedValue(mockResets);

      await authController.getPendingResets(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockResets,
        'Pending reset requests berhasil diambil'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (AuthService.getPendingResets as jest.Mock).mockRejectedValue(error);

      await authController.getPendingResets(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('approveReset', () => {
    it('should approve reset request when authenticated', async () => {
      mockReq.params = { resetId: 'reset-1' };
      (AuthService.approveReset as jest.Mock).mockResolvedValue(undefined);

      await authController.approveReset(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        { approved: true },
        'Reset request berhasil diapprove'
      );
    });

    it('should return unauthorized when user not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { resetId: 'reset-1' };

      await authController.approveReset(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { resetId: 'reset-1' };
      const error = new Error('Reset not found');
      (AuthService.approveReset as jest.Mock).mockRejectedValue(error);

      await authController.approveReset(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('rejectReset', () => {
    it('should reject reset request', async () => {
      mockReq.params = { resetId: 'reset-1' };
      (AuthService.rejectReset as jest.Mock).mockResolvedValue(undefined);

      await authController.rejectReset(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        { rejected: true },
        'Reset request berhasil ditolak'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { resetId: 'reset-1' };
      const error = new Error('Reset not found');
      (AuthService.rejectReset as jest.Mock).mockRejectedValue(error);

      await authController.rejectReset(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully when authenticated', async () => {
      mockReq.body = { currentPassword: 'oldpass', newPassword: 'newpass' };
      (AuthService.changePassword as jest.Mock).mockResolvedValue(undefined);

      await authController.changePassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        { changed: true },
        'Password berhasil diubah'
      );
    });

    it('should return unauthorized when user not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.body = { currentPassword: 'oldpass', newPassword: 'newpass' };

      await authController.changePassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should return error when currentPassword is missing', async () => {
      mockReq.body = { newPassword: 'newpass' };

      await authController.changePassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'currentPassword dan newPassword wajib diisi',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should return error when newPassword is missing', async () => {
      mockReq.body = { currentPassword: 'oldpass' };

      await authController.changePassword(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'currentPassword dan newPassword wajib diisi',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { currentPassword: 'oldpass', newPassword: 'newpass' };
      const error = new Error('Invalid current password');
      (AuthService.changePassword as jest.Mock).mockRejectedValue(error);

      await authController.changePassword(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('me', () => {
    it('should return user profile when authenticated', async () => {
      const mockUserProfile = { id: 'user-1', email: 'user@example.com', role: 'staff' };
      (AuthService.getMe as jest.Mock).mockResolvedValue(mockUserProfile);

      await authController.me(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUserProfile,
        'Profile fetched'
      );
    });

    it('should return unauthorized when user not authenticated', async () => {
      mockReq.authUser = undefined;

      await authController.me(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('User not found');
      (AuthService.getMe as jest.Mock).mockRejectedValue(error);

      await authController.me(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
