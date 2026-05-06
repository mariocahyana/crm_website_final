import { Request, Response } from 'express';
import { verifyJwt } from '../utils/jwt';
import notifications from '../services/notifications.service';

export function streamSSE(req: Request, res: Response) {
  // support token via query param for EventSource
  const token = (req.query.token as string) || '';

  try {
    verifyJwt(token);
  } catch (err) {
    res.status(401).end('Unauthorized');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload: any) => {
    try {
      res.write(`event: payslip_changed\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      // ignore
    }
  };

  const off = notifications.onPayslipChange(send);

  req.on('close', () => {
    off();
    try { res.end(); } catch {}
  });
}
