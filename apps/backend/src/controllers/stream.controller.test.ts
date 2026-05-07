import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as streamController from './stream.controller';
import * as jwtUtils from '../utils/jwt';
import notifications from '../services/notifications.service';

jest.mock('../utils/jwt');
jest.mock('../services/notifications.service');

describe('StreamController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      on: jest.fn(),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      write: jest.fn(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('streamSSE', () => {
    it('should establish SSE connection when token is valid', () => {
      mockReq.query = { token: 'valid-jwt-token' };
      (jwtUtils.verifyJwt as jest.Mock).mockReturnValue({ id: 'user-1' });
      (notifications.onPayslipChange as jest.Mock).mockReturnValue(jest.fn());

      streamController.streamSSE(mockReq as Request, mockRes as Response);

      expect(jwtUtils.verifyJwt).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.flushHeaders).toHaveBeenCalled();
      expect(notifications.onPayslipChange).toHaveBeenCalled();
    });

    it('should send events when payslip changes', () => {
      mockReq.query = { token: 'valid-jwt-token' };
      (jwtUtils.verifyJwt as jest.Mock).mockReturnValue({ id: 'user-1' });

      let sendCallback: ((payload: any) => void) | undefined;
      (notifications.onPayslipChange as jest.Mock).mockImplementation((cb) => {
        sendCallback = cb;
        return jest.fn();
      });

      streamController.streamSSE(mockReq as Request, mockRes as Response);

      const payload = { id: 'payslip-1', amount: 5000000 };
      sendCallback?.(payload);

      expect(mockRes.write).toHaveBeenCalledWith('event: payslip_changed\n');
      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify(payload)}\n\n`);
    });

    it('should return 401 when token is invalid', () => {
      mockReq.query = { token: 'invalid-token' };
      (jwtUtils.verifyJwt as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      streamController.streamSSE(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.end).toHaveBeenCalledWith('Unauthorized');
      expect(notifications.onPayslipChange).not.toHaveBeenCalled();
    });

    it('should return 401 when token is empty', () => {
      mockReq.query = {};
      (jwtUtils.verifyJwt as jest.Mock).mockImplementation(() => {
        throw new Error('Token required');
      });

      streamController.streamSSE(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.end).toHaveBeenCalledWith('Unauthorized');
    });

    it('should clean up listener when connection closes', () => {
      mockReq.query = { token: 'valid-jwt-token' };
      (jwtUtils.verifyJwt as jest.Mock).mockReturnValue({ id: 'user-1' });

      const offCallback = jest.fn();
      (notifications.onPayslipChange as jest.Mock).mockReturnValue(offCallback);

      streamController.streamSSE(mockReq as Request, mockRes as Response);

      const closeHandler = ((mockReq.on as jest.Mock).mock.calls[0] as any)[1];
      closeHandler();

      expect(offCallback).toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle errors when writing to stream', () => {
      mockReq.query = { token: 'valid-jwt-token' };
      (jwtUtils.verifyJwt as jest.Mock).mockReturnValue({ id: 'user-1' });

      let sendCallback: ((payload: any) => void) | undefined;
      (notifications.onPayslipChange as jest.Mock).mockImplementation((cb) => {
        sendCallback = cb;
        return jest.fn();
      });

      const error = new Error('Write error');
      (mockRes.write as jest.Mock).mockImplementation(() => {
        throw error;
      });

      streamController.streamSSE(mockReq as Request, mockRes as Response);

      // Should not throw
      expect(() => {
        sendCallback?.({ id: 'payslip-1' });
      }).not.toThrow();
    });

    it('should handle errors when ending response on close', () => {
      mockReq.query = { token: 'valid-jwt-token' };
      (jwtUtils.verifyJwt as jest.Mock).mockReturnValue({ id: 'user-1' });
      (notifications.onPayslipChange as jest.Mock).mockReturnValue(jest.fn());
      (mockRes.end as jest.Mock).mockImplementation(() => {
        throw new Error('End error');
      });

      streamController.streamSSE(mockReq as Request, mockRes as Response);

      const closeHandler = ((mockReq.on as jest.Mock).mock.calls[0] as any)[1];

      // Should not throw
      expect(() => {
        closeHandler();
      }).not.toThrow();
    });
  });
});
