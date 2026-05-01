import { Router } from 'express';
import {
  createReimbursement,
  decideReimbursement,
  deleteReimbursement,
  listReimbursements,
} from '../controllers/reimbursement.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadReceipt } from '../middlewares/upload';

const router = Router();

router.use(requireAuth);

router.get('/', listReimbursements);
router.post('/', uploadReceipt.single('receipt_file'), createReimbursement);
router.delete('/:reimbursementId', deleteReimbursement);
router.patch('/:reimbursementId/decision', decideReimbursement);

export default router;
