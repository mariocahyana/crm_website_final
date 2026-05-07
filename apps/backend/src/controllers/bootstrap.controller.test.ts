import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as bootstrapController from './bootstrap.controller';
import BootstrapService from '../services/bootstrap.service';
import * as responseUtils from '../utils/response';

jest.mock('../services/bootstrap.service');
jest.mock('../utils/response');

describe('BootstrapController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      query: {},
      params: {},
      authUser: { id: 'user-1', email: 'user@example.com', role: 'staff', employeeId: 'emp-1' },
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBootstrap', () => {
    it('should return bootstrap data when authenticated', async () => {
      const mockBootstrapData = {
        user: { id: 'user-1', role: 'staff' },
        employee: { id: 'emp-1', name: 'John Doe' },
        permissions: ['view_own_data'],
      };
      (BootstrapService.getBootstrap as jest.Mock).mockResolvedValue(mockBootstrapData);

      await bootstrapController.getBootstrap(mockReq as Request, mockRes as Response, mockNext);

      expect(BootstrapService.getBootstrap).toHaveBeenCalledWith({
        userId: 'user-1',
        role: 'staff',
        employeeId: 'emp-1',
      });
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockBootstrapData,
        'Bootstrap data'
      );
    });

    it('should handle undefined employeeId', async () => {
      mockReq.authUser = { id: 'user-1', email: 'user@example.com', role: 'admin' };
      const mockBootstrapData = {
        user: { id: 'user-1', role: 'admin' },
        permissions: ['admin_access'],
      };
      (BootstrapService.getBootstrap as jest.Mock).mockResolvedValue(mockBootstrapData);

      await bootstrapController.getBootstrap(mockReq as Request, mockRes as Response, mockNext);

      expect(BootstrapService.getBootstrap).toHaveBeenCalledWith({
        userId: 'user-1',
        role: 'admin',
        employeeId: undefined,
      });
    });

    it('should return unauthorized when user not authenticated', async () => {
      mockReq.authUser = undefined;

      await bootstrapController.getBootstrap(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should return unauthorized when role is missing', async () => {
      mockReq.authUser = { id: 'user-1', email: 'user@example.com' };

      await bootstrapController.getBootstrap(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (BootstrapService.getBootstrap as jest.Mock).mockRejectedValue(error);

      await bootstrapController.getBootstrap(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
