'use strict';

import { DataTypes, Model } from 'sequelize';

export default function PayslipModel(sequelize: any) {
  class Payslip extends Model {
    recalculate(): void {
      const baseSalary = Number(this.getDataValue('base_salary'));
      const totalIncentive = Number(this.getDataValue('total_incentive'));
      const totalBonus = Number(this.getDataValue('total_bonus'));
      const totalReimburse = Number(this.getDataValue('total_reimburse'));
      const totalPenalty = Number(this.getDataValue('total_penalty'));

      this.setDataValue('net_salary', baseSalary + totalIncentive + totalReimburse - totalPenalty);
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
}