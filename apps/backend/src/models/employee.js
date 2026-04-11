'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Employee extends Model {
    getFullInfo() {
      return `${this.employee_number} - ${this.full_name}`;
    }
  }

  Employee.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    employee_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    full_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    department_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    manager_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    job_title: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    join_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    base_salary: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    sequelize,
    modelName: 'Employee',
    tableName: 'employees',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    scopes: {
      active: { where: { is_active: true } },
    },
  });

  return Employee;
};
