import { Request, Response, NextFunction } from 'express';
import BootstrapService from '../services/bootstrap.service';
import { sendError, sendSuccess } from '../utils/response';

function getAuth(req: Request) {
  const userId = req.authUser?.id;
  const role = req.authUser?.role as any;
  const employeeId = req.authUser?.employeeId || undefined;

  if (!userId || !role) return null;
  return { userId, role, employeeId };
}

export async function getBootstrap(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');

    const payload = await BootstrapService.getBootstrap(auth);
    sendSuccess(res, payload, 'Bootstrap data');
  } catch (err) {
    next(err);
  }
}
