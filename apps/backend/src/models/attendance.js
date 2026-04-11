'use strict';

const { DataTypes, Model, Op } = require('sequelize');

module.exports = (sequelize) => {
  class Attendance extends Model {
    get isLate() {
      return this.late_minutes > 0;
    }

    get isComplete() {
      return this.check_in_at !== null && this.check_out_at !== null;
    }
  }

  Attendance.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    check_in_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    check_out_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    late_minutes: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('present', 'absent', 'late', 'leave', 'holiday'),
      allowNull: false,
      defaultValue: 'absent',
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    edited_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Attendance',
    tableName: 'attendances',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    scopes: {
      byMonth: (year, month) => ({
        where: sequelize.where(
          sequelize.fn('DATE_TRUNC', 'month', sequelize.col('date')),
          new Date(year, month - 1, 1)
        ),
      }),
      late: { where: { status: 'late' } },
      present: { where: { status: ['present', 'late'] } },
    },
  });

  return Attendance;
};
