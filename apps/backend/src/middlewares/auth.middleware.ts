import { Request, Response, NextFunction } from 'express';
import { verifyJwt, TokenPayload } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid token');
    }

    const token = header.substring(7);
    const payload: TokenPayload = verifyJwt(token);

    req.authUser = {
      id: payload.id,
      role: payload.role,
      employeeId: payload.employeeId,
    };

    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid token'));
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}
