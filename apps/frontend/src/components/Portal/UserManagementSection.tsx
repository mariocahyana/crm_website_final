import { useMemo, useState } from 'react';
import { validateUserForm, normalizePhoneValue } from '../../utils/validation';
import { usersApi, type ManagedUser, type UserManagementOptions } from '../../services/users';

interface UserManagementSectionProps {
  users: ManagedUser[];
  options: UserManagementOptions;
  loading: boolean;
  error: string;
  submitLoading: boolean;
  onLoadUsers: () => Promise<void>;
}

interface UserForm {
  full_name: string;
  email: string;
  password: string;
  role: 'admin' | 'staff' | 'manager';
  join_date: string;
  base_salary: number;
  job_title: string;
  phone: string;
  address: string;
  department_id: string;
  manager_id: string;
}

interface EditingState {
  userId: string | null;
  employeeId: string | null;
  snapshot: UserForm | null;
}

export function UserManagementSection({
  users,
  options,
  loading,
  error,
  submitLoading,
  onLoadUsers,
}: UserManagementSectionProps) {
  const [form, setForm] = useState<UserForm>({
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
    join_date: new Date().toISOString().slice(0, 10),
    base_salary: 0,
    job_title: '',
    phone: '',
    address: '',
    department_id: '',
    manager_id: '',
  });

  const [editing, setEditing] = useState<EditingState>({
    userId: null,
    employeeId: null,
    snapshot: null,
  });

  const [createdEmployeeNumber, setCreatedEmployeeNumber] = useState('');
  const [usersError, setUsersError] = useState(error);
  const [submitError, setSubmitError] = useState('');

  const activeUsers = useMemo(() => users.filter((u) => u.is_active).length, [users]);

  const getDefaultForm = (): UserForm => ({
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
    join_date: new Date().toISOString().slice(0, 10),
    base_salary: 0,
    job_title: '',
    phone: '',
    address: '',
    department_id: '',
    manager_id: '',
  });

  const formValidationError = useMemo(() => {
    return validateUserForm(
      form.full_name,
      form.email,
      form.password,
      form.department_id,
      form.join_date,
      form.base_salary,
      form.job_title,
      form.phone,
      form.address,
      form.role,
      form.manager_id,
      Boolean(editing.userId)
    );
  }, [form, editing.userId]);

  const formHasChanges = useMemo(() => {
    if (!editing.userId || !editing.snapshot) return false;

    return !(
      form.full_name.trim() === editing.snapshot.full_name.trim() &&
      form.email.trim() === editing.snapshot.email.trim() &&
      form.role === editing.snapshot.role &&
      form.join_date === editing.snapshot.join_date &&
      Number(form.base_salary) === editing.snapshot.base_salary &&
      form.job_title.trim() === editing.snapshot.job_title.trim() &&
      normalizePhoneValue(form.phone) === normalizePhoneValue(editing.snapshot.phone) &&
      form.address.trim() === editing.snapshot.address.trim() &&
      form.department_id === editing.snapshot.department_id &&
      (form.manager_id || '') === (editing.snapshot.manager_id || '')
    );
  }, [form, editing.userId, editing.snapshot]);

  const resetForm = () => {
    setForm(getDefaultForm());
    setEditing({ userId: null, employeeId: null, snapshot: null });
    setCreatedEmployeeNumber('');
    setSubmitError('');
  };

  const startEdit = (user: ManagedUser) => {
    setSubmitError('');
    const nextForm: UserForm = {
      full_name: user.employee?.full_name || '',
      email: user.email,
      password: '',
      role: user.role,
      join_date: user.employee?.join_date || new Date().toISOString().slice(0, 10),
      base_salary: Number(user.employee?.base_salary || 0),
      job_title: user.employee?.job_title || '',
      phone: user.employee?.phone || '',
      address: user.employee?.address || '',
      department_id: user.employee?.department_id || '',
      manager_id: user.employee?.manager_id || '',
    };

    setForm(nextForm);
    setEditing({
      userId: user.id,
      employeeId: user.employee?.id || null,
      snapshot: { ...nextForm },
    });
    setCreatedEmployeeNumber(user.employee?.employee_number || '');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formValidationError) {
      setSubmitError(formValidationError);
      return;
    }

    try {
      setSubmitError('');
      const response = await usersApi.createUser(
        // @ts-ignore - token is handled by API service
        '',
        {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: form.role,
          join_date: form.join_date,
          base_salary: Number(form.base_salary),
          job_title: form.job_title,
          phone: normalizePhoneValue(form.phone),
          address: form.address,
          department_id: form.department_id || null,
          manager_id: form.manager_id || null,
        }
      );

      setCreatedEmployeeNumber(response.employee?.employee_number || '');
      setForm(getDefaultForm());
      await onLoadUsers();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal membuat user');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing.userId) return;

    if (formValidationError) {
      setSubmitError(formValidationError);
      return;
    }

    if (!formHasChanges) {
      setSubmitError('Tidak ada perubahan pada data user');
      return;
    }

    try {
      setSubmitError('');
      await usersApi.updateUser(
        // @ts-ignore
        '',
        editing.userId,
        {
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          join_date: form.join_date,
          base_salary: Number(form.base_salary),
          job_title: form.job_title,
          phone: normalizePhoneValue(form.phone),
          address: form.address,
          department_id: form.department_id || null,
          manager_id: form.manager_id || null,
        }
      );

      resetForm();
      await onLoadUsers();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal memperbarui user');
    }
  };

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    try {
      await usersApi.updateUserStatus(
        // @ts-ignore
        '',
        userId,
        !isActive
      );
      await onLoadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Gagal update status');
    }
  };

  return (
    <section className="panel admin-panel">
      <h3>Manajemen User</h3>
      <p>Total user: {users.length} | Aktif: {activeUsers}</p>

      {usersError && <p className="inline-error">{usersError}</p>}
      {submitError && <p className="inline-error">{submitError}</p>}

      {editing.userId && (
        <div className="edit-banner">
          <span>Sedang edit user</span>
          <button type="button" className="ghost-btn" onClick={resetForm}>
            Batal
          </button>
        </div>
      )}

      {createdEmployeeNumber && !editing.userId && (
        <div className="success-banner">
          <p>User berhasil dibuat! Employee Number: <strong>{createdEmployeeNumber}</strong></p>
          <button type="button" className="ghost-btn" onClick={() => setCreatedEmployeeNumber('')}>
            Tutup
          </button>
        </div>
      )}

      <form className="user-form crm-form" onSubmit={editing.userId ? handleUpdate : handleCreate}>
        <div className="form-header">
          <h4>{editing.userId ? 'Edit User' : 'Tambah User Baru'}</h4>
        </div>

        {editing.userId && createdEmployeeNumber && (
          <div className="form-group form-read-only">
            <label>Employee Number</label>
            <div className="read-only-badge">{createdEmployeeNumber}</div>
          </div>
        )}

        <div className="form-section">
          <h5>Informasi Dasar</h5>
          <div className="form-row-two">
            <div className="form-group">
              <label>Nama Lengkap *</label>
              <input
                placeholder="Masukkan nama lengkap"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                required
                minLength={3}
                maxLength={100}
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                placeholder="Masukkan email @company.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
                maxLength={150}
                pattern="^[^\s@]+@company\.com$"
                title="Email harus menggunakan domain @company.com"
              />
            </div>
          </div>

          {!editing.userId && (
            <div className="form-row-one">
              <div className="form-group">
                <label>Password *</label>
                <input
                  placeholder="Masukkan password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={8}
                  maxLength={100}
                />
              </div>
            </div>
          )}
        </div>

        <div className="form-section">
          <h5>Organisasi</h5>
          <div className="form-row-three">
            <div className="form-group">
              <label>Department *</label>
              <select
                value={form.department_id}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    department_id: e.target.value,
                    manager_id: '',
                  }));
                }}
                required
              >
                <option value="">Pilih Department</option>
                {options.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            {form.role === 'staff' && (
              <div className="form-group">
                <label>Manager *</label>
                <select
                  value={form.manager_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, manager_id: e.target.value }))}
                  required
                >
                  <option value="">Pilih Manager</option>
                  {options.managers
                    .filter((manager) => manager.department_id === form.department_id && manager.id !== editing.employeeId)
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name} ({manager.employee_number})
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Role *</label>
              <select
                value={form.role}
                onChange={(e) => {
                  const nextRole = e.target.value as 'admin' | 'staff' | 'manager';
                  setForm((prev) => ({
                    ...prev,
                    role: nextRole,
                    manager_id: nextRole === 'staff' ? prev.manager_id : '',
                  }));
                }}
                required
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h5>Informasi Karyawan</h5>
          <div className="form-row-two">
            <div className="form-group">
              <label>Tanggal Bergabung *</label>
              <input
                type="date"
                value={form.join_date}
                onChange={(e) => setForm((prev) => ({ ...prev, join_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Gaji Pokok *</label>
              <input
                type="number"
                min={0}
                placeholder="Rp 0"
                value={form.base_salary}
                onChange={(e) => setForm((prev) => ({ ...prev, base_salary: Number(e.target.value) }))}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h5>Detail Tambahan</h5>
          <div className="form-row-two">
            <div className="form-group">
              <label>Job Title</label>
              <input
                placeholder="Masukkan job title"
                value={form.job_title}
                onChange={(e) => setForm((prev) => ({ ...prev, job_title: e.target.value }))}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                placeholder="Nomor telepon"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                required
                minLength={10}
                maxLength={20}
              />
            </div>
          </div>
          <div className="form-row-one">
            <div className="form-group">
              <label>Address</label>
              <input
                placeholder="Alamat lengkap"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                required
                minLength={15}
                maxLength={255}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          {!editing.userId ? (
            <button
              type="submit"
              disabled={submitLoading}
              className="primary-btn"
            >
              {submitLoading ? 'Menyimpan...' : 'Tambah User'}
            </button>
          ) : formHasChanges ? (
            <>
              <button type="button" className="secondary-btn" onClick={resetForm}>
                Batal
              </button>
              <button
                type="submit"
                disabled={submitLoading || Boolean(formValidationError)}
                className="primary-btn"
              >
                {submitLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </>
          ) : (
            <button type="button" className="secondary-btn" onClick={resetForm}>
              Batal
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Memuat data user...</p>
      ) : (
        <div className="user-list">
          {users.map((u) => (
            <div key={u.id} className="user-item">
              <div>
                <strong>{u.employee?.full_name || u.email}</strong>
                <p>{u.email} | {u.role.toUpperCase()} | {u.is_active ? 'ACTIVE' : 'INACTIVE'}</p>
              </div>
              <div className="user-actions">
                <button type="button" className="ghost-btn" onClick={() => startEdit(u)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={u.is_active ? 'danger-btn' : ''}
                  onClick={() => handleToggleStatus(u.id, u.is_active)}
                >
                  {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
