import { Router } from 'express';
import { getBootstrap } from '../controllers/bootstrap.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, getBootstrap);

export default router;
