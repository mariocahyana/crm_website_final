'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class EmployeeSchedule extends Model {}

  EmployeeSchedule.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    schedule_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    effective_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'EmployeeSchedule',
    tableName: 'employee_schedules',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return EmployeeSchedule;
};
