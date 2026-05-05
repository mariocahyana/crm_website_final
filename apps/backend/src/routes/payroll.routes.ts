import { Router } from 'express';
import {
	listPeriods,
	createPeriod,
	generatePeriod,
	finalizePeriod,
	listPayslips,
	getPayslipDetail,
	listMyPayslips,
	getMyPayslipDetail,
	addManualItem,
	addManualItemToPeriod,
	deleteManualItem,
} from '../controllers/payroll.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/me/payslips', listMyPayslips);
router.get('/me/payslips/:payslipId', getMyPayslipDetail);

router.use(requireRole('admin'));

router.get('/periods', listPeriods);
router.post('/periods', createPeriod);
router.get('/periods/:periodId/payslips', listPayslips);
router.get('/payslips/:payslipId', getPayslipDetail);
router.post('/periods/:periodId/generate', generatePeriod);
router.post('/periods/:periodId/finalize', finalizePeriod);
router.post('/periods/:periodId/items', addManualItemToPeriod);
router.post('/payslips/:payslipId/items', addManualItem);
router.delete('/payslips/:payslipId/items/:itemId', deleteManualItem);

export default router;
