import { Request, Response, NextFunction } from 'express';
import ReimbursementService from '../services/reimbursement.service';
import { sendError, sendSuccess } from '../utils/response';

function getAuth(req: Request) {
  const userId = req.authUser?.id;
  const role = req.authUser?.role;
  const employeeId = req.authUser?.employeeId;

  if (!userId || !role) {
    return null;
  }

  return { userId, role, employeeId };
}

export async function listReimbursements(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const requests = await ReimbursementService.listRequests(auth);
    sendSuccess(res, requests, 'Request reimburse berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function createReimbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const request = await ReimbursementService.createRequest(auth, req.body, req.ip || 'unknown');
    sendSuccess(res, request, 'Request reimburse berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
}

export async function decideReimbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const { reimbursementId } = req.params as { reimbursementId: string };
    const request = await ReimbursementService.decideRequest(
      auth,
      reimbursementId,
      req.body,
      req.ip || 'unknown'
    );
    sendSuccess(res, request, 'Request reimburse berhasil diproses');
  } catch (err) {
    next(err);
  }
}
