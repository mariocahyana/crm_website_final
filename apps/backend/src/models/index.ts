import { Sequelize } from 'sequelize';
import config from '../config/database';
import User from './user';
import PasswordResetToken from './passwordResetToken';
import Department from './department';
import Employee from './employee';
import WorkSchedule from './workSchedule';
import EmployeeSchedule from './employeeSchedule';
import Attendance from './attendance';
import QrToken from './qrToken';
import LeaveType from './leaveType';
import LeaveRequest from './leaveRequest';
import Reimbursement from './reimbursement';
import PayrollPeriod from './payrollPeriod';
import Payslip from './payslip';
import PayrollItem from './payrollItem';
import ActivityLog from './activityLog';

const env = process.env.NODE_ENV || 'development';
const dbConfig = (config as Record<string, any>)[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig,
);

const UserModel = User(sequelize);
const PasswordResetTokenModel = PasswordResetToken(sequelize);
const DepartmentModel = Department(sequelize);
const EmployeeModel = Employee(sequelize);
const WorkScheduleModel = WorkSchedule(sequelize);
const EmployeeScheduleModel = EmployeeSchedule(sequelize);
const AttendanceModel = Attendance(sequelize);
const QrTokenModel = QrToken(sequelize);
const LeaveTypeModel = LeaveType(sequelize);
const LeaveRequestModel = LeaveRequest(sequelize);
const ReimbursementModel = Reimbursement(sequelize);
const PayrollPeriodModel = PayrollPeriod(sequelize);
const PayslipModel = Payslip(sequelize);
const PayrollItemModel = PayrollItem(sequelize);
const ActivityLogModel = ActivityLog(sequelize);

UserModel.hasOne(PasswordResetTokenModel, { foreignKey: 'user_id', as: 'passwordResetToken' });
PasswordResetTokenModel.belongsTo(UserModel, { foreignKey: 'user_id', as: 'user' });

UserModel.hasOne(EmployeeModel, { foreignKey: 'user_id', as: 'employee' });
EmployeeModel.belongsTo(UserModel, { foreignKey: 'user_id', as: 'user' });

DepartmentModel.hasMany(DepartmentModel, { foreignKey: 'parent_id', as: 'children' });
DepartmentModel.belongsTo(DepartmentModel, { foreignKey: 'parent_id', as: 'parent' });

DepartmentModel.hasMany(EmployeeModel, { foreignKey: 'department_id', as: 'employees' });
EmployeeModel.belongsTo(DepartmentModel, { foreignKey: 'department_id', as: 'department' });

EmployeeModel.hasMany(EmployeeModel, { foreignKey: 'manager_id', as: 'subordinates' });
EmployeeModel.belongsTo(EmployeeModel, { foreignKey: 'manager_id', as: 'manager' });

EmployeeModel.hasMany(AttendanceModel, { foreignKey: 'employee_id', as: 'attendances' });
AttendanceModel.belongsTo(EmployeeModel, { foreignKey: 'employee_id', as: 'employee' });

UserModel.hasMany(AttendanceModel, { foreignKey: 'edited_by', as: 'editedAttendances' });
AttendanceModel.belongsTo(UserModel, { foreignKey: 'edited_by', as: 'editor' });

EmployeeModel.hasMany(EmployeeScheduleModel, { foreignKey: 'employee_id', as: 'schedules' });
EmployeeScheduleModel.belongsTo(EmployeeModel, { foreignKey: 'employee_id', as: 'employee' });

WorkScheduleModel.hasMany(EmployeeScheduleModel, { foreignKey: 'schedule_id', as: 'assignments' });
EmployeeScheduleModel.belongsTo(WorkScheduleModel, { foreignKey: 'schedule_id', as: 'workSchedule' });

UserModel.hasMany(QrTokenModel, { foreignKey: 'created_by', as: 'qrTokens' });
QrTokenModel.belongsTo(UserModel, { foreignKey: 'created_by', as: 'creator' });

LeaveTypeModel.hasMany(LeaveRequestModel, { foreignKey: 'leave_type_id', as: 'requests' });
LeaveRequestModel.belongsTo(LeaveTypeModel, { foreignKey: 'leave_type_id', as: 'leaveType' });

