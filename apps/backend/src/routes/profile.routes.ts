import { Router } from 'express';
import { updateMyProfile, updateAnyProfile } from '../controllers/profile.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { uploadReceipt } from '../middlewares/upload';

const router = Router();

router.patch('/me', requireAuth, uploadReceipt.single('photo'), updateMyProfile);
router.patch('/:employeeId', requireAuth, requireRole('admin'), uploadReceipt.single('photo'), updateAnyProfile);

export default router;
