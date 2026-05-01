import { useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../services/auth';
import { profileApi } from '../services/profile';
import { usersApi, type ManagedUser, type UserManagementOptions } from '../services/users';

interface SessionUser {
  user: {
    id: string;
    email: string;
    role: 'admin' | 'staff' | 'manager';
  };
  employee: {
    id: string;
    full_name: string;
    phone: string;
    address: string;
    photo_url: string | null;
  } | null;
}

interface PortalPageProps {
  currentUser: SessionUser;
  onLogout: () => void;
  onEmployeeUpdate: (employee: SessionUser['employee']) => void;
}

export function PortalPage({ currentUser, onLogout, onEmployeeUpdate }: PortalPageProps) {
  const portalType = currentUser.user.role === 'admin'
    ? 'Admin'
    : currentUser.user.role === 'manager'
      ? 'Manager'
      : 'Staff';
  const canManageUsers = currentUser.user.role === 'admin';
  const employeeName = currentUser.employee?.full_name || 'User';
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [options, setOptions] = useState<UserManagementOptions>({
    departments: [],
    managers: [],
  });
  const hasLoadedAdminDataRef = useRef(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff' | 'manager',
    join_date: new Date().toISOString().slice(0, 10),
    base_salary: 0,
    job_title: '',
    phone: '',
    address: '',
    department_id: '',
    manager_id: '',
  });
  const [createdEmployeeNumber, setCreatedEmployeeNumber] = useState<string>('');
  const [profileForm, setProfileForm] = useState({
    phone: currentUser.employee?.phone || '',
    address: currentUser.employee?.address || '',
  });
  const token = auth.getToken();

  const activeUsers = useMemo(() => users.filter((u) => u.is_active).length, [users]);

  const resetForm = () => {
    setForm({
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
    setEditingUserId(null);
    setCreatedEmployeeNumber('');
  };

  const startEdit = (user: ManagedUser) => {
    setEditingUserId(user.id);
    setEditingEmployeeId(user.employee?.id || null);
    setUsersError('');
    setCreatedEmployeeNumber(user.employee?.employee_number || '');
    setForm({
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
    });
  };

  const loadUsers = async () => {
    if (!canManageUsers || !token) {
      return;
    }

    try {
      setUsersLoading(true);
      setUsersError('');
      const result = await usersApi.listUsers(token);
      setUsers(result);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Gagal memuat user');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadOptions = async () => {
    if (!canManageUsers || !token) {
      return;
    }

    try {
      const result = await usersApi.getOptions(token);
      setOptions(result);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Gagal memuat opsi dropdown');
    }
  };

  useEffect(() => {
    if (!canManageUsers || !token || hasLoadedAdminDataRef.current) {
      return;
    }

    hasLoadedAdminDataRef.current = true;
    void Promise.all([loadUsers(), loadOptions()]);
  }, [canManageUsers, token]);

  useEffect(() => {
    setProfileForm({
      phone: currentUser.employee?.phone || '',
      address: currentUser.employee?.address || '',
    });
  }, [currentUser.employee?.phone, currentUser.employee?.address]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentUser.employee) return;

    try {
      setProfileLoading(true);
      setProfileError('');
      setProfileMessage('');
      const employee = await profileApi.updateMyProfile(token, {
        phone: profileForm.phone,
        address: profileForm.address,
      });

      onEmployeeUpdate({
        ...currentUser.employee,
        phone: employee.phone || '',
        address: employee.address || '',
      });
      setProfileMessage('Profile berhasil diperbarui');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Gagal memperbarui profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setSubmitLoading(true);
      const response = await usersApi.createUser(token, {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        join_date: form.join_date,
        base_salary: Number(form.base_salary),
        job_title: form.job_title,
        phone: form.phone,
        address: form.address,
        department_id: form.department_id || null,
        manager_id: form.manager_id || null,
      });

      setCreatedEmployeeNumber(response.employee?.employee_number || '');
      setForm({
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
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Gagal membuat user');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingUserId) return;

    try {
      setSubmitLoading(true);
      await usersApi.updateUser(token, editingUserId, {
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        join_date: form.join_date,
        base_salary: Number(form.base_salary),
        job_title: form.job_title,
        phone: form.phone,
        address: form.address,
        department_id: form.department_id || null,
        manager_id: form.manager_id || null,
      });

      resetForm();
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Gagal memperbarui user');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    if (!token) return;
    try {
      await usersApi.updateUserStatus(token, userId, !isActive);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Gagal update status');
    }
  };

  return (
    <div className="portal-shell">
      <header className="portal-head">
        <div>
          <p className="eyebrow">{portalType} Portal</p>
          <h1>Selamat datang, {employeeName}</h1>
          <p className="subtext">Anda sudah login.</p>
        </div>
        <button onClick={onLogout} className="danger-btn">
          Logout
        </button>
      </header>

      <section className="panel">
        <h3>Informasi Akun</h3>
        <p><strong>Nama:</strong> {employeeName}</p>
        <p><strong>Email:</strong> {currentUser.user.email}</p>
        <p><strong>Role:</strong> {currentUser.user.role.toUpperCase()}</p>
      </section>

      <section className="panel profile-panel">
        <h3>Profile</h3>
        {currentUser.employee ? (
          <form className="profile-form" onSubmit={handleProfileUpdate}>
            {profileError && <p className="inline-error">{profileError}</p>}
            {profileMessage && <p className="inline-success">{profileMessage}</p>}

            <div className="form-row-two">
              <div className="form-group">
                <label>Nomor Telepon</label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Nomor telepon"
                  disabled={profileLoading}
                />
              </div>
              <div className="form-group">
                <label>Alamat</label>
                <input
                  value={profileForm.address}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Alamat"
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="form-actions compact-actions">
              <button type="submit" disabled={profileLoading} className="primary-btn">
                {profileLoading ? 'Menyimpan...' : 'Simpan Profile'}
              </button>
            </div>
          </form>
        ) : (
          <p>Data employee belum tersedia untuk akun ini.</p>
        )}
      </section>

      {canManageUsers && (
        <section className="panel admin-panel">
          <h3>Manajemen User</h3>
          <p>Total user: {users.length} | Aktif: {activeUsers}</p>

          {usersError && <p className="inline-error">{usersError}</p>}

          {editingUserId && (
            <div className="edit-banner">
              <span>Sedang edit user</span>
              <button type="button" className="ghost-btn" onClick={resetForm}>
                Batal
              </button>
            </div>
          )}

          {createdEmployeeNumber && !editingUserId && (
            <div className="success-banner">
              <p>User berhasil dibuat! Employee Number: <strong>{createdEmployeeNumber}</strong></p>
              <button type="button" className="ghost-btn" onClick={() => setCreatedEmployeeNumber('')}>
                Tutup
              </button>
            </div>
          )}

          <form className="user-form crm-form" onSubmit={editingUserId ? handleUpdateUser : handleCreateUser}>
            <div className="form-header">
              <h4>{editingUserId ? 'Edit User' : 'Tambah User Baru'}</h4>
            </div>

            {editingUserId && createdEmployeeNumber && (
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
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    placeholder="Masukkan email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {!editingUserId && (
                <div className="form-row-one">
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      placeholder="Masukkan password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
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
                    onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}
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
                <div className="form-group">
                  <label>Manager</label>
                  <select
                    value={form.manager_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, manager_id: e.target.value }))}
                  >
                    <option value="">Pilih Manager</option>
                    {options.managers
                      .filter((manager) => manager.id !== editingEmployeeId)
                      .map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name} ({manager.employee_number})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as 'admin' | 'staff' | 'manager' }))}
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
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    placeholder="Nomor telepon"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
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
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitLoading} className="primary-btn">
                {submitLoading ? 'Menyimpan...' : editingUserId ? 'Simpan Perubahan' : 'Tambah User'}
              </button>
              {editingUserId && (
                <button type="button" className="secondary-btn" onClick={resetForm}>
                  Batal
                </button>
              )}
            </div>
          </form>

          {usersLoading ? (
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
      )}
    </div>
  );
}
