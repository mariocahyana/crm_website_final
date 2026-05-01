import { Request, Response, NextFunction } from 'express';
import LeaveService from '../services/leave.service';
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

export async function listLeaveTypes(_req: Request, res: Response, next: NextFunction) {
  try {
    const types = await LeaveService.listTypes();
    sendSuccess(res, types, 'Jenis cuti berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function listLeaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const requests = await LeaveService.listRequests(auth);
    sendSuccess(res, requests, 'Request cuti berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function createLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const request = await LeaveService.createRequest(auth, req.body, req.ip || 'unknown');
    sendSuccess(res, request, 'Request cuti berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
}

export async function decideLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const { requestId } = req.params as { requestId: string };
    const request = await LeaveService.decideRequest(auth, requestId, req.body, req.ip || 'unknown');
    sendSuccess(res, request, 'Request cuti berhasil diproses');
  } catch (err) {
    next(err);
  }
}

export async function cancelLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const { requestId } = req.params as { requestId: string };
    const request = await LeaveService.cancelRequest(auth, requestId, req.ip || 'unknown');
    sendSuccess(res, request, 'Request cuti berhasil dibatalkan');
  } catch (err) {
    next(err);
  }
}
