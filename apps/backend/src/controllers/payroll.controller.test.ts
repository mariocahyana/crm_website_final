import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as payrollController from './payroll.controller';
import PayrollService from '../services/payroll.service';
import * as responseUtils from '../utils/response';

jest.mock('../services/payroll.service');
jest.mock('../utils/response');

describe('PayrollController', () => {
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

  describe('listPeriods', () => {
    it('should return list of payroll periods', async () => {
      const mockPeriods = [
        { id: 'period-1', month: 5, year: 2026, status: 'draft' },
        { id: 'period-2', month: 6, year: 2026, status: 'finalized' },
      ];
      (PayrollService.listPeriods as jest.Mock).mockResolvedValue(mockPeriods);

      await payrollController.listPeriods(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPeriods,
        'Payroll periods fetched'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (PayrollService.listPeriods as jest.Mock).mockRejectedValue(error);

      await payrollController.listPeriods(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createPeriod', () => {
    it('should create payroll period when authenticated', async () => {
      mockReq.body = { month: 5, year: 2026 };
      const mockPeriod = { id: 'period-1', month: 5, year: 2026, status: 'draft' };
      (PayrollService.createPeriod as jest.Mock).mockResolvedValue(mockPeriod);

      await payrollController.createPeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.createPeriod).toHaveBeenCalledWith({
        month: 5,
        year: 2026,
        actorId: 'user-1',
      });
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPeriod,
        'Payroll period created',
        201
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.body = { month: 5, year: 2026 };

      await payrollController.createPeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { month: 5, year: 2026 };
      const error = new Error('Period already exists');
      (PayrollService.createPeriod as jest.Mock).mockRejectedValue(error);

      await payrollController.createPeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('generatePeriod', () => {
    it('should generate payslips when authenticated', async () => {
      mockReq.params = { periodId: 'period-1' };
      const mockPayslips = [
        { id: 'payslip-1', employee_id: 'emp-1', amount: 5000000 },
        { id: 'payslip-2', employee_id: 'emp-2', amount: 4500000 },
      ];
      (PayrollService.generatePeriod as jest.Mock).mockResolvedValue(mockPayslips);

      await payrollController.generatePeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.generatePeriod).toHaveBeenCalledWith('period-1', 'user-1');
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPayslips,
        'Payslips generated'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { periodId: 'period-1' };

      await payrollController.generatePeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { periodId: 'period-1' };
      const error = new Error('Period not found');
      (PayrollService.generatePeriod as jest.Mock).mockRejectedValue(error);

      await payrollController.generatePeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('finalizePeriod', () => {
    it('should finalize payroll period', async () => {
      mockReq.params = { periodId: 'period-1' };
      const mockResult = { id: 'period-1', status: 'finalized' };
      (PayrollService.finalizePeriod as jest.Mock).mockResolvedValue(mockResult);

      await payrollController.finalizePeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.finalizePeriod).toHaveBeenCalledWith('period-1');
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockResult,
        'Payroll period finalized'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { periodId: 'period-1' };
      const error = new Error('Cannot finalize period');
      (PayrollService.finalizePeriod as jest.Mock).mockRejectedValue(error);

      await payrollController.finalizePeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('listPayslips', () => {
    it('should return list of payslips for period', async () => {
      mockReq.params = { periodId: 'period-1' };
      const mockPayslips = [
        { id: 'payslip-1', employee_id: 'emp-1', amount: 5000000 },
        { id: 'payslip-2', employee_id: 'emp-2', amount: 4500000 },
      ];
      (PayrollService.listPayslips as jest.Mock).mockResolvedValue(mockPayslips);

      await payrollController.listPayslips(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.listPayslips).toHaveBeenCalledWith('period-1');
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPayslips,
        'Payslips fetched'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { periodId: 'period-1' };
      const error = new Error('Period not found');
      (PayrollService.listPayslips as jest.Mock).mockRejectedValue(error);

      await payrollController.listPayslips(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getPayslipDetail', () => {
    it('should return payslip detail', async () => {
      mockReq.params = { payslipId: 'payslip-1' };
      const mockPayslip = {
        id: 'payslip-1',
        employee_id: 'emp-1',
        amount: 5000000,
        items: [],
      };
      (PayrollService.getPayslipDetail as jest.Mock).mockResolvedValue(mockPayslip);

      await payrollController.getPayslipDetail(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.getPayslipDetail).toHaveBeenCalledWith('payslip-1');
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPayslip,
        'Payslip detail fetched'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { payslipId: 'payslip-1' };
      const error = new Error('Payslip not found');
      (PayrollService.getPayslipDetail as jest.Mock).mockRejectedValue(error);

      await payrollController.getPayslipDetail(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('listMyPayslips', () => {
    it('should return list of my payslips when authenticated', async () => {
      mockReq.query = { periodId: 'period-1' };
      const mockPayslips = [{ id: 'payslip-1', employee_id: 'emp-1', amount: 5000000 }];
      (PayrollService.listMyPayslips as jest.Mock).mockResolvedValue(mockPayslips);

      await payrollController.listMyPayslips(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.listMyPayslips).toHaveBeenCalledWith(
        'user-1',
        undefined,
        'period-1'
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPayslips,
        'My payslips fetched'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.query = { periodId: 'period-1' };

      await payrollController.listMyPayslips(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.query = { periodId: 'period-1' };
      const error = new Error('Database error');
      (PayrollService.listMyPayslips as jest.Mock).mockRejectedValue(error);

      await payrollController.listMyPayslips(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getMyPayslipDetail', () => {
    it('should return my payslip detail when authenticated', async () => {
      mockReq.params = { payslipId: 'payslip-1' };
      const mockPayslip = { id: 'payslip-1', amount: 5000000, items: [] };
      (PayrollService.getMyPayslipDetail as jest.Mock).mockResolvedValue(mockPayslip);

      await payrollController.getMyPayslipDetail(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.getMyPayslipDetail).toHaveBeenCalledWith(
        'user-1',
        'payslip-1',
        undefined
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPayslip,
        'My payslip detail fetched'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { payslipId: 'payslip-1' };

      await payrollController.getMyPayslipDetail(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { payslipId: 'payslip-1' };
      const error = new Error('Access denied');
      (PayrollService.getMyPayslipDetail as jest.Mock).mockRejectedValue(error);

      await payrollController.getMyPayslipDetail(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('addManualItem', () => {
    it('should add manual item to payslip when authenticated', async () => {
      mockReq.params = { payslipId: 'payslip-1' };
      mockReq.body = { type: 'bonus', amount: 500000, description: 'Performance bonus' };
      const mockPayslip = { id: 'payslip-1', items: [{ type: 'bonus', amount: 500000 }] };
      (PayrollService.addManualItem as jest.Mock).mockResolvedValue(mockPayslip);

      await payrollController.addManualItem(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.addManualItem).toHaveBeenCalledWith(
        'user-1',
        'payslip-1',
        expect.objectContaining({ type: 'bonus', amount: 500000 })
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPayslip,
        'Manual payroll item added'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { payslipId: 'payslip-1' };

      await payrollController.addManualItem(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { payslipId: 'payslip-1' };
      mockReq.body = { type: 'bonus', amount: 500000 };
      const error = new Error('Invalid payslip');
      (PayrollService.addManualItem as jest.Mock).mockRejectedValue(error);

      await payrollController.addManualItem(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('addManualItemToPeriod', () => {
    it('should add manual item to period when authenticated', async () => {
      mockReq.params = { periodId: 'period-1' };
      mockReq.body = { employee_id: 'emp-1', type: 'bonus', amount: 500000 };
      const mockResult = { id: 'item-1', type: 'bonus' };
      (PayrollService.addManualItemToPeriod as jest.Mock).mockResolvedValue(mockResult);

      await payrollController.addManualItemToPeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.addManualItemToPeriod).toHaveBeenCalledWith(
        'user-1',
        'period-1',
        expect.objectContaining({ employee_id: 'emp-1', type: 'bonus', amount: 500000 })
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockResult,
        'Manual payroll item added to period',
        201
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { periodId: 'period-1' };

      await payrollController.addManualItemToPeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { periodId: 'period-1' };
      mockReq.body = { employee_id: 'emp-1', type: 'bonus', amount: 500000 };
      const error = new Error('Invalid period');
      (PayrollService.addManualItemToPeriod as jest.Mock).mockRejectedValue(error);

      await payrollController.addManualItemToPeriod(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteManualItem', () => {
    it('should delete manual item when authenticated', async () => {
      mockReq.params = { payslipId: 'payslip-1', itemId: 'item-1' };
      const mockPayslip = { id: 'payslip-1', items: [] };
      (PayrollService.deleteManualItem as jest.Mock).mockResolvedValue(mockPayslip);

      await payrollController.deleteManualItem(mockReq as Request, mockRes as Response, mockNext);

      expect(PayrollService.deleteManualItem).toHaveBeenCalledWith('user-1', 'payslip-1', 'item-1');
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPayslip,
        'Manual payroll item deleted'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { payslipId: 'payslip-1', itemId: 'item-1' };

      await payrollController.deleteManualItem(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { payslipId: 'payslip-1', itemId: 'item-1' };
      const error = new Error('Item not found');
      (PayrollService.deleteManualItem as jest.Mock).mockRejectedValue(error);

      await payrollController.deleteManualItem(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
