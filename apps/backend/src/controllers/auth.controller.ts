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


export async function getPendingResets(_req: Request, res: Response, next: NextFunction) {
  try {
    const records = await AuthService.getPendingResets();
    sendSuccess(res, records, 'Pending reset requests berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function approveReset(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.authUser?.id;
    const { resetId } = req.params as { resetId: string };
    if (!adminId) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    await AuthService.approveReset(resetId, adminId);
    sendSuccess(res, { approved: true }, 'Reset request berhasil diapprove');
  } catch (err) {
    next(err);
  }
}

export async function rejectReset(req: Request, res: Response, next: NextFunction) {
  try {
    const { resetId } = req.params as { resetId: string };
    await AuthService.rejectReset(resetId);
    sendSuccess(res, { rejected: true }, 'Reset request berhasil ditolak');
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.authUser?.id;
    if (!userId) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      return sendError(res, 'currentPassword dan newPassword wajib diisi', 400, 'VALIDATION_ERROR');
    }
    await AuthService.changePassword(userId, currentPassword, newPassword);
    sendSuccess(res, { changed: true }, 'Password berhasil diubah');
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