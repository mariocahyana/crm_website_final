import { Op } from 'sequelize';
import { LeaveType, LeaveRequest, Employee, User, ActivityLog } from '../models/index';
import notifications from './notifications.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

type UserRole = 'admin' | 'staff' | 'manager';

interface AuthContext {
  userId: string;
  role: UserRole;
  employeeId?: string;
}

interface CreateLeaveInput {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

interface DecideLeaveInput {
  status: 'approved' | 'declined';
  decline_reason?: string;
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Format tanggal tidak valid');
  }
  return date;
}

function calculateTotalDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (end < start) {
    throw new ValidationError('Tanggal selesai tidak boleh sebelum tanggal mulai');
  }

  const oneDayMs = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / oneDayMs) + 1;
}

function includeRequestRelations() {
  return [
    {
      model: LeaveType,
      as: 'leaveType',
      attributes: ['id', 'name', 'is_paid', 'max_days_per_year'],
    },
    {
      model: Employee,
      as: 'employee',
      attributes: ['id', 'employee_number', 'full_name', 'department_id', 'manager_id', 'job_title'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['role'],
          required: false,
        },
      ],
    },
    {
      model: Employee,
      as: 'approver',
      attributes: ['id', 'employee_number', 'full_name'],
      required: false,
    },
  ];
}

