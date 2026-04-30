import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, PasswordResetToken, Employee } from '../models/index';
import { hashPassword, comparePassword } from '../utils/password';
import { signJwt, TokenPayload } from '../utils/jwt';
import { UnauthorizedError, NotFoundError } from '../utils/errors';

class AuthService {
  static async createUser({ email, password, role = 'staff' }: any) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new Error('Email already registered');
    const password_hash = await hashPassword(password);
    const user = await User.create({ email, password_hash, role });
    return user;
  }

  static async login({ email, password }: any) {
    const user = await User.scope('withPassword').findOne({ where: { email } });
    if (!user) throw new UnauthorizedError('Invalid credentials');
    const ok = await comparePassword(password, user.getDataValue('password_hash'));
    if (!ok) throw new UnauthorizedError('Invalid credentials');
    
    // Get employee data
    let employee = null;
    try {
      const emp = await Employee.findOne({
        where: { user_id: user.getDataValue('id') },
      });
      if (emp) {
        employee = emp.toJSON();
      }
    } catch {}

    const token = signJwt({
      id: user.getDataValue('id'),
      role: user.getDataValue('role'),
      employeeId: employee?.id,
    });
    
    // update last login
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
      employee,
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
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');

    let employee = null;
    try {
      const emp = await Employee.findOne({ where: { user_id: userId } });
      if (emp) {
        employee = emp.toJSON();
      }
    } catch {}

    return {
      user: {
        id: user.getDataValue('id'),
        email: user.getDataValue('email'),
        role: user.getDataValue('role'),
      },
      employee,
    };
  }
}

export default AuthService;
