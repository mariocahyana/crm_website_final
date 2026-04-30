'use strict';

const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const bcrypt = require('bcryptjs');

    // Generate UUIDs
    const deptHrId = generateUUID();
    const deptEngId = generateUUID();
    const userAdminId = generateUUID();
    const userStaffId = generateUUID();
    const empAdminId = generateUUID();
    const empStaffId = generateUUID();

    // Hash passwords
    const adminHash = await bcrypt.hash('admin123', 10);
    const staffHash = await bcrypt.hash('staff123', 10);

    try {
      // Create departments
      await queryInterface.bulkInsert('departments', [
        { 
          id: deptHrId, 
          name: 'HR', 
          parent_id: null,
          created_at: new Date(), 
          updated_at: new Date() 
        },
        { 
          id: deptEngId, 
          name: 'Engineering', 
          parent_id: null,
          created_at: new Date(), 
          updated_at: new Date() 
        },
      ]);

      // Create users
      await queryInterface.bulkInsert('users', [
        {
          id: userAdminId,
          email: 'admin@company.com',
          password_hash: adminHash,
          role: 'admin',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: userStaffId,
          email: 'staff@company.com',
          password_hash: staffHash,
          role: 'staff',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      // Create employees
      await queryInterface.bulkInsert('employees', [
        {
          id: empAdminId,
          user_id: userAdminId,
          employee_number: 'EMP001',
          full_name: 'Admin User',
          phone: '08123456789',
          address: 'Jl. Admin Street No. 1',
          photo_url: null,
          base_salary: 10000000,
          join_date: new Date().toISOString().split('T')[0],
          job_title: 'Head of HR',
          department_id: deptHrId,
          manager_id: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: empStaffId,
          user_id: userStaffId,
          employee_number: 'EMP002',
          full_name: 'Staff User',
          phone: '08987654321',
          address: 'Jl. Staff Street No. 2',
          photo_url: null,
          base_salary: 5000000,
          join_date: new Date().toISOString().split('T')[0],
          job_title: 'Software Engineer',
          department_id: deptEngId,
          manager_id: empAdminId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      console.log('✓ Seeder completed: 2 users, 2 employees, 2 departments created');
    } catch (error) {
      console.error('Seeder error:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('employees', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('departments', null, {});
  }
};
