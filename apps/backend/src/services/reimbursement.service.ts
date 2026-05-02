import { Op } from 'sequelize';
import { ActivityLog, Employee, Reimbursement } from '../models/index';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { getReceiptUrl, deleteReceiptFile } from '../middlewares/upload';

type UserRole = 'admin' | 'staff' | 'manager';

interface AuthContext {
  userId: string;
  role: UserRole;
  employeeId?: string;
}

interface CreateReimbursementInput {
  category: string;
  amount: number;
  description?: string;
  expense_date: string;
}

interface DecideReimbursementInput {
  status: 'approved' | 'declined';
  decline_reason?: string;
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function validateDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Format tanggal pengeluaran tidak valid');
  }
}

function includeRelations() {
  return [
    {
      model: Employee,
      as: 'employee',
      attributes: ['id', 'employee_number', 'full_name', 'department_id', 'manager_id', 'job_title'],
    },
    {
      model: Employee,
      as: 'approver',
      attributes: ['id', 'employee_number', 'full_name'],
      required: false,
    },
  ];
}

async function canReviewEmployee(auth: AuthContext, employee: any) {
  if (auth.role === 'admin') return true;
  if (auth.role !== 'manager' || !auth.employeeId) return false;
  if (employee?.manager_id === auth.employeeId) return true;

  const approver = await Employee.findByPk(auth.employeeId, {
    attributes: ['id', 'department_id'],
    raw: true,
  }) as { id: string; department_id: string | null } | null;

  return !!approver?.department_id && approver.department_id === employee?.department_id;
}

class ReimbursementService {
  static async listRequests(auth: AuthContext) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    const where: Record<string, unknown> = {};
    const include = includeRelations();

    if (auth.role === 'staff') {
      where.employee_id = auth.employeeId;
    }

    if (auth.role === 'manager') {
      include[0] = {
        ...include[0],
        where: {
          [Op.or]: [
            { id: auth.employeeId },
            { manager_id: auth.employeeId },
          ],
        },
      } as any;
    }

    return Reimbursement.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
    });
  }

  static async createRequest(auth: AuthContext, input: CreateReimbursementInput, file: Express.Multer.File | undefined, clientIp: string) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    const category = sanitizeText(input.category);
    const amount = Number(input.amount);
    const expenseDate = sanitizeText(input.expense_date);

    if (!category || !expenseDate) {
      throw new ValidationError('Kategori dan tanggal pengeluaran wajib diisi');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('Nominal reimburse harus lebih dari 0');
    }

    validateDateOnly(expenseDate);

    // Generate receipt_url dari file jika ada
    const receiptUrl = file ? getReceiptUrl(file.filename) : null;

    const reimbursement = await Reimbursement.create({
      employee_id: auth.employeeId,
      category,
      amount,
      description: sanitizeText(input.description),
      receipt_url: receiptUrl,
      expense_date: expenseDate,
      status: 'pending',
    });

    try {
      await ActivityLog.create({
        actor_id: auth.userId,
        action: 'REIMBURSEMENT_CREATE',
        target_type: 'Reimbursement',
        target_id: reimbursement.getDataValue('id'),
        ip_address: clientIp,
      });
    } catch {}

    return Reimbursement.findByPk(reimbursement.getDataValue('id'), {
      include: includeRelations(),
    });
  }

  static async decideRequest(
    auth: AuthContext,
    reimbursementId: string,
    input: DecideReimbursementInput,
    clientIp: string
  ) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    if (!['approved', 'declined'].includes(input.status)) {
      throw new ValidationError('Status harus approved atau declined');
    }

    if (input.status === 'declined' && !sanitizeText(input.decline_reason)) {
      throw new ValidationError('Alasan penolakan wajib diisi');
    }

    const reimbursement: any = await Reimbursement.findByPk(reimbursementId, {
      include: includeRelations(),
    });

    if (!reimbursement) {
      throw new NotFoundError('Request reimburse tidak ditemukan');
    }

    if (reimbursement.getDataValue('status') !== 'pending') {
      throw new ValidationError('Hanya request pending yang bisa diproses');
    }

    const employee = reimbursement.get('employee') as any;
    const isAllowed = await canReviewEmployee(auth, employee);
    if (!isAllowed) {
      throw new ForbiddenError('Tidak punya akses untuk memproses request ini');
    }

    if (employee?.id === auth.employeeId && auth.role !== 'admin') {
      throw new ForbiddenError('Tidak bisa memproses request milik sendiri');
    }

    await reimbursement.update({
      status: input.status,
      approved_by: auth.employeeId,
      approved_at: new Date(),
      decline_reason: input.status === 'declined' ? sanitizeText(input.decline_reason) : null,
    });

    try {
      await ActivityLog.create({
        actor_id: auth.userId,
        action: input.status === 'approved' ? 'REIMBURSEMENT_APPROVE' : 'REIMBURSEMENT_DECLINE',
        target_type: 'Reimbursement',
        target_id: reimbursementId,
        payload: { decline_reason: sanitizeText(input.decline_reason) },
        ip_address: clientIp,
      });
    } catch {}

    return Reimbursement.findByPk(reimbursementId, {
      include: includeRelations(),
    });
  }

  static async deleteRequest(auth: AuthContext, reimbursementId: string, clientIp: string) {
    if (!auth.employeeId) {
      throw new ValidationError('Employee context tidak ditemukan');
    }

    const reimbursement: any = await Reimbursement.findByPk(reimbursementId, {
      include: includeRelations(),
    });

    if (!reimbursement) {
      throw new NotFoundError('Request reimburse tidak ditemukan');
    }

    // Permission: admin can delete; staff can delete their own pending request
    const status = reimbursement.getDataValue('status');
    const employeeId = reimbursement.getDataValue('employee_id');

    const isAdmin = auth.role === 'admin';
    const isOwnerPending = auth.role === 'staff' && auth.employeeId === employeeId && status === 'pending';

    if (!isAdmin && !isOwnerPending) {
      throw new ForbiddenError('Tidak punya akses untuk menghapus request ini');
    }

    // delete file if exists
    const receiptUrl = reimbursement.getDataValue('receipt_url') as string | null;
    if (receiptUrl) {
      try {
        deleteReceiptFile(receiptUrl);
      } catch (err) {}
    }

    await reimbursement.destroy();

    try {
      await ActivityLog.create({
        actor_id: auth.userId,
        action: 'REIMBURSEMENT_DELETE',
        target_type: 'Reimbursement',
        target_id: reimbursementId,
        ip_address: clientIp,
      });
    } catch {}

    return { id: reimbursementId };
  }
}

export default ReimbursementService;
