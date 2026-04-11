'use strict';

const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig
);

// Import all models
const User                = require('./user')(sequelize);
const PasswordResetToken  = require('./passwordResetToken')(sequelize);
const Department          = require('./department')(sequelize);
const Employee            = require('./employee')(sequelize);
const WorkSchedule        = require('./workSchedule')(sequelize);
const EmployeeSchedule    = require('./employeeSchedule')(sequelize);
const Attendance          = require('./attendance')(sequelize);
const QrToken             = require('./qrToken')(sequelize);
const LeaveType           = require('./leaveType')(sequelize);
const LeaveRequest        = require('./leaveRequest')(sequelize);
const Reimbursement       = require('./reimbursement')(sequelize);
const PayrollPeriod       = require('./payrollPeriod')(sequelize);
const Payslip             = require('./payslip')(sequelize);
const PayrollItem         = require('./payrollItem')(sequelize);
const ActivityLog         = require('./activityLog')(sequelize);

// ── Auth ──────────────────────────────────────────────
User.hasOne(PasswordResetToken, { foreignKey: 'user_id', as: 'passwordResetToken' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasOne(Employee, { foreignKey: 'user_id', as: 'employee' });
Employee.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Department (self-ref) ─────────────────────────────
Department.hasMany(Department, { foreignKey: 'parent_id', as: 'children' });
Department.belongsTo(Department, { foreignKey: 'parent_id', as: 'parent' });

Department.hasMany(Employee, { foreignKey: 'department_id', as: 'employees' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

// ── Employee (self-ref manager tree) ─────────────────
Employee.hasMany(Employee, { foreignKey: 'manager_id', as: 'subordinates' });
Employee.belongsTo(Employee, { foreignKey: 'manager_id', as: 'manager' });

// ── Attendance ────────────────────────────────────────
Employee.hasMany(Attendance, { foreignKey: 'employee_id', as: 'attendances' });
Attendance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

User.hasMany(Attendance, { foreignKey: 'edited_by', as: 'editedAttendances' });
Attendance.belongsTo(User, { foreignKey: 'edited_by', as: 'editor' });

// ── Work Schedule ─────────────────────────────────────
Employee.hasMany(EmployeeSchedule, { foreignKey: 'employee_id', as: 'schedules' });
EmployeeSchedule.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

WorkSchedule.hasMany(EmployeeSchedule, { foreignKey: 'schedule_id', as: 'assignments' });
EmployeeSchedule.belongsTo(WorkSchedule, { foreignKey: 'schedule_id', as: 'workSchedule' });

// ── QR Token ──────────────────────────────────────────
User.hasMany(QrToken, { foreignKey: 'created_by', as: 'qrTokens' });
QrToken.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ── Leave ─────────────────────────────────────────────
LeaveType.hasMany(LeaveRequest, { foreignKey: 'leave_type_id', as: 'requests' });
LeaveRequest.belongsTo(LeaveType, { foreignKey: 'leave_type_id', as: 'leaveType' });

Employee.hasMany(LeaveRequest, { foreignKey: 'employee_id', as: 'leaveRequests' });
LeaveRequest.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Employee.hasMany(LeaveRequest, { foreignKey: 'approved_by', as: 'approvedLeaves' });
LeaveRequest.belongsTo(Employee, { foreignKey: 'approved_by', as: 'approver' });

// ── Reimbursement ─────────────────────────────────────
Employee.hasMany(Reimbursement, { foreignKey: 'employee_id', as: 'reimbursements' });
Reimbursement.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Employee.hasMany(Reimbursement, { foreignKey: 'approved_by', as: 'approvedReimbursements' });
Reimbursement.belongsTo(Employee, { foreignKey: 'approved_by', as: 'approver' });

PayrollItem.hasOne(Reimbursement, { foreignKey: 'payroll_item_id', as: 'reimbursement' });
Reimbursement.belongsTo(PayrollItem, { foreignKey: 'payroll_item_id', as: 'payrollItem' });

// ── Payroll ───────────────────────────────────────────
User.hasMany(PayrollPeriod, { foreignKey: 'created_by', as: 'payrollPeriods' });
PayrollPeriod.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

PayrollPeriod.hasMany(Payslip, { foreignKey: 'period_id', as: 'payslips' });
Payslip.belongsTo(PayrollPeriod, { foreignKey: 'period_id', as: 'period' });

Employee.hasMany(Payslip, { foreignKey: 'employee_id', as: 'payslips' });
Payslip.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Payslip.hasMany(PayrollItem, { foreignKey: 'payslip_id', as: 'items' });
PayrollItem.belongsTo(Payslip, { foreignKey: 'payslip_id', as: 'payslip' });

User.hasMany(PayrollItem, { foreignKey: 'created_by', as: 'payrollItems' });
PayrollItem.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ── Activity Log ──────────────────────────────────────
User.hasMany(ActivityLog, { foreignKey: 'actor_id', as: 'activityLogs' });
ActivityLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  PasswordResetToken,
  Department,
  Employee,
  WorkSchedule,
  EmployeeSchedule,
  Attendance,
  QrToken,
  LeaveType,
  LeaveRequest,
  Reimbursement,
  PayrollPeriod,
  Payslip,
  PayrollItem,
  ActivityLog,
};
