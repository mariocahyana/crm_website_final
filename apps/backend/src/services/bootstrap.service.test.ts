import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BootstrapService from './bootstrap.service';
import AuthService from './auth.service';
import LeaveService from './leave.service';
import ReimbursementService from './reimbursement.service';
import UserManagementService from './userManagement.service';
import PayrollService from './payroll.service';
import AttendanceService from './attendance.service';

jest.mock('./auth.service');
jest.mock('./leave.service');
jest.mock('./reimbursement.service');
jest.mock('./userManagement.service');
jest.mock('./payroll.service');
jest.mock('./attendance.service');

describe('BootstrapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBootstrap', () => {
    it('should return complete bootstrap data for admin user', async () => {
      const mockMe = {
        user: { id: 'user-1', email: 'admin@example.com', role: 'admin' },
        employee: { id: 'emp-1', full_name: 'Admin User' },
      };
      const mockLeaveTypes = [{ id: 'type-1', name: 'Cuti Tahunan' }];
      const mockLeaveRequests = [{ id: 'req-1', status: 'pending' }];
      const mockReimbursements = [{ id: 'reimb-1', status: 'pending' }];
      const mockUsers = [{ id: 'user-1', email: 'admin@example.com' }];
      const mockOptions = { roles: ['admin', 'staff'] };
      const mockPayrollPeriods = [{ id: 'period-1', month: 5 }];
      const mockQrCode = { token: 'abc123' };

      (AuthService.getMe as jest.Mock).mockResolvedValue(mockMe);
      (LeaveService.listTypes as jest.Mock).mockResolvedValue(mockLeaveTypes);
      (LeaveService.listRequests as jest.Mock).mockResolvedValue(mockLeaveRequests);
      (ReimbursementService.listRequests as jest.Mock).mockResolvedValue(mockReimbursements);
      (UserManagementService.listUsers as jest.Mock).mockResolvedValue(mockUsers);
      (UserManagementService.getOptions as jest.Mock).mockResolvedValue(mockOptions);
      (PayrollService.listPeriods as jest.Mock).mockResolvedValue(mockPayrollPeriods);
      (AttendanceService.getAdminQrCode as jest.Mock).mockResolvedValue(mockQrCode);

      const result = await BootstrapService.getBootstrap({
        userId: 'user-1',
        role: 'admin',
        employeeId: 'emp-1',
      });

      expect(result).toHaveProperty('me', mockMe);
      expect(result).toHaveProperty('leaveTypes', mockLeaveTypes);
      expect(result).toHaveProperty('leaveRequests', mockLeaveRequests);
      expect(result).toHaveProperty('reimbursements', mockReimbursements);
      expect(result).toHaveProperty('users', mockUsers);
      expect(result).toHaveProperty('options', mockOptions);
      expect(result).toHaveProperty('payrollPeriods', mockPayrollPeriods);
      expect(result).toHaveProperty('attendanceQr', mockQrCode);
    });

    it('should return bootstrap data without admin data for staff user', async () => {
      const mockMe = {
        user: { id: 'user-2', email: 'staff@example.com', role: 'staff' },
        employee: { id: 'emp-2', full_name: 'Staff User' },
      };
      const mockLeaveTypes = [{ id: 'type-1', name: 'Cuti Tahunan' }];
      const mockLeaveRequests = [{ id: 'req-2', status: 'approved' }];
      const mockReimbursements = [{ id: 'reimb-2', status: 'approved' }];
      const mockPayslips = [{ id: 'payslip-1', amount: 5000000 }];

      (AuthService.getMe as jest.Mock).mockResolvedValue(mockMe);
      (LeaveService.listTypes as jest.Mock).mockResolvedValue(mockLeaveTypes);
      (LeaveService.listRequests as jest.Mock).mockResolvedValue(mockLeaveRequests);
      (ReimbursementService.listRequests as jest.Mock).mockResolvedValue(mockReimbursements);
      (PayrollService.listMyPayslips as jest.Mock).mockResolvedValue(mockPayslips);

      const result = await BootstrapService.getBootstrap({
        userId: 'user-2',
        role: 'staff',
        employeeId: 'emp-2',
      });

      expect(result).toHaveProperty('me', mockMe);
      expect(result).toHaveProperty('leaveTypes', mockLeaveTypes);
      expect(result).toHaveProperty('leaveRequests', mockLeaveRequests);
      expect(result).toHaveProperty('reimbursements', mockReimbursements);
      expect(result).toHaveProperty('myPayslips', mockPayslips);
      expect(result).not.toHaveProperty('users');
      expect(result).not.toHaveProperty('options');
      expect(result).not.toHaveProperty('payrollPeriods');
      expect(result).not.toHaveProperty('attendanceQr');
    });

    it('should handle manager role same as staff', async () => {
      const mockMe = {
        user: { id: 'user-3', email: 'manager@example.com', role: 'manager' },
        employee: { id: 'emp-3', full_name: 'Manager User' },
      };
      const mockLeaveTypes = [];
      const mockLeaveRequests = [];
      const mockReimbursements = [];
      const mockPayslips = [{ id: 'payslip-2', amount: 6000000 }];

      (AuthService.getMe as jest.Mock).mockResolvedValue(mockMe);
      (LeaveService.listTypes as jest.Mock).mockResolvedValue(mockLeaveTypes);
      (LeaveService.listRequests as jest.Mock).mockResolvedValue(mockLeaveRequests);
      (ReimbursementService.listRequests as jest.Mock).mockResolvedValue(mockReimbursements);
      (PayrollService.listMyPayslips as jest.Mock).mockResolvedValue(mockPayslips);

      const result = await BootstrapService.getBootstrap({
        userId: 'user-3',
        role: 'manager',
        employeeId: 'emp-3',
      });

      expect(result).toHaveProperty('myPayslips', mockPayslips);
      expect(result).not.toHaveProperty('users');
    });

    it('should use employee from me if auth context employee is undefined', async () => {
      const mockMe = {
        user: { id: 'user-1', email: 'admin@example.com', role: 'admin' },
        employee: { id: 'emp-1', full_name: 'Admin User' },
      };
      const mockLeaveTypes = [];
      const mockLeaveRequests = [];
      const mockReimbursements = [];
      const mockUsers = [];
      const mockOptions = {};
      const mockPayrollPeriods = [];
      const mockQrCode = {};

      (AuthService.getMe as jest.Mock).mockResolvedValue(mockMe);
      (LeaveService.listTypes as jest.Mock).mockResolvedValue(mockLeaveTypes);
      (LeaveService.listRequests as jest.Mock).mockResolvedValue(mockLeaveRequests);
      (ReimbursementService.listRequests as jest.Mock).mockResolvedValue(mockReimbursements);
      (UserManagementService.listUsers as jest.Mock).mockResolvedValue(mockUsers);
      (UserManagementService.getOptions as jest.Mock).mockResolvedValue(mockOptions);
      (PayrollService.listPeriods as jest.Mock).mockResolvedValue(mockPayrollPeriods);
      (AttendanceService.getAdminQrCode as jest.Mock).mockResolvedValue(mockQrCode);

      await BootstrapService.getBootstrap({
        userId: 'user-1',
        role: 'admin',
      });

      expect(AuthService.getMe).toHaveBeenCalledWith('user-1');
    });

    it('should handle undefined employee in me response', async () => {
      const mockMe = {
        user: { id: 'user-1', email: 'admin@example.com', role: 'admin' },
        employee: null,
      };
      const mockLeaveTypes = [];
      const mockLeaveRequests = [];
      const mockReimbursements = [];
      const mockUsers = [];
      const mockOptions = {};
      const mockPayrollPeriods = [];
      const mockQrCode = {};

      (AuthService.getMe as jest.Mock).mockResolvedValue(mockMe);
      (LeaveService.listTypes as jest.Mock).mockResolvedValue(mockLeaveTypes);
      (LeaveService.listRequests as jest.Mock).mockResolvedValue(mockLeaveRequests);
      (ReimbursementService.listRequests as jest.Mock).mockResolvedValue(mockReimbursements);
      (UserManagementService.listUsers as jest.Mock).mockResolvedValue(mockUsers);
      (UserManagementService.getOptions as jest.Mock).mockResolvedValue(mockOptions);
      (PayrollService.listPeriods as jest.Mock).mockResolvedValue(mockPayrollPeriods);
      (AttendanceService.getAdminQrCode as jest.Mock).mockResolvedValue(mockQrCode);

      const result = await BootstrapService.getBootstrap({
        userId: 'user-1',
        role: 'admin',
        employeeId: undefined,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('me', mockMe);
    });
  });
});
