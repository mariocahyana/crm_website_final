'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class QrToken extends Model {
    isExpired() {
      return new Date() > this.expires_at;
    }

    isValid() {
      return !this.is_used && !this.isExpired();
    }
  }

  QrToken.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    valid_for_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'QrToken',
    tableName: 'qr_tokens',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    scopes: {
      valid: {
        where: {
          is_used: false,
          expires_at: { [sequelize.Sequelize.Op.gt]: new Date() },
        },
      },
    },
  });

  return QrToken;
};
