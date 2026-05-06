import AuthService from './auth.service';
import LeaveService from './leave.service';
import ReimbursementService from './reimbursement.service';
import UserManagementService from './userManagement.service';
import PayrollService from './payroll.service';
import AttendanceService from './attendance.service';

type AuthContext = {
  userId: string;
  role: 'admin' | 'staff' | 'manager';
  employeeId?: string | undefined;
};

class BootstrapService {
  static async getBootstrap(auth: AuthContext) {
    // Ensure we have fresh user+employee
    const me = await AuthService.getMe(auth.userId);
    const employeeId = me.employee?.id || auth.employeeId || undefined;
    const ctx: AuthContext = { userId: auth.userId, role: auth.role as any, employeeId };

    const tasks: any = {
      me,
      leaveTypes: LeaveService.listTypes(),
      leaveRequests: LeaveService.listRequests(ctx),
      reimbursements: ReimbursementService.listRequests(ctx),
    };

    if (auth.role === 'admin') {
      tasks.users = UserManagementService.listUsers();
      tasks.options = UserManagementService.getOptions();
      tasks.payrollPeriods = PayrollService.listPeriods();
      tasks.attendanceQr = AttendanceService.getAdminQrCode(auth.userId);
    } else {
      // staff/manager
      tasks.myPayslips = PayrollService.listMyPayslips(auth.userId, employeeId || undefined);
    }

    const results = await Promise.all(Object.values(tasks));
    const keys = Object.keys(tasks);
    const payload: any = {};
    for (let i = 0; i < keys.length; i += 1) {
      payload[keys[i]] = results[i];
    }

    return payload;
  }
}

export default BootstrapService;
