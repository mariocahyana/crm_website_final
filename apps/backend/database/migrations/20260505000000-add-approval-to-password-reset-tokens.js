'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('password_reset_tokens', 'approved_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('password_reset_tokens', 'approved_by', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('password_reset_tokens', 'approved_at');
    await queryInterface.removeColumn('password_reset_tokens', 'approved_by');
  },
};