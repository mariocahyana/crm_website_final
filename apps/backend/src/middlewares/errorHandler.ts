import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.code);
  }

  return sendError(res, 'Internal server error', 500, 'INTERNAL_SERVER_ERROR');
}
