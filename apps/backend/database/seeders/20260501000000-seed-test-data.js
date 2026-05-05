'use strict';

const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const bcrypt = require('bcryptjs');
    const now = new Date();

    // Generate UUIDs
    const deptHrId = generateUUID();
    const deptEngId = generateUUID();
    const userAdminId = generateUUID();
    const userManagerId = generateUUID();
    const userStaffId = generateUUID();
    const empAdminId = generateUUID();
    const empManagerId = generateUUID();
    const empStaffId = generateUUID();

    // Hash passwords
    const adminHash = await bcrypt.hash('admin123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);
    const staffHash = await bcrypt.hash('staff123', 10);

    try {
      // Create departments
      await queryInterface.bulkInsert('departments', [
        { 
          id: deptHrId, 
          name: 'HR', 
          parent_id: null,
          created_at: now, 
          updated_at: now 
        },
        { 
          id: deptEngId, 
          name: 'Engineering', 
          parent_id: null,
          created_at: now, 
          updated_at: now 
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
          created_at: now,
          updated_at: now,
        },
        {
          id: userManagerId,
          email: 'manager@company.com',
          password_hash: managerHash,
          role: 'manager',
          is_active: true,
          last_login_at: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: userStaffId,
          email: 'staff@company.com',
          password_hash: staffHash,
          role: 'staff',
          is_active: true,
          last_login_at: null,
          created_at: now,
          updated_at: now,
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
          base_salary: 15000000,
          join_date: now.toISOString().split('T')[0],
          job_title: 'Head of HR',
          department_id: deptHrId,
          manager_id: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: empManagerId,
          user_id: userManagerId,
          employee_number: 'EMP002',
          full_name: 'Manager User',
          phone: '08234567890',
          address: 'Jl. Manager Street No. 2',
          photo_url: null,
          base_salary: 12000000,
          join_date: now.toISOString().split('T')[0],
          job_title: 'Engineering Manager',
          department_id: deptEngId,
          manager_id: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: empStaffId,
          user_id: userStaffId,
          employee_number: 'EMP003',
          full_name: 'Staff User',
          phone: '08345678901',
          address: 'Jl. Staff Street No. 3',
          photo_url: null,
          base_salary: 8000000,
          join_date: now.toISOString().split('T')[0],
          job_title: 'Software Engineer',
          department_id: deptEngId,
          manager_id: empManagerId,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ]);

      console.log('✓ Seeder completed: 3 users (admin, manager, staff), 3 employees created');
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
