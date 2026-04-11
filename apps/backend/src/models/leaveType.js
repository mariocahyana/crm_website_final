'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class LeaveType extends Model {}

  LeaveType.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    is_paid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    max_days_per_year: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      validate: { min: 1 },
    },
  }, {
    sequelize,
    modelName: 'LeaveType',
    tableName: 'leave_types',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    scopes: {
      paid: { where: { is_paid: true } },
      unpaid: { where: { is_paid: false } },
    },
  });

  return LeaveType;
};
