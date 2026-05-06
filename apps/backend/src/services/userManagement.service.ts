import { sequelize, User, Employee, Department, ActivityLog } from '../models/index';
import { ValidationError, NotFoundError } from '../utils/errors';
import { hashPassword } from '../utils/password';

interface CreateUserInput {
  email: string;
  password: string;
  role: 'admin' | 'staff' | 'manager';
  full_name: string;
  join_date: string;
  base_salary: number;
  phone?: string;
  address?: string;
  job_title?: string;
  department_id?: string | null;
  manager_id?: string | null;
}

interface UpdateUserInput {
  email?: string;
  role?: 'admin' | 'staff' | 'manager';
  is_active?: boolean;
  full_name?: string;
  join_date?: string;
  base_salary?: number;
  phone?: string;
  address?: string;
  job_title?: string;
  department_id?: string | null;
  manager_id?: string | null;
}

interface UserManagementOptions {
  departments: Array<{
    id: string;
    name: string;
  }>;
  managers: Array<{
    id: string;
    full_name: string;
    employee_number: string;
    department_id: string | null;
  }>;
}

function sanitizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

class UserManagementService {
  private static async generateNextEmployeeNumber(): Promise<string> {
    const latestEmployee = await Employee.findOne({
      order: [['created_at', 'DESC']],
      attributes: ['employee_number'],
    });

    let nextNumber = 1001;
    if (latestEmployee) {
      const current = latestEmployee.getDataValue('employee_number') as string;
      const match = current.match(/\d+/);
      if (match) {
        nextNumber = parseInt(match[0], 10) + 1;
      }
    }

    return `EMP-${nextNumber.toString().padStart(5, '0')}`;
  }

