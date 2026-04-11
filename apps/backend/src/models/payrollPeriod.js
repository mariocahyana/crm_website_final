'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class PayrollPeriod extends Model {
    get label() {
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      return `${months[this.month - 1]} ${this.year}`;
    }

    get isDraft() { return this.status === 'draft'; }
    get isFinalized() { return this.status === 'finalized'; }
    get isPaid() { return this.status === 'paid'; }
  }

  PayrollPeriod.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    month: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: { min: 1, max: 12 },
    },
    year: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: { min: 2000 },
    },
    status: {
      type: DataTypes.ENUM('draft', 'finalized', 'paid'),
      allowNull: false,
      defaultValue: 'draft',
    },
    finalized_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'PayrollPeriod',
    tableName: 'payroll_periods',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    scopes: {
      draft: { where: { status: 'draft' } },
      finalized: { where: { status: 'finalized' } },
    },
  });

  return PayrollPeriod;
};
