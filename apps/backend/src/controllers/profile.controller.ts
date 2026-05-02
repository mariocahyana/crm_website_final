import { Request, Response, NextFunction } from 'express';
import ProfileService from '../services/profile.service';
import { sendSuccess, sendError } from '../utils/response';

export async function updateMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.authUser?.id;
    const employeeId = req.authUser?.employeeId;

    if (!userId || !employeeId) {
      return sendError(res, 'Missing auth context', 401, 'UNAUTHORIZED');
    }

    const clientIp = req.ip || 'unknown';
    const photoFile = req.file;
    
    const result = await ProfileService.updateMyProfile(
      userId,
      employeeId,
      req.body,
      photoFile,
      clientIp
    );

    sendSuccess(res, result, 'Profile berhasil diperbarui');
  } catch (err) {
    next(err);
  }
}

export async function updateAnyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.authUser?.id;
    const { employeeId } = req.params as { employeeId: string };
    const clientIp = req.ip || 'unknown';
    const photoFile = req.file;

    if (!userId) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const result = await ProfileService.updateEmployeeProfile(
      userId,
      employeeId,
      req.body,
      photoFile,
      clientIp
    );

    sendSuccess(res, result, 'Profile employee berhasil diperbarui');
  } catch (err) {
    next(err);
  }
}
