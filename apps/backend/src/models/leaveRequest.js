'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class LeaveRequest extends Model {
    get isPending() { return this.status === 'pending'; }
    get isApproved() { return this.status === 'approved'; }
    get isDeclined() { return this.status === 'declined'; }
  }

  LeaveRequest.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    leave_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isAfterStart(value) {
          if (value < this.start_date) {
            throw new Error('end_date tidak boleh sebelum start_date');
          }
        },
      },
    },
    total_days: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: { min: 1 },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'declined', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    decline_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'LeaveRequest',
    tableName: 'leave_requests',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    scopes: {
      pending: { where: { status: 'pending' } },
      approved: { where: { status: 'approved' } },
      byEmployee: (employeeId) => ({ where: { employee_id: employeeId } }),
    },
  });

  return LeaveRequest;
};
