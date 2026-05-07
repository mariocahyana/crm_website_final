import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as healthController from './health.controller';

describe('HealthController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('getHealth', () => {
    it('should return health status ok', () => {
      healthController.getHealth(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          service: 'api',
          timestamp: expect.any(String),
        })
      );
    });

    it('should return ISO timestamp', () => {
      const beforeCall = new Date().toISOString();
      healthController.getHealth(mockReq as Request, mockRes as Response);
      const afterCall = new Date().toISOString();

      const callArgs = (mockRes.json as jest.Mock).mock.calls[0][0];
      const returnedTimestamp = new Date(callArgs.timestamp);

      const beforeTime = new Date(beforeCall).getTime();
      const afterTime = new Date(afterCall).getTime();
      const returnedTime = returnedTimestamp.getTime();

      expect(returnedTime).toBeGreaterThanOrEqual(beforeTime - 1000);
      expect(returnedTime).toBeLessThanOrEqual(afterTime + 1000);
    });
  });
});
