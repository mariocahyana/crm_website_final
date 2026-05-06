'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('password_reset_tokens', 'token_value', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'token_hash',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('password_reset_tokens', 'token_value');
  },
};