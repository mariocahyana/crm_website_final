'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add scanned_by and scanned_at fields to qr_tokens table
    await queryInterface.addColumn('qr_tokens', 'scanned_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('qr_tokens', 'scanned_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add index for quick lookup
    await queryInterface.addIndex('qr_tokens', ['scanned_by'], { name: 'qr_tokens_scanned_by_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('qr_tokens', 'qr_tokens_scanned_by_idx');
    await queryInterface.removeColumn('qr_tokens', 'scanned_at');
    await queryInterface.removeColumn('qr_tokens', 'scanned_by');
  },
};

