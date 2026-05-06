import { Router } from 'express';
import { streamSSE } from '../controllers/stream.controller';

const router = Router();

router.get('/', streamSSE);

export default router;
