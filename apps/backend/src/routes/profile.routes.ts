import { Router } from 'express';
import { updateMyProfile, updateAnyProfile } from '../controllers/profile.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.patch('/me', requireAuth, updateMyProfile);
router.patch('/:employeeId', requireAuth, requireRole('admin'), updateAnyProfile);

export default router;
