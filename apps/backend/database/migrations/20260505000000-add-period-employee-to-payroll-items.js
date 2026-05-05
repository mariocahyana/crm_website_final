"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payroll_items', 'payroll_period_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'payroll_periods',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addColumn('payroll_items', 'employee_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.changeColumn('payroll_items', 'payslip_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('payroll_items', 'payslip_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.removeColumn('payroll_items', 'employee_id');
    await queryInterface.removeColumn('payroll_items', 'payroll_period_id');
  },
};
