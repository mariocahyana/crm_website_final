import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as attendanceController from './attendance.controller';
import AttendanceService from '../services/attendance.service';
import * as responseUtils from '../utils/response';

jest.mock('../services/attendance.service');
jest.mock('../utils/response');

describe('AttendanceController', () => {
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
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAdminQrCode', () => {
    it('should return QR code when user is authenticated', async () => {
      const mockQrCode = { token: 'qr123', valid_for_date: '2026-05-05', expires_at: new Date() };
      (AttendanceService.getAdminQrCode as jest.Mock).mockResolvedValue(mockQrCode);

      await attendanceController.getAdminQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(AttendanceService.getAdminQrCode).toHaveBeenCalledWith('user-1', false);
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockQrCode,
        'QR code absensi berhasil diambil'
      );
    });

    it('should force refresh when force_refresh query param is true', async () => {
      mockReq.query = { force_refresh: 'true' };
      const mockQrCode = { token: 'qr123', valid_for_date: '2026-05-05', expires_at: new Date() };
      (AttendanceService.getAdminQrCode as jest.Mock).mockResolvedValue(mockQrCode);

      await attendanceController.getAdminQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(AttendanceService.getAdminQrCode).toHaveBeenCalledWith('user-1', true);
    });

    it('should return unauthorized when user not authenticated', async () => {
      mockReq.authUser = undefined;

      await attendanceController.getAdminQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      (AttendanceService.getAdminQrCode as jest.Mock).mockRejectedValue(error);

      await attendanceController.getAdminQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('scanQrCode', () => {
    it('should record attendance successfully', async () => {
      mockReq.body = { token: 'qr-token-123' };
      const mockResult = { id: 'attendance-1', timestamp: new Date(), status: 'checkin' };
      (AttendanceService.scanQrCode as jest.Mock).mockResolvedValue(mockResult);

      await attendanceController.scanQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(AttendanceService.scanQrCode).toHaveBeenCalledWith('user-1', 'qr-token-123');
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockResult,
        'Absensi berhasil dicatat'
      );
    });

    it('should return unauthorized when user not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.body = { token: 'qr-token-123' };

      await attendanceController.scanQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should return error when token is missing', async () => {
      mockReq.body = {};

      await attendanceController.scanQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'QR token required',
        400,
        'VALIDATION_ERROR'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { token: 'invalid-token' };
      const error = new Error('Invalid QR token');
      (AttendanceService.scanQrCode as jest.Mock).mockRejectedValue(error);

      await attendanceController.scanQrCode(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getAttendanceHistory', () => {
    it('should return attendance history with month and year filters', async () => {
      mockReq.query = { month: '5', year: '2026', employee_id: 'emp-1' };
      const mockHistory = [{ date: '2026-05-01', status: 'present' }];
      (AttendanceService.getAttendanceHistory as jest.Mock).mockResolvedValue(mockHistory);

      await attendanceController.getAttendanceHistory(mockReq as Request, mockRes as Response, mockNext);

      expect(AttendanceService.getAttendanceHistory).toHaveBeenCalledWith({
        month: 5,
        year: 2026,
        employee_id: 'emp-1',
      });
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockHistory,
        'Riwayat absensi berhasil diambil'
      );
    });

    it('should return attendance history without filters', async () => {
      mockReq.query = {};
      const mockHistory = [{ date: '2026-05-01', status: 'present' }];
      (AttendanceService.getAttendanceHistory as jest.Mock).mockResolvedValue(mockHistory);

      await attendanceController.getAttendanceHistory(mockReq as Request, mockRes as Response, mockNext);

      expect(AttendanceService.getAttendanceHistory).toHaveBeenCalledWith({});
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockHistory,
        'Riwayat absensi berhasil diambil'
      );
    });

    it('should filter by employee_id only', async () => {
      mockReq.query = { employee_id: 'emp-1' };
      const mockHistory = [{ date: '2026-05-01', status: 'present' }];
      (AttendanceService.getAttendanceHistory as jest.Mock).mockResolvedValue(mockHistory);

      await attendanceController.getAttendanceHistory(mockReq as Request, mockRes as Response, mockNext);

      expect(AttendanceService.getAttendanceHistory).toHaveBeenCalledWith({
        employee_id: 'emp-1',
      });
    });

    it('should handle service errors', async () => {
      mockReq.query = { month: '5', year: '2026' };
      const error = new Error('Database error');
      (AttendanceService.getAttendanceHistory as jest.Mock).mockRejectedValue(error);

      await attendanceController.getAttendanceHistory(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
