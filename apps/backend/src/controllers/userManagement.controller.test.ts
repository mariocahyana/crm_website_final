import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as userManagementController from './userManagement.controller';
import UserManagementService from '../services/userManagement.service';
import * as responseUtils from '../utils/response';

jest.mock('../services/userManagement.service');
jest.mock('../utils/response');

describe('UserManagementController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      query: {},
      params: {},
      authUser: { id: 'user-1', email: 'user@example.com', role: 'admin' },
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUserTree', () => {
    it('should return user hierarchy tree', async () => {
      const mockTree = [
        {
          id: 'user-1',
          email: 'admin@example.com',
          children: [
            { id: 'user-2', email: 'manager@example.com', children: [] },
          ],
        },
      ];
      (UserManagementService.getUserTree as jest.Mock).mockResolvedValue(mockTree);

      await userManagementController.getUserTree(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockTree,
        'User tree berhasil diambil'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (UserManagementService.getUserTree as jest.Mock).mockRejectedValue(error);

      await userManagementController.getUserTree(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('listUsers', () => {
    it('should return list of all users', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'admin@example.com', role: 'admin', is_active: true },
        { id: 'user-2', email: 'manager@example.com', role: 'manager', is_active: true },
        { id: 'user-3', email: 'staff@example.com', role: 'staff', is_active: true },
      ];
      (UserManagementService.listUsers as jest.Mock).mockResolvedValue(mockUsers);

      await userManagementController.listUsers(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUsers,
        'Daftar user berhasil diambil'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (UserManagementService.listUsers as jest.Mock).mockRejectedValue(error);

      await userManagementController.listUsers(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getUserOptions', () => {
    it('should return user management options', async () => {
      const mockOptions = {
        roles: ['admin', 'manager', 'staff'],
        departments: [
          { id: 'dept-1', name: 'IT' },
          { id: 'dept-2', name: 'HR' },
        ],
      };
      (UserManagementService.getOptions as jest.Mock).mockResolvedValue(mockOptions);

      await userManagementController.getUserOptions(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockOptions,
        'Opsi user management berhasil diambil'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (UserManagementService.getOptions as jest.Mock).mockRejectedValue(error);

      await userManagementController.getUserOptions(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createUser', () => {
    it('should create new user when authenticated', async () => {
      mockReq.body = {
        email: 'newuser@example.com',
        password: 'password123',
        role: 'staff',
      };
      const mockUser = { id: 'user-4', email: 'newuser@example.com', role: 'staff' };
      (UserManagementService.createUser as jest.Mock).mockResolvedValue(mockUser);

      await userManagementController.createUser(mockReq as Request, mockRes as Response, mockNext);

      expect(UserManagementService.createUser).toHaveBeenCalledWith('user-1', mockReq.body);
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUser,
        'User berhasil dibuat',
        201
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.body = { email: 'newuser@example.com', password: 'password123', role: 'staff' };

      await userManagementController.createUser(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { email: 'existing@example.com', password: 'password123', role: 'staff' };
      const error = new Error('Email already exists');
      (UserManagementService.createUser as jest.Mock).mockRejectedValue(error);

      await userManagementController.createUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateUser', () => {
    it('should update user when authenticated', async () => {
      mockReq.params = { userId: 'user-2' };
      mockReq.body = { email: 'updated@example.com', role: 'manager' };
      const mockUser = { id: 'user-2', email: 'updated@example.com', role: 'manager' };
      (UserManagementService.updateUser as jest.Mock).mockResolvedValue(mockUser);

      await userManagementController.updateUser(mockReq as Request, mockRes as Response, mockNext);

      expect(UserManagementService.updateUser).toHaveBeenCalledWith('user-1', 'user-2', mockReq.body);
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUser,
        'User berhasil diperbarui'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { userId: 'user-2' };

      await userManagementController.updateUser(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { userId: 'user-2' };
      mockReq.body = { email: 'updated@example.com' };
      const error = new Error('User not found');
      (UserManagementService.updateUser as jest.Mock).mockRejectedValue(error);

      await userManagementController.updateUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateUserStatus', () => {
    it('should deactivate user when is_active is false', async () => {
      mockReq.params = { userId: 'user-2' };
      mockReq.body = { is_active: false };
      const mockUser = { id: 'user-2', email: 'user2@example.com', is_active: false };
      (UserManagementService.updateUserStatus as jest.Mock).mockResolvedValue(mockUser);

      await userManagementController.updateUserStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(UserManagementService.updateUserStatus).toHaveBeenCalledWith('user-1', 'user-2', false);
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUser,
        'Status user berhasil diperbarui'
      );
    });

    it('should activate user when is_active is true', async () => {
      mockReq.params = { userId: 'user-2' };
      mockReq.body = { is_active: true };
      const mockUser = { id: 'user-2', email: 'user2@example.com', is_active: true };
      (UserManagementService.updateUserStatus as jest.Mock).mockResolvedValue(mockUser);

      await userManagementController.updateUserStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(UserManagementService.updateUserStatus).toHaveBeenCalledWith('user-1', 'user-2', true);
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { userId: 'user-2' };
      mockReq.body = { is_active: false };

      await userManagementController.updateUserStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should return error when is_active is not boolean', async () => {
      mockReq.params = { userId: 'user-2' };
      mockReq.body = { is_active: 'true' };

      await userManagementController.updateUserStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'is_active harus boolean',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should return error when is_active is missing', async () => {
      mockReq.params = { userId: 'user-2' };
      mockReq.body = {};

      await userManagementController.updateUserStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'is_active harus boolean',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { userId: 'user-2' };
      mockReq.body = { is_active: false };
      const error = new Error('Cannot deactivate admin');
      (UserManagementService.updateUserStatus as jest.Mock).mockRejectedValue(error);

      await userManagementController.updateUserStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
