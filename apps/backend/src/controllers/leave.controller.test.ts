import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as leaveController from './leave.controller';
import LeaveService from '../services/leave.service';
import * as responseUtils from '../utils/response';

jest.mock('../services/leave.service');
jest.mock('../utils/response');

describe('LeaveController', () => {
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
      ip: '127.0.0.1',
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listLeaveTypes', () => {
    it('should return list of leave types', async () => {
      const mockLeaveTypes = [
        { id: 'type-1', name: 'Cuti Tahunan', days: 12 },
        { id: 'type-2', name: 'Cuti Sakit', days: 30 },
      ];
      (LeaveService.listTypes as jest.Mock).mockResolvedValue(mockLeaveTypes);

      await leaveController.listLeaveTypes(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockLeaveTypes,
        'Jenis cuti berhasil diambil'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (LeaveService.listTypes as jest.Mock).mockRejectedValue(error);

      await leaveController.listLeaveTypes(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('listLeaveRequests', () => {
    it('should return leave requests when authenticated', async () => {
      const mockRequests = [{ id: 'req-1', type: 'Cuti Tahunan', status: 'pending' }];
      (LeaveService.listRequests as jest.Mock).mockResolvedValue(mockRequests);

      await leaveController.listLeaveRequests(mockReq as Request, mockRes as Response, mockNext);

      expect(LeaveService.listRequests).toHaveBeenCalledWith({
        userId: 'user-1',
        role: 'staff',
        employeeId: 'emp-1',
      });
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockRequests,
        'Request cuti berhasil diambil'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;

      await leaveController.listLeaveRequests(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (LeaveService.listRequests as jest.Mock).mockRejectedValue(error);

      await leaveController.listLeaveRequests(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createLeaveRequest', () => {
    it('should create leave request when authenticated', async () => {
      mockReq.body = {
        type_id: 'type-1',
        start_date: '2026-05-10',
        end_date: '2026-05-15',
        reason: 'Personal',
      };
      const mockRequest = { id: 'req-1', status: 'pending' };
      (LeaveService.createRequest as jest.Mock).mockResolvedValue(mockRequest);

      await leaveController.createLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(LeaveService.createRequest).toHaveBeenCalledWith(
        { userId: 'user-1', role: 'staff', employeeId: 'emp-1' },
        mockReq.body,
        '127.0.0.1'
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockRequest,
        'Request cuti berhasil dibuat',
        201
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;

      await leaveController.createLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { type_id: 'type-1', start_date: '2026-05-10', end_date: '2026-05-15' };
      const error = new Error('Invalid leave request');
      (LeaveService.createRequest as jest.Mock).mockRejectedValue(error);

      await leaveController.createLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('decideLeaveRequest', () => {
    it('should approve leave request when authenticated', async () => {
      mockReq.params = { requestId: 'req-1' };
      mockReq.body = { decision: 'approved', notes: 'Approved' };
      const mockRequest = { id: 'req-1', status: 'approved' };
      (LeaveService.decideRequest as jest.Mock).mockResolvedValue(mockRequest);

      await leaveController.decideLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(LeaveService.decideRequest).toHaveBeenCalledWith(
        { userId: 'user-1', role: 'staff', employeeId: 'emp-1' },
        'req-1',
        mockReq.body,
        '127.0.0.1'
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockRequest,
        'Request cuti berhasil diproses'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { requestId: 'req-1' };

      await leaveController.decideLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { requestId: 'req-1' };
      mockReq.body = { decision: 'approved' };
      const error = new Error('Request not found');
      (LeaveService.decideRequest as jest.Mock).mockRejectedValue(error);

      await leaveController.decideLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('cancelLeaveRequest', () => {
    it('should cancel leave request when authenticated', async () => {
      mockReq.params = { requestId: 'req-1' };
      const mockRequest = { id: 'req-1', status: 'cancelled' };
      (LeaveService.cancelRequest as jest.Mock).mockResolvedValue(mockRequest);

      await leaveController.cancelLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(LeaveService.cancelRequest).toHaveBeenCalledWith(
        { userId: 'user-1', role: 'staff', employeeId: 'emp-1' },
        'req-1',
        '127.0.0.1'
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockRequest,
        'Request cuti berhasil dibatalkan'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { requestId: 'req-1' };

      await leaveController.cancelLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { requestId: 'req-1' };
      const error = new Error('Cannot cancel approved request');
      (LeaveService.cancelRequest as jest.Mock).mockRejectedValue(error);

      await leaveController.cancelLeaveRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
