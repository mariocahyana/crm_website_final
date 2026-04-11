'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Reimbursement extends Model {
    get isPending() { return this.status === 'pending'; }
    get isApproved() { return this.status === 'approved'; }
    get isProcessed() { return this.payroll_item_id !== null; }
  }

  Reimbursement.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    receipt_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    expense_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'declined'),
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
    payroll_item_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Reimbursement',
    tableName: 'reimbursements',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    scopes: {
      pending: { where: { status: 'pending' } },
      approved: { where: { status: 'approved' } },
      unprocessed: { where: { status: 'approved', payroll_item_id: null } },
    },
  });

  return Reimbursement;
};