EmployeeModel.hasMany(LeaveRequestModel, { foreignKey: 'employee_id', as: 'leaveRequests' });
LeaveRequestModel.belongsTo(EmployeeModel, { foreignKey: 'employee_id', as: 'employee' });

EmployeeModel.hasMany(LeaveRequestModel, { foreignKey: 'approved_by', as: 'approvedLeaves' });
LeaveRequestModel.belongsTo(EmployeeModel, { foreignKey: 'approved_by', as: 'approver' });

EmployeeModel.hasMany(ReimbursementModel, { foreignKey: 'employee_id', as: 'reimbursements' });
ReimbursementModel.belongsTo(EmployeeModel, { foreignKey: 'employee_id', as: 'employee' });

EmployeeModel.hasMany(ReimbursementModel, { foreignKey: 'approved_by', as: 'approvedReimbursements' });
ReimbursementModel.belongsTo(EmployeeModel, { foreignKey: 'approved_by', as: 'approver' });

PayrollItemModel.hasOne(ReimbursementModel, { foreignKey: 'payroll_item_id', as: 'reimbursement' });
ReimbursementModel.belongsTo(PayrollItemModel, { foreignKey: 'payroll_item_id', as: 'payrollItem' });

UserModel.hasMany(PayrollPeriodModel, { foreignKey: 'created_by', as: 'payrollPeriods' });
PayrollPeriodModel.belongsTo(UserModel, { foreignKey: 'created_by', as: 'creator' });

PayrollPeriodModel.hasMany(PayslipModel, { foreignKey: 'period_id', as: 'payslips' });
PayslipModel.belongsTo(PayrollPeriodModel, { foreignKey: 'period_id', as: 'period' });

EmployeeModel.hasMany(PayslipModel, { foreignKey: 'employee_id', as: 'payslips' });
PayslipModel.belongsTo(EmployeeModel, { foreignKey: 'employee_id', as: 'employee' });

PayslipModel.hasMany(PayrollItemModel, { foreignKey: 'payslip_id', as: 'items' });
PayrollItemModel.belongsTo(PayslipModel, { foreignKey: 'payslip_id', as: 'payslip' });

UserModel.hasMany(PayrollItemModel, { foreignKey: 'created_by', as: 'payrollItems' });
PayrollItemModel.belongsTo(UserModel, { foreignKey: 'created_by', as: 'creator' });

UserModel.hasMany(ActivityLogModel, { foreignKey: 'actor_id', as: 'activityLogs' });
ActivityLogModel.belongsTo(UserModel, { foreignKey: 'actor_id', as: 'actor' });

export {
  sequelize,
  Sequelize,
  UserModel as User,
  PasswordResetTokenModel as PasswordResetToken,
  DepartmentModel as Department,
  EmployeeModel as Employee,
  WorkScheduleModel as WorkSchedule,
  EmployeeScheduleModel as EmployeeSchedule,
  AttendanceModel as Attendance,
  QrTokenModel as QrToken,
  LeaveTypeModel as LeaveType,
  LeaveRequestModel as LeaveRequest,
  ReimbursementModel as Reimbursement,
  PayrollPeriodModel as PayrollPeriod,
  PayslipModel as Payslip,
  PayrollItemModel as PayrollItem,
  ActivityLogModel as ActivityLog,
};

export default {
  sequelize,
  Sequelize,
  User: UserModel,
  PasswordResetToken: PasswordResetTokenModel,
  Department: DepartmentModel,
  Employee: EmployeeModel,
  WorkSchedule: WorkScheduleModel,
  EmployeeSchedule: EmployeeScheduleModel,
  Attendance: AttendanceModel,
  QrToken: QrTokenModel,
  LeaveType: LeaveTypeModel,
  LeaveRequest: LeaveRequestModel,
  Reimbursement: ReimbursementModel,
  PayrollPeriod: PayrollPeriodModel,
  Payslip: PayslipModel,
  PayrollItem: PayrollItemModel,
  ActivityLog: ActivityLogModel,
};