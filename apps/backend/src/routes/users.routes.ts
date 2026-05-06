import { Router } from 'express';
import {
  listUsers,
  getUserOptions,
  getUserTree,
  createUser,
  updateUser,
  updateUserStatus,
} from '../controllers/userManagement.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/tree', requireAuth, requireRole('admin', 'manager'), getUserTree);

router.use(requireAuth, requireRole('admin'));

router.get('/', listUsers);
router.get('/options', getUserOptions);
router.post('/', createUser);
router.patch('/:userId', updateUser);
router.patch('/:userId/status', updateUserStatus);

export default router;