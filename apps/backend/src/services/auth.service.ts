import crypto from 'crypto';
import { User, PasswordResetToken, Employee } from '../models/index';
import { hashPassword, comparePassword } from '../utils/password';
import { signJwt } from '../utils/jwt';
import { UnauthorizedError, NotFoundError } from '../utils/errors';

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
          attributes: ['id', 'full_name', 'user_id', 'phone', 'address', 'photo_url', 'join_date', 'job_title'],
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
    const token = crypto.randomBytes(24).toString('hex');
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires_at = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await PasswordResetToken.create({ user_id: user.getDataValue('id'), token_hash, expires_at });
    return token;
  }

  static async resetPassword(token: string, newPassword: string) {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const record: any = await PasswordResetToken.findOne({ where: { token_hash } });
    if (!record) throw new UnauthorizedError('Invalid token');
    if (!record.isValid()) throw new UnauthorizedError('Token expired or used');
    const user = await User.findByPk(record.getDataValue('user_id'));
    if (!user) throw new NotFoundError('User not found');
    const password_hash = await hashPassword(newPassword);
    await user.update({ password_hash });
    await record.update({ used_at: new Date() });
    return true;
  }

  static async getMe(userId: string) {
    const user = await User.unscoped().findByPk(userId, {
      attributes: ['id', 'email', 'role', 'is_active'],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'full_name', 'user_id', 'phone', 'address', 'photo_url', 'join_date', 'job_title'],
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
