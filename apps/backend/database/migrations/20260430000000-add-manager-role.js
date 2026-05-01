'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'manager' to the role enum type
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_users_role" ADD VALUE 'manager' AFTER 'staff'`
    );
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL doesn't easily support removing enum values
    // For rollback, you would need to recreate the type
    // This is a known limitation of PostgreSQL enums
  }
};
