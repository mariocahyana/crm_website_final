import { Router } from 'express';
import {
	listPeriods,
	createPeriod,
	previewPeriod,
	generatePeriod,
	finalizePeriod,
	listPayslips,
	getPayslipDetail,
	listMyPayslips,
	getMyPayslipDetail,
	addManualItem,
} from '../controllers/payroll.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/me/payslips', listMyPayslips);
router.get('/me/payslips/:payslipId', getMyPayslipDetail);

router.use(requireRole('admin'));

router.get('/periods', listPeriods);
router.post('/periods', createPeriod);
router.get('/periods/:periodId/preview', previewPeriod);
router.get('/periods/:periodId/payslips', listPayslips);
router.get('/payslips/:payslipId', getPayslipDetail);
router.post('/periods/:periodId/generate', generatePeriod);
router.post('/periods/:periodId/finalize', finalizePeriod);
router.post('/payslips/:payslipId/items', addManualItem);

export default router;
