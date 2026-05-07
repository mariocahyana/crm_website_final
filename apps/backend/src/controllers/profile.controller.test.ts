import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as profileController from './profile.controller';
import ProfileService from '../services/profile.service';
import * as responseUtils from '../utils/response';

jest.mock('../services/profile.service');
jest.mock('../utils/response');

describe('ProfileController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      query: {},
      params: {},
      authUser: { id: 'user-1', email: 'user@example.com', role: 'staff', employeeId: 'emp-1' },
      ip: '127.0.0.1',
      file: undefined,
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateMyProfile', () => {
    it('should update own profile when authenticated', async () => {
      mockReq.body = { phone: '08123456789', address: 'New Address' };
      const mockProfile = { id: 'emp-1', full_name: 'John Doe', phone: '08123456789' };
      (ProfileService.updateMyProfile as jest.Mock).mockResolvedValue(mockProfile);

      await profileController.updateMyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(ProfileService.updateMyProfile).toHaveBeenCalledWith(
        'user-1',
        'emp-1',
        mockReq.body,
        undefined,
        '127.0.0.1'
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockProfile,
        'Profile berhasil diperbarui'
      );
    });

    it('should upload profile photo if file provided', async () => {
      const mockFile = { filename: 'photo.jpg', mimetype: 'image/jpeg' };
      mockReq.body = { phone: '08123456789' };
      mockReq.file = mockFile as any;
      const mockProfile = { id: 'emp-1', photo_url: '/photos/photo.jpg' };
      (ProfileService.updateMyProfile as jest.Mock).mockResolvedValue(mockProfile);

      await profileController.updateMyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(ProfileService.updateMyProfile).toHaveBeenCalledWith(
        'user-1',
        'emp-1',
        mockReq.body,
        mockFile,
        '127.0.0.1'
      );
    });

    it('should return unauthorized when userId is missing', async () => {
      mockReq.authUser = { ...mockReq.authUser, id: undefined } as any;

      await profileController.updateMyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Missing auth context',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should return unauthorized when employeeId is missing', async () => {
      mockReq.authUser = { ...mockReq.authUser, employeeId: undefined } as any;

      await profileController.updateMyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Missing auth context',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = { phone: '08123456789' };
      const error = new Error('Profile update failed');
      (ProfileService.updateMyProfile as jest.Mock).mockRejectedValue(error);

      await profileController.updateMyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateAnyProfile', () => {
    it('should update other employee profile when authenticated', async () => {
      mockReq.params = { employeeId: 'emp-2' };
      mockReq.body = { phone: '08987654321', address: 'Employee Address' };
      const mockProfile = { id: 'emp-2', full_name: 'Jane Doe', phone: '08987654321' };
      (ProfileService.updateEmployeeProfile as jest.Mock).mockResolvedValue(mockProfile);

      await profileController.updateAnyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(ProfileService.updateEmployeeProfile).toHaveBeenCalledWith(
        'user-1',
        'emp-2',
        mockReq.body,
        undefined,
        '127.0.0.1'
      );
      expect(responseUtils.sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockProfile,
        'Profile employee berhasil diperbarui'
      );
    });

    it('should upload profile photo if file provided', async () => {
      mockReq.params = { employeeId: 'emp-2' };
      const mockFile = { filename: 'emp2-photo.jpg', mimetype: 'image/jpeg' };
      mockReq.body = { phone: '08987654321' };
      mockReq.file = mockFile as any;
      const mockProfile = { id: 'emp-2', photo_url: '/photos/emp2-photo.jpg' };
      (ProfileService.updateEmployeeProfile as jest.Mock).mockResolvedValue(mockProfile);

      await profileController.updateAnyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(ProfileService.updateEmployeeProfile).toHaveBeenCalledWith(
        'user-1',
        'emp-2',
        mockReq.body,
        mockFile,
        '127.0.0.1'
      );
    });

    it('should return unauthorized when not authenticated', async () => {
      mockReq.authUser = undefined;
      mockReq.params = { employeeId: 'emp-2' };

      await profileController.updateAnyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(responseUtils.sendError).toHaveBeenCalledWith(
        mockRes,
        'Not authenticated',
        401,
        'UNAUTHORIZED'
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { employeeId: 'emp-2' };
      mockReq.body = { phone: '08987654321' };
      const error = new Error('Employee not found');
      (ProfileService.updateEmployeeProfile as jest.Mock).mockRejectedValue(error);

      await profileController.updateAnyProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
