import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  sequelize,
  Attendance,
  Employee,
  EmployeeSchedule,
  QrToken,
  WorkSchedule,
} from '../models/index';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import {
  getNowInJakarta,
  getTodayInJakarta,
  isAfter6PM,
  isAfter2AM,
} from '../utils/timezone';

type QrTokenRecord = {
  id: string;
  token: string;
  valid_for_date: string;
  expires_at: Date;
  created_by: string;
  is_used: boolean;
  scanned_by?: string;
};

class AttendanceService {
  static async getAdminQrCode(actorId: string, forceRefresh = false) {
    const today = getTodayInJakarta();
    const now = getNowInJakarta();

    if (forceRefresh) {
      await QrToken.update(
        { is_used: true },
        {
          where: {
            valid_for_date: today,
            is_used: false,
            scanned_by: null,
            expires_at: { [Op.gt]: now },
          },
        },
      );
    }

    const existingToken = await QrToken.findOne({
      where: {
        valid_for_date: today,
        is_used: false,
        scanned_by: null,
        expires_at: { [Op.gt]: now },
      },
      order: [['created_at', 'DESC']],
    }) as QrTokenRecord | null;

    if (existingToken && !forceRefresh) {
      return {
        id: existingToken.id,
        token: existingToken.token,
        valid_for_date: existingToken.valid_for_date,
        expires_at: existingToken.expires_at,
        created_by: existingToken.created_by,
      };
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const createdToken = await QrToken.create({
      token,
      valid_for_date: today,
      expires_at: expiresAt,
      created_by: actorId,
    }) as unknown as QrTokenRecord;

    return {
      id: createdToken.id,
      token: createdToken.token,
      valid_for_date: createdToken.valid_for_date,
      expires_at: createdToken.expires_at,
      created_by: createdToken.created_by,
    };
  }

  static async scanQrCode(userId: string, qrTokenValue: string) {
    const token = qrTokenValue.trim();
    if (!token) {
      throw new ValidationError('QR token wajib diisi');
    }

    // Check for 6 PM cutoff - max absence at 6 PM
    if (isAfter6PM()) {
      throw new AppError('Absensi tutup setelah jam 6 sore, silakan absen hari berikutnya', 403, 'ATTENDANCE_CLOSED_FOR_DAY');
    }

    const today = getTodayInJakarta();
    const now = getNowInJakarta();
    const transaction = await sequelize.transaction();

    try {
      const employee = await Employee.findOne({
        where: {
          user_id: userId,
          is_active: true,
        },
        transaction,
      });

      if (!employee) {
        throw new NotFoundError('Data karyawan tidak ditemukan');
      }

      const qrToken = await QrToken.findOne({
        where: {
          token,
          valid_for_date: today,
          expires_at: { [Op.gt]: now },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      }) as any;

      if (!qrToken) {
        throw new ValidationError('QR token tidak valid atau sudah kedaluwarsa');
      }

      // Feature: 1 QR = 1 person only
      if (qrToken.scanned_by && qrToken.scanned_by !== userId) {
        const scannedByEmployee = await Employee.findOne({
          where: { user_id: qrToken.scanned_by },
        });
        throw new AppError(
          `QR ini sudah digunakan oleh ${scannedByEmployee?.getDataValue('name') || 'staff lain'} sebelumnya`,
          409,
          'QR_ALREADY_USED_BY_OTHER_STAFF'
        );
      }

      if (qrToken.is_used) {
        throw new ValidationError('QR token sudah digunakan');
      }

      const existingAttendance = await Attendance.findOne({
        where: {
          employee_id: employee.getDataValue('id'),
          date: today,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existingAttendance && existingAttendance.getDataValue('check_in_at')) {
        throw new AppError('Absensi hari ini sudah dicatat', 409, 'ATTENDANCE_ALREADY_RECORDED');
      }

      // Calculate late minutes
      let lateMinutes = 0;

      // Feature: Late if after 2 AM
      if (isAfter2AM()) {
        lateMinutes = 120; // Default 2 hours late
        
        // But also check schedule-based late calculation
        const scheduleAssignment = await EmployeeSchedule.findOne({
          where: {
            employee_id: employee.getDataValue('id'),
            effective_date: { [Op.lte]: today },
          },
          include: [
            {
              model: WorkSchedule,
              as: 'workSchedule',
            },
          ],
          order: [['effective_date', 'DESC']],
          transaction,
        }) as any;

        if (scheduleAssignment?.workSchedule) {
          const scheduleLateMins = scheduleAssignment.workSchedule.calcLateMinutes(now, today);
          lateMinutes = Math.max(lateMinutes, scheduleLateMins);
        }
      } else {
        // Before 2 AM - use regular schedule-based calculation
        const scheduleAssignment = await EmployeeSchedule.findOne({
          where: {
            employee_id: employee.getDataValue('id'),
            effective_date: { [Op.lte]: today },
          },
          include: [
            {
              model: WorkSchedule,
              as: 'workSchedule',
            },
          ],
          order: [['effective_date', 'DESC']],
          transaction,
        }) as any;

        if (scheduleAssignment?.workSchedule) {
          lateMinutes = scheduleAssignment.workSchedule.calcLateMinutes(now, today);
        }
      }

      const status = lateMinutes > 0 ? 'late' : 'present';

      const attendanceValues = {
        employee_id: employee.getDataValue('id'),
        date: today,
        check_in_at: now,
        late_minutes: lateMinutes,
        status,
        note: 'QR attendance',
      };

      const attendance = existingAttendance
        ? await existingAttendance.update(attendanceValues, { transaction })
        : await Attendance.create(attendanceValues, { transaction });

      // Feature: Track which user scanned the QR
      await qrToken.update({ is_used: true, scanned_by: userId, scanned_at: now }, { transaction });

      await transaction.commit();

      return {
        attendance: attendance.toJSON(),
        employee: employee.toJSON(),
        qrToken: {
          id: qrToken.id,
          token: qrToken.token,
          valid_for_date: qrToken.valid_for_date,
          expires_at: qrToken.expires_at,
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default AttendanceService;