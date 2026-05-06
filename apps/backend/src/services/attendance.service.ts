import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  sequelize,
  Attendance,
  Employee,
  QrToken,
  User,
} from '../models/index';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import {
  getNowInJakarta,
  getAttendanceDateInJakarta,
  isAfter10AM,
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
    const now = getNowInJakarta();
    const today = getAttendanceDateInJakarta(now);

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

    const now = getNowInJakarta();
    const today = getAttendanceDateInJakarta(now);
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
        include: [
          {
            model: User,
            as: 'scanner',
            attributes: ['id'],
            include: [
              {
                model: Employee,
                as: 'employee',
                attributes: ['id', 'full_name'],
              },
            ],
          },
        ],
      }) as any;

      if (!qrToken) {
        throw new ValidationError('QR token tidak valid atau sudah kedaluwarsa');
      }

      // Feature: 1 QR = 1 person only
      if (qrToken.scanned_by && qrToken.scanned_by !== userId) {
        const scannerUser = qrToken.get('scanner') as any | null;
        const scannedByName = scannerUser?.employee?.full_name || 'staff lain';
        throw new AppError(
          `QR ini sudah digunakan oleh ${scannedByName} sebelumnya`,
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

      const attendanceStart = new Date(`${today}T10:00:00`);
      const lateMinutes = Math.max(0, Math.floor((now.getTime() - attendanceStart.getTime()) / 60000));

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

  static async getAttendanceHistory(params: any) {
    try {
      const { month, year, employee_id } = params;
      const where: any = {};

      if (employee_id) {
        where.employee_id = employee_id;
      }

      if (month && year) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0); // Last day of month
        const endDateString = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        where.date = {
          [Op.between]: [startDate, endDateString],
        };
      }

      const attendances = await Attendance.findAll({
        where,
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'full_name', 'user_id'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['email'],
              },
            ],
          },
        ],
        order: [['date', 'DESC']],
        raw: false,
      });

      return attendances.map((att: any) => ({
        id: att.id,
        employee_id: att.employee_id,
        employee_name: att.employee?.full_name,
        employee_email: att.employee?.user?.email,
        date: att.date,
        check_in_at: att.check_in_at,
        check_out_at: att.check_out_at,
        late_minutes: att.late_minutes,
        status: att.status,
        note: att.note,
      }));
    } catch (error) {
      console.error('Error in getAttendanceHistory:', error);
      throw error;
    }
  }
}

export default AttendanceService;