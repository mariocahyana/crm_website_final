import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as reimbursementController from './reimbursement.controller';
import ReimbursementService from '../services/reimbursement.service';
import * as responseUtils from '../utils/response';
import * as uploadUtils from '../middlewares/upload';

jest.mock('../services/reimbursement.service');
jest.mock('../utils/response');
jest.mock('../middlewares/upload');

describe('ReimbursementController', () => {
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

  describe('listReimbursements', () => {
    it('should return list of reimbursements when authenticated', async () => {
      const mockReimbursements = [{ id: 'reimburse-1', amount: 500000, status: 'pending' }];
      (ReimbursementService.listRequests as jest.Mock).mockResolvedValue(mockReimbursements);

      await reimbursementController.listReimbursements(mockReq as Request, mockRes as Response, mockNext);

      expect(ReimbursementService.listRequests).toHaveBeenCalledWith({
        userId: 'user-1',
        role: 'staff',
        employeeId: 'emp-1',
      });
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockReimbursements,
        'Request reimburse berhasil diambil'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;

      await reimbursementController.listReimbursements(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (ReimbursementService.listRequests as jest.Mock).mockRejectedValue(error);

      await reimbursementController.listReimbursements(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createReimbursement', () => {
    it('should create reimbursement request when authenticated', async () => {
      const mockFile = { filename: 'receipt-123.pdf' };
      (mockReq as any).file = mockFile;
      mockReq.body = { amount: 500000, description: 'Office supplies' };
      const mockReimbursement = { id: 'reimburse-1', status: 'pending' };
      (ReimbursementService.createRequest as jest.Mock).mockResolvedValue(mockReimbursement);

      await reimbursementController.createReimbursement(mockReq as Request, mockRes as Response, mockNext);

      expect(ReimbursementService.createRequest).toHaveBeenCalledWith(
        { userId: 'user-1', role: 'staff', employeeId: 'emp-1' },
        mockReq.body,
        mockFile,
        '127.0.0.1'
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockReimbursement,
        'Request reimburse berhasil dibuat',
        201
      );
    });

    it('should return unauthorized and delete file when not authenticated', async () => {
      mockReq.authUser = undefined;
      const mockFile = { filename: 'receipt-123.pdf' };
      (mockReq as any).file = mockFile;

      await reimbursementController.createReimbursement(mockReq as Request, mockRes as Response, mockNext);

      expect(uploadUtils.deleteReceiptFile).toHaveBeenCalledWith('receipt-123.pdf');
      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should delete file and handle service errors', async () => {
      const mockFile = { filename: 'receipt-123.pdf' };
      (mockReq as any).file = mockFile;
      mockReq.body = { amount: 500000 };
      const error = new Error('Invalid amount');
      (ReimbursementService.createRequest as jest.Mock).mockRejectedValue(error);

      await reimbursementController.createReimbursement(mockReq as Request, mockRes as Response, mockNext);

      expect(uploadUtils.deleteReceiptFile).toHaveBeenCalledWith('receipt-123.pdf');
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should create reimbursement without file', async () => {
      mockReq.body = { amount: 500000, description: 'Office supplies' };
      const mockReimbursement = { id: 'reimburse-1', status: 'pending' };
      (ReimbursementService.createRequest as jest.Mock).mockResolvedValue(mockReimbursement);

      await reimbursementController.createReimbursement(mockReq as Request, mockRes as Response, mockNext);

      expect(ReimbursementService.createRequest).toHaveBeenCalledWith(
        { userId: 'user-1', role: 'staff', employeeId: 'emp-1' },
        mockReq.body,
        undefined,
        '127.0.0.1'
      );
    });
  });
});
