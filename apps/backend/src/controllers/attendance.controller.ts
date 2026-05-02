import { Request, Response, NextFunction } from 'express';
import AttendanceService from '../services/attendance.service';
import { sendSuccess, sendError } from '../utils/response';

export async function getAdminQrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.authUser?.id;
    if (!actorId) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const forceRefresh = String(req.query.force_refresh || '').toLowerCase() === 'true';
    const qrCode = await AttendanceService.getAdminQrCode(actorId, forceRefresh);
    sendSuccess(res, qrCode, 'QR code absensi berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function scanQrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.authUser?.id;
    if (!actorId) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const { token } = req.body as { token?: string };
    if (!token) {
      return sendError(res, 'QR token required', 400, 'VALIDATION_ERROR');
    }

    const result = await AttendanceService.scanQrCode(actorId, token);
    sendSuccess(res, result, 'Absensi berhasil dicatat');
  } catch (err) {
    next(err);
  }
}