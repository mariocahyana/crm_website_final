'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Payslip extends Model {
    /**
     * Hitung ulang net_salary dari kolom agregat.
     * Dipanggil setelah semua payroll_items ditambahkan.
     */
    recalculate() {
      this.net_salary = (
        parseFloat(this.base_salary) +
        parseFloat(this.total_incentive) +
        parseFloat(this.total_bonus) +
        parseFloat(this.total_reimburse) -
        parseFloat(this.total_penalty)
      );
    }
  }

  Payslip.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    period_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    base_salary: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    total_incentive: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_penalty: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_bonus: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_reimburse: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    net_salary: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    sequelize,
    modelName: 'Payslip',
    tableName: 'payslips',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Payslip;
};
