import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 'Email and password required', 400, 'VALIDATION_ERROR');
    }
    const { token, user, employee } = await AuthService.login({ email, password });
    sendSuccess(res, { token, user, employee }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, 'Email required', 400, 'VALIDATION_ERROR');
    }
    const token = await AuthService.generatePasswordReset(email);
    sendSuccess(res, { message: 'Jika email terdaftar, link reset akan dikirim.', reset_token: token }, 'Forgot password email sent');
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendError(res, 'Token and newPassword required', 400, 'VALIDATION_ERROR');
    }
    await AuthService.resetPassword(token, newPassword);
    sendSuccess(res, { message: 'Password berhasil diperbarui' }, 'Password reset successful');
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.authUser?.id;
    if (!userId) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }
    const user = await AuthService.getMe(userId);
    sendSuccess(res, user, 'Profile fetched');
  } catch (err) {
    next(err);
  }
}
