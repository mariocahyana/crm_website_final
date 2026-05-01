'use strict';

import { DataTypes, Model } from 'sequelize';

export default function UserModel(sequelize: any) {
  class User extends Model {
    isAdmin(): boolean {
      return this.getDataValue('role') === 'admin';
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'staff', 'manager'),
      allowNull: false,
      defaultValue: 'staff',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultScope: {
      attributes: { exclude: ['password_hash'] },
    },
    scopes: {
      withPassword: { attributes: { include: ['password_hash'] } },
      active: { where: { is_active: true } },
      admins: { where: { role: 'admin' } },
    },
  });

  return User;
}