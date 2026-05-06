import { Request, Response, NextFunction } from 'express';
import UserManagementService from '../services/userManagement.service';
import { sendSuccess, sendError } from '../utils/response';

export async function getUserTree(_req: Request, res: Response, next: NextFunction) {
  try {
    const tree = await UserManagementService.getUserTree();
    sendSuccess(res, tree, 'User tree berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await UserManagementService.listUsers();
    sendSuccess(res, users, 'Daftar user berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function getUserOptions(_req: Request, res: Response, next: NextFunction) {
  try {
    const options = await UserManagementService.getOptions();
    sendSuccess(res, options, 'Opsi user management berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.authUser?.id;
    if (!actorId) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const result = await UserManagementService.createUser(actorId, req.body);
    sendSuccess(res, result, 'User berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.authUser?.id;
    const { userId } = req.params as { userId: string };

    if (!actorId) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const result = await UserManagementService.updateUser(actorId, userId, req.body);
    sendSuccess(res, result, 'User berhasil diperbarui');
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.authUser?.id;
    const { userId } = req.params as { userId: string };
    const { is_active } = req.body as { is_active?: boolean };

    if (!actorId) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    if (typeof is_active !== 'boolean') {
      return sendError(res, 'is_active harus boolean', 400, 'VALIDATION_ERROR');
    }

    const result = await UserManagementService.updateUserStatus(actorId, userId, is_active);
    sendSuccess(res, result, 'Status user berhasil diperbarui');
  } catch (err) {
    next(err);
  }
}