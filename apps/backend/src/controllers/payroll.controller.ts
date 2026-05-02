import { Request, Response, NextFunction } from 'express';
import PayrollService from '../services/payroll.service';
import { sendSuccess, sendError } from '../utils/response';

export async function listPeriods(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await PayrollService.listPeriods();
    sendSuccess(res, result, 'Payroll periods fetched');
  } catch (err) {
    next(err);
  }
}

export async function createPeriod(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.authUser?.id;
    if (!actorId) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    const { month, year } = req.body as { month?: number; year?: number };
    const result = await PayrollService.createPeriod({
      month: Number(month),
      year: Number(year),
      actorId,
    });
    sendSuccess(res, result, 'Payroll period created', 201);
  } catch (err) {
    next(err);
  }
}

export async function previewPeriod(req: Request, res: Response, next: NextFunction) {
  try {
    const { periodId } = req.params as { periodId: string };
    const result = await PayrollService.previewPeriod(periodId);
    sendSuccess(res, result, 'Preview payroll generated');
  } catch (err) {
    next(err);
  }
}

export async function generatePeriod(req: Request, res: Response, next: NextFunction) {
  try {
    const { periodId } = req.params as { periodId: string };
    const actorId = req.authUser?.id;
    if (!actorId) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    const result = await PayrollService.generatePeriod(periodId, actorId);
    sendSuccess(res, result, 'Payslips generated');
  } catch (err) {
    next(err);
  }
}

export async function finalizePeriod(req: Request, res: Response, next: NextFunction) {
  try {
    const { periodId } = req.params as { periodId: string };
    const result = await PayrollService.finalizePeriod(periodId);
    sendSuccess(res, result, 'Payroll period finalized');
  } catch (err) {
    next(err);
  }
}

export async function listPayslips(req: Request, res: Response, next: NextFunction) {
  try {
    const { periodId } = req.params as { periodId: string };
    const result = await PayrollService.listPayslips(periodId);
    sendSuccess(res, result, 'Payslips fetched');
  } catch (err) {
    next(err);
  }
}

export async function getPayslipDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const { payslipId } = req.params as { payslipId: string };
    const result = await PayrollService.getPayslipDetail(payslipId);
    sendSuccess(res, result, 'Payslip detail fetched');
  } catch (err) {
    next(err);
  }
}

export async function listMyPayslips(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.authUser;
    if (!authUser?.id) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    const { periodId } = req.query as { periodId?: string };
    const result = await PayrollService.listMyPayslips(authUser.id, authUser.employeeId, periodId);
    sendSuccess(res, result, 'My payslips fetched');
  } catch (err) {
    next(err);
  }
}

export async function getMyPayslipDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.authUser;
    if (!authUser?.id) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    const { payslipId } = req.params as { payslipId: string };
    const result = await PayrollService.getMyPayslipDetail(authUser.id, payslipId, authUser.employeeId);
    sendSuccess(res, result, 'My payslip detail fetched');
  } catch (err) {
    next(err);
  }
}

export async function addManualItem(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.authUser?.id;
    if (!actorId) return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    const { payslipId } = req.params as { payslipId: string };
    const { type, amount, description } = req.body as { type?: string; amount?: number; description?: string };
    const result = await PayrollService.addManualItem(actorId, payslipId, {
      type: String(type || ''),
      amount: Number(amount || 0),
      description,
    });
    sendSuccess(res, result, 'Manual payroll item added');
  } catch (err) {
    next(err);
  }
}
