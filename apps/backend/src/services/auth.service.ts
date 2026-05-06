import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, PasswordResetToken, Employee } from '../models/index';
import { hashPassword, comparePassword } from '../utils/password';
import { signJwt } from '../utils/jwt';
import { ForbiddenError, UnauthorizedError, NotFoundError, ValidationError } from '../utils/errors';

type AuthUserRecord = {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'staff' | 'manager';
  is_active: boolean;
};

class AuthService {
  static async createUser({ email, password, role = 'staff' }: any) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new Error('Email already registered');
    const password_hash = await hashPassword(password);
    const user = await User.create({ email, password_hash, role });
    return user;
  }

  static async login({ email, password }: any) {
    const user = await User.unscoped().findOne({
      where: { email },
      attributes: ['id', 'email', 'password_hash', 'role', 'is_active'],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'full_name', 'user_id'],
        },
      ],
    });

    if (!user || !user.getDataValue('is_active')) {
      throw new UnauthorizedError('Akun Anda telah dinonaktifkan atau kredensial tidak valid');
    }

    const ok = await comparePassword(password, user.getDataValue('password_hash'));
    if (!ok) throw new UnauthorizedError('Invalid credentials');
    
    // extract employee (if included)
    const empIncluded = user.get('employee') as any | null;

    const token = signJwt({
      id: user.getDataValue('id'),
      role: user.getDataValue('role'),
      employeeId: empIncluded?.id,
    });

    // update last login on instance for single-row update
    try {
      await user.update({ last_login_at: new Date() });
    } catch {}

    return {
      token,
      user: {
        id: user.getDataValue('id'),
        email: user.getDataValue('email'),
        role: user.getDataValue('role'),
      },
      employee: empIncluded ? empIncluded : null,
    };
  }

  static async generatePasswordReset(email: string) {
    const user = await User.findOne({ where: { email } });
    if (!user) throw new NotFoundError('User not found');
    if (user.getDataValue('role') === 'admin') {
      throw new ForbiddenError('Admin tidak dapat melakukan reset password');
    }

    const pendingRequest = await PasswordResetToken.findOne({
      where: {
        user_id: user.getDataValue('id'),
        approved_at: null,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (pendingRequest) {
      throw new ValidationError('Reset password masih pending, tidak bisa request lagi');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires_at = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await PasswordResetToken.create({
      user_id: user.getDataValue('id'),
      token_hash,
      token_value: token,
      expires_at,
    });
    return token;
  }

  static async resetPassword(token: string, newPassword: string) {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const record: any = await PasswordResetToken.findOne({ where: { token_hash } });
    if (!record) throw new UnauthorizedError('Invalid token');
    if (!record.isValid()) throw new UnauthorizedError('Token expired or used');
    if (!record.isApproved()) throw new UnauthorizedError('Token belum disetujui admin');
    const user = await User.findByPk(record.getDataValue('user_id'));
    if (!user) throw new NotFoundError('User not found');
    if (user.getDataValue('role') === 'admin') {
      throw new ForbiddenError('Admin tidak dapat melakukan reset password');
    }
    const password_hash = await hashPassword(newPassword);
    await user.update({ password_hash });
    await record.update({ used_at: new Date() });
    return true;
  }


  static async getPendingResets() {
    const records = await PasswordResetToken.findAll({
      where: {
        approved_at: null,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'role'],
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['full_name', 'employee_number', 'job_title'],
              required: false,
            },
          ],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    return records.map((r: any) => {
      const rec = r.toJSON();
      return {
        id: rec.id,
        created_at: rec.created_at,
        expires_at: rec.expires_at,
        token_value: rec.token_value,
        user: rec.user,
      };
    });
  }

  static async approveReset(resetId: string, adminId: string) {
    const record = await PasswordResetToken.findByPk(resetId) as any;
    if (!record) throw new NotFoundError('Reset request not found');
    if (!record.isValid()) throw new UnauthorizedError('Token sudah expired atau sudah digunakan');
    if (record.isApproved()) throw new ValidationError('Request ini sudah diapprove sebelumnya');

    await record.update({ approved_at: new Date(), approved_by: adminId });
    return true;
  }

  static async rejectReset(resetId: string) {
    const record = await PasswordResetToken.findByPk(resetId) as any;
    if (!record) throw new NotFoundError('Reset request not found');
    // Mark as used to invalidate
    await record.update({ used_at: new Date() });
    return true;
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.unscoped().findByPk(userId, {
      attributes: ['id', 'password_hash', 'is_active', 'role'],
    }) as any;
    if (!user) throw new NotFoundError('User not found');
    if (user.getDataValue('role') === 'admin') {
      throw new ForbiddenError('Admin tidak dapat mengubah password');
    }

    const ok = await comparePassword(currentPassword, user.getDataValue('password_hash'));
    if (!ok) throw new UnauthorizedError('Password saat ini tidak sesuai');

    if (newPassword.length < 8) throw new ValidationError('Password baru minimal 8 karakter');

    const password_hash = await hashPassword(newPassword);
    await user.update({ password_hash });
    return true;
  }

  static async getMe(userId: string) {
    const user = await User.unscoped().findByPk(userId, {
      attributes: ['id', 'email', 'role', 'is_active'],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'full_name', 'user_id'],
        },
      ],
    }) as any | null;

    if (!user) throw new NotFoundError('User not found');
    if (!user.getDataValue('is_active')) {
      throw new UnauthorizedError('Akun Anda telah dinonaktifkan');
    }

    const empIncluded = user.get('employee') as any | null;

    return {
      user: {
        id: user.getDataValue('id'),
        email: user.getDataValue('email'),
        role: user.getDataValue('role'),
      },
      employee: empIncluded ? empIncluded : null,
    };
  }
}

export default AuthService;