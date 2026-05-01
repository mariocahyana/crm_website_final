import { Router } from 'express';
import {
  createReimbursement,
  decideReimbursement,
  listReimbursements,
} from '../controllers/reimbursement.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', listReimbursements);
router.post('/', createReimbursement);
router.patch('/:reimbursementId/decision', decideReimbursement);

export default router;