  static async getOptions(): Promise<UserManagementOptions> {
    const [departments, managers] = await Promise.all([
      Department.findAll({
        order: [['name', 'ASC']],
        attributes: ['id', 'name'],
      }),
      Employee.findAll({
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['role'],
            where: { role: 'manager' },
            required: true,
          },
        ],
        order: [['full_name', 'ASC']],
        attributes: ['id', 'full_name', 'employee_number', 'department_id'],
      }),
    ]);

    return {
      departments: departments.map((department: any) => department.toJSON()),
      managers: managers.map((employee: any) => employee.toJSON()),
    };
  }

  static async listUsers() {
    const users = await User.findAll({
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Employee,
          as: 'employee',
          required: false,
        },
      ],
    });

    return users.map((u: any) => {
      const user = u.toJSON();
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        employee: user.employee
          ? {
              id: user.employee.id,
              employee_number: user.employee.employee_number,
              full_name: user.employee.full_name,
              job_title: user.employee.job_title,
              department_id: user.employee.department_id,
              manager_id: user.employee.manager_id,
              join_date: user.employee.join_date,
              base_salary: user.employee.base_salary,
              phone: user.employee.phone,
              address: user.employee.address,
              photo_url: user.employee.photo_url,
              is_active: user.employee.is_active,
            }
          : null,
      };
    });
  }

  static async createUser(actorId: string, input: CreateUserInput) {
    const email = sanitizeText(input.email)?.toLowerCase();
    const password = sanitizeText(input.password);
    const fullName = sanitizeText(input.full_name);

    if (!email || !password || !fullName) {
      throw new ValidationError('email, password, dan full_name wajib diisi');
    }

    if (!input.join_date || input.base_salary === undefined) {
      throw new ValidationError('join_date dan base_salary wajib diisi');
    }

    if (!['admin', 'staff', 'manager'].includes(input.role)) {
      throw new ValidationError('role harus admin, staff, atau manager');
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ValidationError('Email sudah terdaftar');
    }

    const employeeNumber = await this.generateNextEmployeeNumber();

    if (input.department_id) {
      const department = await Department.findByPk(input.department_id);
      if (!department) {
        throw new ValidationError('Department tidak ditemukan');
      }
    }

    if (input.manager_id) {
      const manager = await Employee.findByPk(input.manager_id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['role'],
          },
        ],
      });
      if (!manager) {
        throw new ValidationError('Manager tidak ditemukan');
      }
      const managerUser = manager.get('user') as any;
      if (!managerUser || managerUser.role !== 'manager') {
        throw new ValidationError('Manager yang dipilih harus memiliki role manager');
      }
    }

    const password_hash = await hashPassword(password);

    const result = await sequelize.transaction(async (t: any) => {
      const user = await User.create(
        {
          email,
          password_hash,
          role: input.role,
          is_active: true,
          last_login_at: null,
        },
        { transaction: t }
      );

      const employee = await Employee.create(
        {
          user_id: user.getDataValue('id'),
          employee_number: employeeNumber,
          full_name: fullName,
          join_date: input.join_date,
          base_salary: input.base_salary,
          phone: sanitizeText(input.phone) || null,
          address: sanitizeText(input.address) || null,
          job_title: sanitizeText(input.job_title) || null,
          department_id: input.department_id || null,
          manager_id: input.manager_id || null,
          is_active: true,
        },
        { transaction: t }
      );

      try {
        await ActivityLog.create(
          {
            actor_id: actorId,
            action: 'USER_CREATE',
            target_type: 'User',
            target_id: user.getDataValue('id'),
          },
          { transaction: t }
        );
      } catch {}

      return {
        user: user.toJSON(),
        employee: employee.toJSON(),
      };
    });

    return result;
  }

  static async updateUser(actorId: string, userId: string, input: UpdateUserInput) {
    const targetUser = await User.findByPk(userId);
    if (!targetUser) {
      throw new NotFoundError('User tidak ditemukan');
    }

    const targetEmployee = await Employee.findOne({ where: { user_id: userId } });
    if (!targetEmployee) {
      throw new NotFoundError('Employee tidak ditemukan');
    }

    const email = sanitizeText(input.email)?.toLowerCase();
    if (email && email !== targetUser.getDataValue('email')) {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        throw new ValidationError('Email sudah dipakai user lain');
      }
    }

    if (input.department_id) {
      const department = await Department.findByPk(input.department_id);
      if (!department) {
        throw new ValidationError('Department tidak ditemukan');
      }
    }

    if (input.manager_id) {
      if (input.manager_id === targetEmployee.getDataValue('id')) {
        throw new ValidationError('Manager tidak boleh diri sendiri');
      }
      const manager = await Employee.findByPk(input.manager_id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['role'],
          },
        ],
      });
      if (!manager) {
        throw new ValidationError('Manager tidak ditemukan');
      }
      const managerUser = manager.get('user') as any;
      if (!managerUser || managerUser.role !== 'manager') {
        throw new ValidationError('Manager yang dipilih harus memiliki role manager');
      }
    }

    await sequelize.transaction(async (t: any) => {
      const userUpdates: Record<string, unknown> = {};
      if (email) userUpdates.email = email;
      if (input.role) userUpdates.role = input.role;
      if (typeof input.is_active === 'boolean') userUpdates.is_active = input.is_active;

      if (Object.keys(userUpdates).length > 0) {
        await targetUser.update(userUpdates, { transaction: t });
      }

      const employeeUpdates: Record<string, unknown> = {};
      if (sanitizeText(input.full_name)) employeeUpdates.full_name = sanitizeText(input.full_name);
      if (input.join_date) employeeUpdates.join_date = input.join_date;
      if (typeof input.base_salary === 'number') employeeUpdates.base_salary = input.base_salary;
      if (typeof input.phone !== 'undefined') employeeUpdates.phone = sanitizeText(input.phone) || null;
      if (typeof input.address !== 'undefined') employeeUpdates.address = sanitizeText(input.address) || null;
      if (typeof input.job_title !== 'undefined') employeeUpdates.job_title = sanitizeText(input.job_title) || null;
      if (typeof input.department_id !== 'undefined') employeeUpdates.department_id = input.department_id || null;
      if (typeof input.manager_id !== 'undefined') employeeUpdates.manager_id = input.manager_id || null;
      if (typeof input.is_active === 'boolean') employeeUpdates.is_active = input.is_active;

      if (Object.keys(employeeUpdates).length > 0) {
        await targetEmployee.update(employeeUpdates, { transaction: t });
      }

      try {
        await ActivityLog.create(
          {
            actor_id: actorId,
            action: 'USER_UPDATE',
            target_type: 'User',
            target_id: userId,
          },
          { transaction: t }
        );
      } catch {}
    });

    const user = await User.findByPk(userId);
    const employee = await Employee.findOne({ where: { user_id: userId } });

    return {
      user: user?.toJSON() || null,
      employee: employee?.toJSON() || null,
    };
  }

  static async updateUserStatus(actorId: string, userId: string, isActive: boolean) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User tidak ditemukan');
    }

    const employee = await Employee.findOne({ where: { user_id: userId } });

    await sequelize.transaction(async (t: any) => {
      await user.update({ is_active: isActive }, { transaction: t });
      if (employee) {
        await employee.update({ is_active: isActive }, { transaction: t });
      }

      try {
        await ActivityLog.create(
          {
            actor_id: actorId,
            action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
            target_type: 'User',
            target_id: userId,
          },
          { transaction: t }
        );
      } catch {}
    });

    return {
      id: userId,
      is_active: isActive,
    };
  }
}

export default UserManagementService;
