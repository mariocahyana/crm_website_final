'use strict';

import { DataTypes, Model, Op } from 'sequelize';

export default function QrTokenModel(sequelize: any) {
  class QrToken extends Model {
    isExpired(): boolean {
      return new Date() > (this.getDataValue('expires_at') as Date);
    }

    isValid(): boolean {
      return !this.getDataValue('is_used') && !this.isExpired();
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
    scanned_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    scanned_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
          scanned_by: null,
          expires_at: { [Op.gt]: new Date() },
        },
      },
    },
  });

  return QrToken;
}