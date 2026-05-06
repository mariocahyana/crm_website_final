import { Router } from 'express';
import {
  login,
  forgotPassword,
  resetPassword,
  me,
  getPendingResets,
  approveReset,
  rejectReset,
  changePassword,
} from '../controllers/auth.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', requireAuth, me);

router.post('/change-password', requireAuth, changePassword);

router.get('/reset-requests', requireAuth, requireRole('admin'), getPendingResets);
router.post('/reset-requests/:resetId/approve', requireAuth, requireRole('admin'), approveReset);
router.post('/reset-requests/:resetId/reject', requireAuth, requireRole('admin'), rejectReset);

export default router;