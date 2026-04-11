'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class PasswordResetToken extends Model {
    isExpired() {
      return new Date() > this.expires_at;
    }

    isValid() {
      return !this.used_at && !this.isExpired();
    }
  }

  PasswordResetToken.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'PasswordResetToken',
    tableName: 'password_reset_tokens',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return PasswordResetToken;
};
