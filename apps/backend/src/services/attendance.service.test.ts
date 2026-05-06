import { beforeEach, describe, expect, it, afterEach, jest } from '@jest/globals';
import { sequelize, Attendance, Employee, QrToken, User } from '../models/index';
import * as timezoneUtils from '../utils/timezone';
import { ValidationError, NotFoundError } from '../utils/errors';
import AttendanceService from './attendance.service';

// Spy on timezone utilities
jest.spyOn(timezoneUtils, 'getNowInJakarta');
jest.spyOn(timezoneUtils, 'getAttendanceDateInJakarta');
jest.spyOn(timezoneUtils, 'isAfter10AM');

describe('attendance.service', () => {
  const mockNow = new Date('2026-05-05T09:00:00+07:00');
  const mockToday = '2026-05-05';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(timezoneUtils, 'getNowInJakarta').mockReturnValue(mockNow);
    jest.spyOn(timezoneUtils, 'getAttendanceDateInJakarta').mockReturnValue(mockToday);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAdminQrCode', () => {
    it('returns existing valid QR code when available', async () => {
      const mockQrToken = {
        id: 'qr-1',
        token: 'abc123def456',
        valid_for_date: mockToday,
        expires_at: new Date('2026-05-05T09:15:00+07:00'),
        created_by: 'admin-1',
      };

      jest.spyOn(QrToken, 'findOne').mockResolvedValue(mockQrToken as any);

      const result = await AttendanceService.getAdminQrCode('admin-1', false);

      expect(result).toMatchObject({
        token: expect.any(String),
        valid_for_date: mockToday,
        expires_at: expect.any(Date),
      });
      expect(result.id).toBe('qr-1');
      expect(QrToken.findOne).toHaveBeenCalled();
    });

    it('generates new QR code when none exists', async () => {
      jest.spyOn(QrToken, 'findOne').mockResolvedValue(null);

      jest.spyOn(QrToken, 'create').mockResolvedValue({
        id: 'qr-new',
        token: 'abcdef123456', // HARUS string (Jest gak bisa expect.any di mock value)
        valid_for_date: mockToday,
        expires_at: new Date(),
        created_by: 'admin-1',
      } as any);

      const result = await AttendanceService.getAdminQrCode('admin-1', false);

      expect(result).toHaveProperty('token');
      expect(result.token).toMatch(/^[a-f0-9]+$/);
      expect(QrToken.create).toHaveBeenCalled();
    });
  });

  describe('scanQrCode', () => {
    it('throws validation error when QR token is empty', async () => {
      await expect(
        AttendanceService.scanQrCode('user-1', '   ')
      ).rejects.toThrow('QR token wajib diisi');
    });

    it('throws not found error when employee does not exist', async () => {
      jest.spyOn(Employee, 'findOne').mockResolvedValue(null);

      jest.spyOn(sequelize, 'transaction').mockResolvedValue({
        rollback: jest.fn(),
      } as any);

      await expect(
        AttendanceService.scanQrCode('user-1', 'valid-token')
      ).rejects.toThrow('Data karyawan tidak ditemukan');
    });

    it('throws validation error when QR token is invalid or expired', async () => {
      const mockEmployee = {
        getDataValue: jest.fn().mockReturnValue('emp-1'),
      };

      jest.spyOn(Employee, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(QrToken, 'findOne').mockResolvedValue(null);

      const mockTransaction = {
        LOCK: { UPDATE: {} },
        rollback: jest.fn(),
        commit: jest.fn(),
      };

      jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTransaction as any);

      await expect(
        AttendanceService.scanQrCode('user-1', 'invalid-token')
      ).rejects.toThrow('QR token tidak valid atau sudah kedaluwarsa');
    });

    it('records attendance successfully on valid QR scan', async () => {
      const mockEmployee = {
        getDataValue: jest.fn((key) => {
          const values: any = { id: 'emp-1' };
          return values[key];
        }),
        toJSON: () => ({ id: 'emp-1', name: 'John Doe' }),
      };

      const mockQrToken = {
        id: 'qr-1',
        token: 'valid-token',
        valid_for_date: mockToday,
        expires_at: new Date('2026-05-05T10:00:00+07:00'),
        scanned_by: null,
        is_used: false,
        update: jest.fn().mockResolvedValue({}),
      };

      const mockAttendance = {
        toJSON: () => ({
          id: 'att-1',
          employee_id: 'emp-1',
          date: mockToday,
          check_in_at: mockNow,
          status: 'present',
        }),
      };

      jest.spyOn(Employee, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(QrToken, 'findOne').mockResolvedValue(mockQrToken as any);
      jest.spyOn(Attendance, 'findOne').mockResolvedValue(null);
      jest.spyOn(Attendance, 'create').mockResolvedValue(mockAttendance as any);

      const mockTransaction = {
        LOCK: { UPDATE: {} },
        rollback: jest.fn(),
        commit: jest.fn(),
      };

      jest.spyOn(sequelize, 'transaction').mockResolvedValue(mockTransaction as any);

      const result = await AttendanceService.scanQrCode('user-1', 'valid-token');

      expect(result).toHaveProperty('attendance');
      expect(result).toHaveProperty('employee');
      expect(result).toHaveProperty('qrToken');
      expect(Attendance.create).toHaveBeenCalled();
    });
  });

  describe('getAttendanceHistory', () => {
    it('retrieves attendance for specified month and year', async () => {
      const mockRecords = [
        { employee_id: 'emp-1', date: mockToday, status: 'present' },
        { employee_id: 'emp-1', date: '2026-05-04', status: 'present' },
      ];

      jest.spyOn(Attendance, 'findAll').mockResolvedValue(mockRecords as any);

      const result = await AttendanceService.getAttendanceHistory({
        month: 5,
        year: 2026,
      });

      expect(result).toBeDefined();
      expect(Attendance.findAll).toHaveBeenCalled();
    });

    it('filters by employee when employeeId provided', async () => {
      jest.spyOn(Attendance, 'findAll').mockResolvedValue([]);

      await AttendanceService.getAttendanceHistory({
        month: 5,
        year: 2026,
        employee_id: 'emp-1',
      });

      expect(Attendance.findAll).toHaveBeenCalled();
    });
  });
});