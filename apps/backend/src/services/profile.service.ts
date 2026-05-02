import { Employee, ActivityLog } from '../models/index';
import { ValidationError, NotFoundError } from '../utils/errors';
import { getReceiptUrl } from '../middlewares/upload';

class ProfileService {
  static async updateMyProfile(
    userId: string,
    employeeId: string,
    updates: any,
    photoFile: Express.Multer.File | undefined,
    clientIp: string
  ) {
    if (!employeeId) {
      throw new ValidationError('Employee ID required');
    }

    // Whitelist only self-editable fields.
    const allowedFields = ['full_name', 'phone', 'address', 'photo_url'];
    const filtered = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: updates[key] }), {} as any);

    // Add photo if uploaded
    if (photoFile) {
      filtered.photo_url = getReceiptUrl(photoFile.filename);
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    await employee.update(filtered);

    // Log activity
    try {
      await ActivityLog.create({
        actor_id: userId,
        action: 'UPDATE_PROFILE_SELF',
        target_type: 'Employee',
        target_id: employeeId,
        ip_address: clientIp,
      });
    } catch {}

    return {
      message: 'Profile berhasil diperbarui',
      employee: employee.toJSON(),
    };
  }

  static async updateEmployeeProfile(
    actorId: string,
    employeeId: string,
    updates: any,
    photoFile: Express.Multer.File | undefined,
    clientIp: string
  ) {
    // Whitelist only editable fields.
    const allowedFields = ['full_name', 'phone', 'address', 'photo_url'];
    const filtered = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: updates[key] }), {} as any);

    // Add photo if uploaded
    if (photoFile) {
      filtered.photo_url = getReceiptUrl(photoFile.filename);
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    await employee.update(filtered);

    // Log activity
    try {
      await ActivityLog.create({
        actor_id: actorId,
        action: 'UPDATE_PROFILE_ADMIN',
        target_type: 'Employee',
        target_id: employeeId,
        ip_address: clientIp,
      });
    } catch {}

    return {
      message: 'Profile employee berhasil diperbarui',
      employee: employee.toJSON(),
    };
  }
}

export default ProfileService;
