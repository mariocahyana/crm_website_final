import { Request, Response, NextFunction } from 'express';
import ReimbursementService from '../services/reimbursement.service';
import { sendError, sendSuccess } from '../utils/response';
import { deleteReceiptFile } from '../middlewares/upload';

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
  const file = (req as any).file;
  
  try {
    const auth = getAuth(req);
    if (!auth) {
      if (file) deleteReceiptFile(file.filename);
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const request = await ReimbursementService.createRequest(auth, req.body, file, req.ip || 'unknown');
    sendSuccess(res, request, 'Request reimburse berhasil dibuat', 201);
  } catch (err) {
    // Delete file jika ada error
    if (file) deleteReceiptFile(file.filename);
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

export async function deleteReimbursement(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const { reimbursementId } = req.params as { reimbursementId: string };
    const result = await ReimbursementService.deleteRequest(auth, reimbursementId, req.ip || 'unknown');
    sendSuccess(res, result, 'Request reimburse berhasil dihapus');
  } catch (err) {
    next(err);
  }
}
