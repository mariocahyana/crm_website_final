import { Router } from 'express';
import {
  cancelLeaveRequest,
  createLeaveRequest,
  decideLeaveRequest,
  listLeaveRequests,
  listLeaveTypes,
} from '../controllers/leave.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/types', listLeaveTypes);
router.get('/requests', listLeaveRequests);
router.post('/requests', createLeaveRequest);
router.patch('/requests/:requestId/decision', decideLeaveRequest);
router.patch('/requests/:requestId/cancel', cancelLeaveRequest);

export default router;