class LeaveService {
  static async listTypes() {
    const count = await LeaveType.count();
    if (count === 0) {
      await LeaveType.bulkCreate([
        { name: 'Cuti Tahunan', is_paid: true, max_days_per_year: 12 },
        { name: 'Cuti Sakit', is_paid: true, max_days_per_year: null },
        { name: 'Cuti Tidak Dibayar', is_paid: false, max_days_per_year: null },
      ]);
    }

    return LeaveType.findAll({
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'is_paid', 'max_days_per_year'],
    });
  }

  static async listRequests(auth: AuthContext) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    const where: Record<string, unknown> = {};
    const include = includeRequestRelations();

    if (auth.role === 'staff') {
      where.employee_id = auth.employeeId;
    }

    if (auth.role === 'manager') {
      const manager = await Employee.findByPk(auth.employeeId, {
        attributes: ['id', 'department_id'],
        raw: true,
      }) as { id: string; department_id: string | null } | null;

      include[1] = {
        ...include[1],
        where: {
          [Op.or]: [
            { id: auth.employeeId },
            { manager_id: auth.employeeId },
            ...(manager?.department_id ? [{ department_id: manager.department_id }] : []),
          ],
        },
      } as any;
    }

    return LeaveRequest.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
    });
  }

  static async createRequest(auth: AuthContext, input: CreateLeaveInput, clientIp: string) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    if (!input.leave_type_id || !input.start_date || !input.end_date) {
      throw new ValidationError('Jenis cuti, tanggal mulai, dan tanggal selesai wajib diisi');
    }

    const leaveType = await LeaveType.findByPk(input.leave_type_id);
    if (!leaveType) {
      throw new ValidationError('Jenis cuti tidak ditemukan');
    }

    const totalDays = calculateTotalDays(input.start_date, input.end_date);

    const overlapping = await LeaveRequest.findOne({
      where: {
        employee_id: auth.employeeId,
        status: ['pending', 'approved'],
        start_date: { [Op.lte]: input.end_date },
        end_date: { [Op.gte]: input.start_date },
      },
    });

    if (overlapping) {
      throw new ValidationError('Tanggal cuti bertabrakan dengan request lain');
    }

    const request = await LeaveRequest.create({
      employee_id: auth.employeeId,
      leave_type_id: input.leave_type_id,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: totalDays,
      reason: sanitizeText(input.reason),
      status: 'pending',
    });

    try {
      await ActivityLog.create({
        actor_id: auth.userId,
        action: 'LEAVE_REQUEST_CREATE',
        target_type: 'LeaveRequest',
        target_id: request.getDataValue('id'),
        ip_address: clientIp,
      });
    } catch (error) {
      console.error('Failed to write leave create activity log', error);
    }

    return LeaveRequest.findByPk(request.getDataValue('id'), {
      include: includeRequestRelations(),
    });
  }

  static async decideRequest(auth: AuthContext, requestId: string, input: DecideLeaveInput, clientIp: string) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    if (!['approved', 'declined'].includes(input.status)) {
      throw new ValidationError('Status harus approved atau declined');
    }

    if (input.status === 'declined' && !sanitizeText(input.decline_reason)) {
      throw new ValidationError('Alasan penolakan wajib diisi');
    }

    const request: any = await LeaveRequest.findByPk(requestId, {
      include: includeRequestRelations(),
    });

    if (!request) {
      throw new NotFoundError('Request cuti tidak ditemukan');
    }

    if (request.getDataValue('status') !== 'pending') {
      throw new ValidationError('Hanya request pending yang bisa diproses');
    }

    const employee = request.get('employee') as any;
    const requesterRole = employee?.user?.role as UserRole | undefined;
    const approver = await Employee.findByPk(auth.employeeId, {
      attributes: ['id', 'department_id'],
      raw: true,
    }) as { id: string; department_id: string | null } | null;

    const isAdmin = auth.role === 'admin';
    const isStaffRequest = requesterRole === 'staff';
    const isManagerRequest = requesterRole === 'manager';
    const isDirectManager = auth.role === 'manager' && isStaffRequest && employee?.manager_id === auth.employeeId;
    const isSameDepartmentManager = auth.role === 'manager'
      && isStaffRequest
      && !!approver?.department_id
      && approver.department_id === employee?.department_id;

    if (isAdmin && employee?.id === auth.employeeId) {
      throw new ForbiddenError('Admin tidak dapat memproses request cuti miliknya sendiri');
    }

    if (isManagerRequest && !isAdmin) {
      throw new ForbiddenError('Request cuti manager hanya bisa diproses oleh admin');
    }

    if (isStaffRequest && !isAdmin && !isDirectManager && !isSameDepartmentManager) {
      throw new ForbiddenError('Tidak punya akses untuk memproses request ini');
    }

    await request.update({
      status: input.status,
      approved_by: auth.employeeId,
      approved_at: new Date(),
      decline_reason: input.status === 'declined' ? sanitizeText(input.decline_reason) : null,
    });

    try {
      await ActivityLog.create({
        actor_id: auth.userId,
        action: input.status === 'approved' ? 'LEAVE_REQUEST_APPROVE' : 'LEAVE_REQUEST_DECLINE',
        target_type: 'LeaveRequest',
        target_id: requestId,
        payload: { decline_reason: sanitizeText(input.decline_reason) },
        ip_address: clientIp,
      });
    } catch (error) {
      console.error('Failed to emit leave approval notification', error);
    }

    // Emit notification so clients can refresh payslips
    try {
      notifications.emitPayslipChange({
        action: input.status === 'approved' ? 'leave_approved' : 'leave_declined',
        employee_id: request.getDataValue('employee_id'),
        request_id: requestId,
        start_date: request.getDataValue('start_date'),
        end_date: request.getDataValue('end_date'),
      });
    } catch {}

    return LeaveRequest.findByPk(requestId, {
      include: includeRequestRelations(),
    });
  }

  static async cancelRequest(auth: AuthContext, requestId: string, clientIp: string) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    const request: any = await LeaveRequest.findByPk(requestId);
    if (!request) {
      throw new NotFoundError('Request cuti tidak ditemukan');
    }

    if (request.getDataValue('employee_id') !== auth.employeeId) {
      throw new ForbiddenError('Hanya pemilik request yang bisa membatalkan');
    }

    if (request.getDataValue('status') !== 'pending') {
      throw new ValidationError('Hanya request pending yang bisa dibatalkan');
    }

    await request.update({ status: 'cancelled' });

    try {
      await ActivityLog.create({
        actor_id: auth.userId,
        action: 'LEAVE_REQUEST_CANCEL',
        target_type: 'LeaveRequest',
        target_id: requestId,
        ip_address: clientIp,
      });
    } catch (error) {
      console.error('Failed to write leave cancel activity log', error);
    }

    return LeaveRequest.findByPk(requestId, {
      include: includeRequestRelations(),
    });
  }
}

export default LeaveService;
