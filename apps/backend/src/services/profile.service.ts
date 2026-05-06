import { Employee, ActivityLog } from '../models/index';
import { ValidationError, NotFoundError } from '../utils/errors';
import { getReceiptUrl } from '../middlewares/upload';

class ProfileService {
  private static async applyEmployeeUpdate(actorId: string, employeeId: string, filtered: any, action: string, clientIp: string) {
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    await employee.update(filtered);

    try {
      await ActivityLog.create({
        actor_id: actorId,
        action,
        target_type: 'Employee',
        target_id: employeeId,
        ip_address: clientIp,
      });
    } catch {}

    return employee;
  }
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

    const employee = await ProfileService.applyEmployeeUpdate(userId, employeeId, filtered, 'UPDATE_PROFILE_SELF', clientIp);

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

    const employee = await ProfileService.applyEmployeeUpdate(actorId, employeeId, filtered, 'UPDATE_PROFILE_ADMIN', clientIp);

    return {
      message: 'Profile employee berhasil diperbarui',
      employee: employee.toJSON(),
    };
  }
}

export default ProfileService;
