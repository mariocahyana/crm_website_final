import { useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../services/auth';
import { leavesApi, type LeaveRequest, type LeaveType } from '../services/leaves';
import { profileApi } from '../services/profile';
import { reimbursementsApi, type ReimbursementRequest } from '../services/reimbursements';
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
    join_date?: string;
    job_title?: string;
  } | null;
}

interface PortalPageProps {
  currentUser: SessionUser;
  onLogout: () => void;
  onEmployeeUpdate: (employee: SessionUser['employee']) => void;
}

type PortalMenu = 'overview' | 'profile' | 'leave' | 'reimburse' | 'users';

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

const dayFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
});

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isDateWithinRange(dateKey: string, startDate: string, endDate: string) {
  return dateKey >= startDate && dateKey <= endDate;
}

export function PortalPage({ currentUser, onLogout, onEmployeeUpdate }: PortalPageProps) {
  const defaultProfilePhoto = '/images/default-profile.svg';
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
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSubmitLoading, setLeaveSubmitLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveMessage, setLeaveMessage] = useState('');
  const [reimbursementRequests, setReimbursementRequests] = useState<ReimbursementRequest[]>([]);
  const [reimbursementLoading, setReimbursementLoading] = useState(false);
  const [reimbursementSubmitLoading, setReimbursementSubmitLoading] = useState(false);
  const [reimbursementError, setReimbursementError] = useState('');
  const [reimbursementMessage, setReimbursementMessage] = useState('');
  const [activeMenu, setActiveMenu] = useState<PortalMenu>('overview');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
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
    full_name: currentUser.employee?.full_name || '',
    phone: currentUser.employee?.phone || '',
    address: currentUser.employee?.address || '',
    photo_file: null as File | null,
    photo_deleted: false,
  });
  const [leaveForm, setLeaveForm] = useState({
    leave_type_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [reimbursementForm, setReimbursementForm] = useState({
    category: 'Transport',
    amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
    receipt_file: null as File | null,
  });
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const token = auth.getToken();

  const getDefaultProfileForm = () => ({
    full_name: currentUser.employee?.full_name || '',
    phone: currentUser.employee?.phone || '',
    address: currentUser.employee?.address || '',
    photo_file: null as File | null,
    photo_deleted: false,
  });

  const getDefaultLeaveForm = () => ({
    leave_type_id: leaveTypes[0]?.id || '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const getDefaultReimbursementForm = () => ({
    category: 'Transport',
    amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
    receipt_file: null as File | null,
  });

  const getDefaultUserForm = () => ({
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

  const handleViewPhoto = (receiptUrl: string | null) => {
    if (receiptUrl) {
      let fullUrl: string;
      
      if (receiptUrl.startsWith('http')) {
        fullUrl = receiptUrl;
      } else {
        // receiptUrl format: /uploads/filename
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const baseUrl = apiBase.replace('/api', ''); // Remove /api to get http://localhost:5000
        fullUrl = baseUrl + receiptUrl;
      }
      
      console.log('Opening photo:', fullUrl); // Debug
      setSelectedPhotoUrl(fullUrl);
      setPhotoModalOpen(true);
    }
  };

  const getFullPhotoUrl = (photoUrl: string | null | undefined): string | null => {
    if (!photoUrl) return null;
    
    if (photoUrl.startsWith('http')) {
      return photoUrl;
    } else {
      // photoUrl format: /uploads/filename
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const baseUrl = apiBase.replace('/api', ''); // Remove /api to get http://localhost:5000
      return baseUrl + photoUrl;
    }
  };

  const currentProfilePhotoSrc = profileForm.photo_deleted
    ? defaultProfilePhoto
    : getFullPhotoUrl(currentUser.employee?.photo_url) ?? defaultProfilePhoto;

  const headerProfilePhotoSrc = getFullPhotoUrl(currentUser.employee?.photo_url) ?? defaultProfilePhoto;

  const handleClosePhotoModal = () => {
    setPhotoModalOpen(false);
    setSelectedPhotoUrl(null);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    setReimbursementForm((prev) => ({ ...prev, receipt_file: file }));

    // revoke previous preview URL if any
    if (receiptPreviewUrl) {
      try { URL.revokeObjectURL(receiptPreviewUrl); } catch {}
      setReceiptPreviewUrl(null);
    }

    if (file) {
      const objUrl = URL.createObjectURL(file);
      setReceiptPreviewUrl(objUrl);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    setProfileForm((prev) => ({ ...prev, photo_file: file }));

    // revoke previous preview URL if any
    if (photoPreviewUrl) {
      try { URL.revokeObjectURL(photoPreviewUrl); } catch {}
      setPhotoPreviewUrl(null);
    }

    if (file) {
      const objUrl = URL.createObjectURL(file);
      setPhotoPreviewUrl(objUrl);
    }
  };

  const resetProfileDraft = () => {
    if (photoPreviewUrl) {
      try { URL.revokeObjectURL(photoPreviewUrl); } catch {}
    }

    setProfileForm({
      full_name: currentUser.employee?.full_name || '',
      phone: currentUser.employee?.phone || '',
      address: currentUser.employee?.address || '',
      photo_file: null,
      photo_deleted: false,
    });

    if (photoInputRef.current) {
      try { photoInputRef.current.value = ''; } catch {}
    }

    setPhotoPreviewUrl(null);
    setProfileError('');
    setProfileMessage('');
  };

  const handleMenuChange = (nextMenu: PortalMenu) => {
    if (activeMenu === 'profile' && nextMenu !== 'profile') {
      resetProfileDraft();
    }

    if (activeMenu === 'leave' && nextMenu !== 'leave') {
      setLeaveForm(getDefaultLeaveForm());
      setLeaveError('');
      setLeaveMessage('');
    }

    if (activeMenu === 'reimburse' && nextMenu !== 'reimburse') {
      if (receiptPreviewUrl) {
        try { URL.revokeObjectURL(receiptPreviewUrl); } catch {}
      }

      setReimbursementForm(getDefaultReimbursementForm());
      setReimbursementError('');
      setReimbursementMessage('');
      setReceiptPreviewUrl(null);
      if (receiptInputRef.current) {
        try { receiptInputRef.current.value = ''; } catch {}
      }
    }

    if (activeMenu === 'users' && nextMenu !== 'users') {
      resetForm();
      setEditingUserId(null);
      setEditingEmployeeId(null);
      setCreatedEmployeeNumber('');
      setUsersError('');
    }

    setActiveMenu(nextMenu);
  };

  const activeUsers = useMemo(() => users.filter((u) => u.is_active).length, [users]);
  const canReviewLeaves = currentUser.user.role === 'admin' || currentUser.user.role === 'manager';
  const portalMenus = useMemo(() => {
    const menus: Array<{ id: PortalMenu; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'profile', label: 'Profile' },
      { id: 'leave', label: 'Leave' },
      { id: 'reimburse', label: 'Reimburse' },
    ];

    if (canManageUsers) {
      menus.push({ id: 'users', label: 'User Management' });
    }

    return menus;
  }, [canManageUsers]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlankDays = firstDay.getDay();
    const days: Array<{
      key: string;
      date: Date | null;
      dayNumber: number | null;
      requests: LeaveRequest[];
    }> = [];

    for (let i = 0; i < leadingBlankDays; i += 1) {
      days.push({ key: `blank-${i}`, date: null, dayNumber: null, requests: [] });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const dateKey = toDateKey(date);
      days.push({
        key: dateKey,
        date,
        dayNumber: day,
        requests: leaveRequests.filter((request) => (
          request.status !== 'cancelled'
          && isDateWithinRange(dateKey, request.start_date, request.end_date)
        )),
      });
    }

    return days;
  }, [calendarMonth, leaveRequests]);

  const leaveSummary = useMemo(() => ({
    pending: leaveRequests.filter((request) => request.status === 'pending').length,
    approved: leaveRequests.filter((request) => request.status === 'approved').length,
    declined: leaveRequests.filter((request) => request.status === 'declined').length,
  }), [leaveRequests]);
  const reimbursementSummary = useMemo(() => ({
    pending: reimbursementRequests.filter((request) => request.status === 'pending').length,
    approved: reimbursementRequests.filter((request) => request.status === 'approved').length,
    declined: reimbursementRequests.filter((request) => request.status === 'declined').length,
    totalApproved: reimbursementRequests
      .filter((request) => request.status === 'approved')
      .reduce((sum, request) => sum + Number(request.amount || 0), 0),
  }), [reimbursementRequests]);

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
    setProfileForm(getDefaultProfileForm());
    // Reset photo preview when user changes
    if (photoPreviewUrl) {
      try { URL.revokeObjectURL(photoPreviewUrl); } catch {}
      setPhotoPreviewUrl(null);
    }
  }, [
    currentUser.employee?.full_name,
    currentUser.employee?.phone,
    currentUser.employee?.address,
    currentUser.employee?.photo_url,
  ]);

  useEffect(() => {
    setLeaveForm((current) => ({
      ...current,
      leave_type_id: current.leave_type_id || leaveTypes[0]?.id || '',
    }));
  }, [leaveTypes]);

  const loadLeaves = async () => {
    if (!token) return;

    try {
      setLeaveLoading(true);
      setLeaveError('');
      const [types, requests] = await Promise.all([
        leavesApi.listTypes(token),
        leavesApi.listRequests(token),
      ]);
      setLeaveTypes(types);
      setLeaveRequests(requests);
      setLeaveForm((prev) => ({
        ...prev,
        leave_type_id: prev.leave_type_id || types[0]?.id || '',
      }));
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal memuat data cuti');
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaves();
  }, [token]);

  const loadReimbursements = async () => {
    if (!token) return;

    try {
      setReimbursementLoading(true);
      setReimbursementError('');
      const requests = await reimbursementsApi.listRequests(token);
      setReimbursementRequests(requests);
    } catch (err) {
      setReimbursementError(err instanceof Error ? err.message : 'Gagal memuat data reimburse');
    } finally {
      setReimbursementLoading(false);
    }
  };

  useEffect(() => {
    void loadReimbursements();
  }, [token]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentUser.employee) return;

    try {
      setProfileLoading(true);
      setProfileError('');
      setProfileMessage('');
      const employee = await profileApi.updateMyProfile(token, {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
        address: profileForm.address,
        photo_file: profileForm.photo_file || undefined,
        photo_deleted: profileForm.photo_deleted,
      });

      onEmployeeUpdate({
        ...currentUser.employee,
        full_name: employee.full_name || '',
        phone: employee.phone || '',
        address: employee.address || '',
        photo_url: employee.photo_url || null,
      });
      
      // Reset photo file and preview after successful update
      setProfileForm((prev) => ({ ...prev, photo_file: null, photo_deleted: false }));
      if (photoInputRef.current) {
        try { photoInputRef.current.value = ''; } catch {}
      }
      if (photoPreviewUrl) {
        try { URL.revokeObjectURL(photoPreviewUrl); } catch {}
        setPhotoPreviewUrl(null);
      }
      
      setProfileMessage('Profile berhasil diperbarui');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Gagal memperbarui profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLeaveSubmitLoading(true);
      setLeaveError('');
      setLeaveMessage('');
      await leavesApi.createRequest(token, leaveForm);
      setLeaveForm((prev) => ({
        ...prev,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        reason: '',
      }));
      setLeaveMessage('Request cuti berhasil dibuat');
      await loadLeaves();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal membuat request cuti');
    } finally {
      setLeaveSubmitLoading(false);
    }
  };

  const handleCancelLeave = async (requestId: string) => {
    if (!token) return;

    try {
      setLeaveError('');
      setLeaveMessage('');
      await leavesApi.cancelRequest(token, requestId);
      setLeaveMessage('Request cuti berhasil dibatalkan');
      await loadLeaves();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal membatalkan request cuti');
    }
  };

  const handleDecideLeave = async (requestId: string, status: 'approved' | 'declined') => {
    if (!token) return;

    const declineReason = status === 'declined'
      ? window.prompt('Alasan penolakan') || ''
      : '';

    if (status === 'declined' && !declineReason.trim()) {
      setLeaveError('Alasan penolakan wajib diisi');
      return;
    }

    try {
      setLeaveError('');
      setLeaveMessage('');
      await leavesApi.decideRequest(token, requestId, {
        status,
        decline_reason: declineReason,
      });
      setLeaveMessage(status === 'approved' ? 'Request cuti disetujui' : 'Request cuti ditolak');
      await loadLeaves();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal memproses request cuti');
    }
  };

  const handleCreateReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setReimbursementSubmitLoading(true);
      setReimbursementError('');
      setReimbursementMessage('');
      await reimbursementsApi.createRequest(token, {
        category: reimbursementForm.category,
        amount: Number(reimbursementForm.amount),
        expense_date: reimbursementForm.expense_date,
        description: reimbursementForm.description,
        receipt_file: reimbursementForm.receipt_file,
      });
      setReimbursementForm((prev) => ({
        ...prev,
        amount: 0,
        description: '',
        receipt_file: null,
      }));
        // clean up preview URL
        if (receiptPreviewUrl) {
          try { URL.revokeObjectURL(receiptPreviewUrl); } catch {}
          setReceiptPreviewUrl(null);
        }
        if (receiptInputRef && receiptInputRef.current) {
          try { receiptInputRef.current.value = ''; } catch {}
        }
      setReimbursementMessage('Request reimburse berhasil dibuat');
      await loadReimbursements();
    } catch (err) {
      setReimbursementError(err instanceof Error ? err.message : 'Gagal membuat request reimburse');
    } finally {
      setReimbursementSubmitLoading(false);
    }
  };

  const handleDecideReimbursement = async (requestId: string, status: 'approved' | 'declined') => {
    if (!token) return;

    const declineReason = status === 'declined'
      ? window.prompt('Alasan penolakan') || ''
      : '';

    if (status === 'declined' && !declineReason.trim()) {
      setReimbursementError('Alasan penolakan wajib diisi');
      return;
    }

    try {
      setReimbursementError('');
      setReimbursementMessage('');
      await reimbursementsApi.decideRequest(token, requestId, {
        status,
        decline_reason: declineReason,
      });
      setReimbursementMessage(status === 'approved' ? 'Request reimburse disetujui' : 'Request reimburse ditolak');
      await loadReimbursements();
    } catch (err) {
      setReimbursementError(err instanceof Error ? err.message : 'Gagal memproses request reimburse');
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

  const goToPreviousMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  return (
    <div className="portal-shell">
      <header className="portal-head">
        <div>
          <p className="eyebrow">{portalType} Portal</p>
          <h1>Selamat datang, {employeeName}</h1>
          <p className="subtext">Anda sudah login.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onLogout} className="danger-btn">
            Logout
          </button>
          <button
            type="button"
            onClick={() => handleMenuChange('profile')}
            title="Buka Profile"
            aria-label="Buka Profile"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              width: 44,
              height: 44,
              borderRadius: 8,
            }}
          >
            <img
              src={headerProfilePhotoSrc}
              alt="Foto profil user"
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                objectFit: 'cover',
                border: '2px solid #d1d5db',
                display: 'block',
              }}
            />
          </button>
        </div>
      </header>

      <nav className="portal-nav" aria-label="Portal menu">
        <div className="menu-tabs">
          {portalMenus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              className={activeMenu === menu.id ? 'menu-tab active' : 'menu-tab'}
              onClick={() => handleMenuChange(menu.id)}
            >
              {menu.label}
            </button>
          ))}
        </div>
        <div className="menu-select-wrap">
          <label htmlFor="portal-menu">Menu</label>
          <select
            id="portal-menu"
            value={activeMenu}
            onChange={(e) => handleMenuChange(e.target.value as PortalMenu)}
          >
            {portalMenus.map((menu) => (
              <option key={menu.id} value={menu.id}>{menu.label}</option>
            ))}
          </select>
        </div>
      </nav>

      {activeMenu === 'overview' && (
      <section className="panel overview-panel">
        <h3>Informasi Akun</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span>Nama</span>
            <strong>{employeeName}</strong>
          </div>
          <div className="summary-item">
            <span>Email</span>
            <strong>{currentUser.user.email}</strong>
          </div>
          <div className="summary-item">
            <span>Role</span>
            <strong>{currentUser.user.role.toUpperCase()}</strong>
          </div>
          <div className="summary-item">
            <span>Pending Leave</span>
            <strong>{leaveSummary.pending}</strong>
          </div>
          <div className="summary-item">
            <span>Pending Reimburse</span>
            <strong>{reimbursementSummary.pending}</strong>
          </div>
        </div>
      </section>
      )}

      {activeMenu === 'profile' && (
      <section className="panel profile-panel">
        <h3>Profile</h3>
        {currentUser.employee ? (
          <form className="profile-form" onSubmit={handleProfileUpdate}>
            {profileError && <p className="inline-error">{profileError}</p>}
            {profileMessage && <p className="inline-success">{profileMessage}</p>}

            {/* Photo Section */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Foto Profile</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Current Photo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <img
                    src={currentProfilePhotoSrc}
                    alt="Current profile photo"
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 8,
                      objectFit: 'cover',
                      border: '2px solid #ddd',
                    }}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setProfileForm((prev) => ({ ...prev, photo_deleted: true }));
                    }}
                    style={{ marginTop: 8, width: '100%' }}
                  >
                    Hapus Foto
                  </button>
                </div>

                {/* Preview Photo */}
                {photoPreviewUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>Preview Foto Baru</div>
                    <div>
                      <img
                        src={photoPreviewUrl}
                        alt="Preview new photo"
                        style={{
                          width: 140,
                          height: 140,
                          borderRadius: 8,
                          objectFit: 'cover',
                          border: '2px solid #4CAF50',
                        }}
                      />
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          try { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); } catch {}
                          setPhotoPreviewUrl(null);
                          setProfileForm((prev) => ({ ...prev, photo_file: null }));
                          if (photoInputRef.current) {
                            try { photoInputRef.current.value = ''; } catch {}
                          }
                        }}
                        style={{ marginTop: 8, width: '100%' }}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>Upload Foto Baru</div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    disabled={profileLoading}
                    style={{
                      display: 'none',
                    }}
                  />
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={profileLoading}
                  >
                    Pilih Foto
                  </button>
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="form-row-two">
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nama lengkap"
                  disabled={profileLoading}
                />
              </div>
              <div className="form-group">
                <label>Nomor Telepon</label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Nomor telepon"
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="form-row-two">
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

            {/* Read-only Fields */}
            <div className="form-row-two">
              <div className="form-group">
                <label>Tanggal Bergabung</label>
                <input
                  type="text"
                  value={currentUser.employee.join_date ? new Date(currentUser.employee.join_date).toLocaleDateString('id-ID') : '-'}
                  disabled={true}
                  style={{ backgroundColor: '#f5f5f5' }}
                />
              </div>
              <div className="form-group">
                <label>Jabatan</label>
                <input
                  type="text"
                  value={currentUser.employee.job_title || '-'}
                  disabled={true}
                  style={{ backgroundColor: '#f5f5f5' }}
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
      )}

      {activeMenu === 'leave' && (
      <section className="panel leave-panel">
        <h3>Leave Management</h3>
        <div className="section-head">
          <p>{canReviewLeaves ? 'Review dan ajukan request cuti.' : 'Ajukan dan pantau request cuti Anda.'}</p>
          <div className="leave-summary">
            <span>Pending: {leaveSummary.pending}</span>
            <span>Approved: {leaveSummary.approved}</span>
            <span>Declined: {leaveSummary.declined}</span>
          </div>
        </div>

        {leaveError && <p className="inline-error">{leaveError}</p>}
        {leaveMessage && <p className="inline-success">{leaveMessage}</p>}

        {currentUser.employee ? (
          <form className="leave-form crm-form" onSubmit={handleCreateLeave}>
            <div className="form-row-three">
              <div className="form-group">
                <label>Jenis Cuti</label>
                <select
                  value={leaveForm.leave_type_id}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, leave_type_id: e.target.value }))}
                  required
                  disabled={leaveSubmitLoading || leaveTypes.length === 0}
                >
                  {leaveTypes.length === 0 && <option value="">Belum ada jenis cuti</option>}
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.is_paid ? 'Paid' : 'Unpaid'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tanggal Mulai</label>
                <input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  required
                  disabled={leaveSubmitLoading}
                />
              </div>
              <div className="form-group">
                <label>Tanggal Selesai</label>
                <input
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  required
                  disabled={leaveSubmitLoading}
                />
              </div>
            </div>
            <div className="form-row-one">
              <div className="form-group">
                <label>Alasan</label>
                <input
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Alasan cuti"
                  disabled={leaveSubmitLoading}
                />
              </div>
            </div>
            <div className="form-actions compact-actions">
              <button type="submit" disabled={leaveSubmitLoading || leaveTypes.length === 0} className="primary-btn">
                {leaveSubmitLoading ? 'Mengirim...' : 'Ajukan Cuti'}
              </button>
            </div>
          </form>
        ) : (
          <p>Data employee belum tersedia untuk mengajukan cuti.</p>
        )}

        <div className="calendar-panel">
          <div className="calendar-header">
            <button type="button" className="ghost-btn" onClick={goToPreviousMonth}>
              Sebelumnya
            </button>
            <h4>{monthFormatter.format(calendarMonth)}</h4>
            <button type="button" className="ghost-btn" onClick={goToNextMonth}>
              Berikutnya
            </button>
          </div>
          <div className="calendar-weekdays">
            {Array.from({ length: 7 }).map((_, index) => {
              const day = new Date(2026, 1, index + 1);
              return <span key={index}>{dayFormatter.format(day)}</span>;
            })}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => (
              <div
                key={day.key}
                className={day.date ? 'calendar-day' : 'calendar-day calendar-day-empty'}
              >
                {day.dayNumber && <span className="calendar-date">{day.dayNumber}</span>}
                <div className="calendar-events">
                  {day.requests.slice(0, 3).map((request) => (
                    <span key={request.id} className={`calendar-event status-${request.status}`}>
                      {request.employee?.full_name || employeeName}
                    </span>
                  ))}
                  {day.requests.length > 3 && (
                    <span className="calendar-more">+{day.requests.length - 3} lagi</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="leave-list">
          {leaveLoading ? (
            <p>Memuat data cuti...</p>
          ) : leaveRequests.length === 0 ? (
            <p>Belum ada request cuti.</p>
          ) : (
            leaveRequests.map((request) => {
              const isOwnRequest = request.employee_id === currentUser.employee?.id;
              const canCancel = isOwnRequest && request.status === 'pending';
              const canDecide = canReviewLeaves && !isOwnRequest && request.status === 'pending';

              return (
                <div key={request.id} className="leave-item">
                  <div>
                    <strong>{request.employee?.full_name || employeeName}</strong>
                    <p>
                      {request.leaveType?.name || 'Cuti'} | {request.start_date} - {request.end_date} |
                      {' '}{request.total_days} hari
                    </p>
                    {request.reason && <p>Alasan: {request.reason}</p>}
                    {request.decline_reason && <p>Ditolak: {request.decline_reason}</p>}
                  </div>
                  <div className="leave-actions">
                    <span className={`status-pill status-${request.status}`}>{request.status.toUpperCase()}</span>
                    {canCancel && (
                      <button type="button" className="ghost-btn" onClick={() => handleCancelLeave(request.id)}>
                        Batalkan
                      </button>
                    )}
                    {canDecide && (
                      <>
                        <button type="button" className="primary-btn" onClick={() => handleDecideLeave(request.id, 'approved')}>
                          Approve
                        </button>
                        <button type="button" className="danger-btn" onClick={() => handleDecideLeave(request.id, 'declined')}>
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
      )}

      {activeMenu === 'reimburse' && (
      <section className="panel reimburse-panel">
        <h3>Reimburse Management</h3>
        <div className="section-head">
          <p>{canReviewLeaves ? 'Review dan ajukan reimburse.' : 'Ajukan dan pantau reimburse Anda.'}</p>
          <div className="leave-summary">
            <span>Pending: {reimbursementSummary.pending}</span>
            <span>Approved: {reimbursementSummary.approved}</span>
            <span>Declined: {reimbursementSummary.declined}</span>
            <span>Total Approved: Rp {reimbursementSummary.totalApproved.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {reimbursementError && <p className="inline-error">{reimbursementError}</p>}
        {reimbursementMessage && <p className="inline-success">{reimbursementMessage}</p>}

        {currentUser.employee ? (
          <form className="reimburse-form crm-form" onSubmit={handleCreateReimbursement}>
            <div className="form-row-three">
              <div className="form-group">
                <label>Kategori</label>
                <select
                  value={reimbursementForm.category}
                  onChange={(e) => setReimbursementForm((prev) => ({ ...prev, category: e.target.value }))}
                  disabled={reimbursementSubmitLoading}
                >
                  <option value="Transport">Transport</option>
                  <option value="Meal">Meal</option>
                  <option value="Medical">Medical</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Nominal</label>
                <input
                  type="number"
                  min={0}
                  value={reimbursementForm.amount}
                  onChange={(e) => setReimbursementForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  required
                  disabled={reimbursementSubmitLoading}
                />
              </div>
              <div className="form-group">
                <label>Tanggal Pengeluaran</label>
                <input
                  type="date"
                  value={reimbursementForm.expense_date}
                  onChange={(e) => setReimbursementForm((prev) => ({ ...prev, expense_date: e.target.value }))}
                  required
                  disabled={reimbursementSubmitLoading}
                />
              </div>
            </div>
            <div className="form-row-two">
              <div className="form-group">
                <label>Deskripsi</label>
                <input
                  value={reimbursementForm.description}
                  onChange={(e) => setReimbursementForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Contoh: Transport meeting client"
                  disabled={reimbursementSubmitLoading}
                />
              </div>
              <div className="form-group">
                <label>Upload Foto Struk/Bukti</label>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptFileChange}
                  disabled={reimbursementSubmitLoading}
                />
                {receiptPreviewUrl && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={receiptPreviewUrl}
                      alt="Preview struk"
                      style={{ maxWidth: 200, maxHeight: 160, display: 'block', marginBottom: 6, objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        try { if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl); } catch {}
                        setReceiptPreviewUrl(null);
                        setReimbursementForm((prev) => ({ ...prev, receipt_file: null }));
                        if (receiptInputRef.current) {
                          try { receiptInputRef.current.value = ''; } catch {}
                        }
                      }}
                    >
                      Hapus Foto
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="form-actions compact-actions">
              <button type="submit" disabled={reimbursementSubmitLoading} className="primary-btn">
                {reimbursementSubmitLoading ? 'Mengirim...' : 'Ajukan Reimburse'}
              </button>
            </div>
          </form>
        ) : (
          <p>Data employee belum tersedia untuk mengajukan reimburse.</p>
        )}

        <div className="reimburse-list">
          {reimbursementLoading ? (
            <p>Memuat data reimburse...</p>
          ) : reimbursementRequests.length === 0 ? (
            <p>Belum ada request reimburse.</p>
          ) : (
            reimbursementRequests.map((request) => {
              const isOwnRequest = request.employee_id === currentUser.employee?.id;
              const canDecide = canReviewLeaves && !isOwnRequest && request.status === 'pending';

              return (
                <div key={request.id} className="reimburse-item">
                  <div>
                    <strong>{request.employee?.full_name || employeeName}</strong>
                    <p>
                      {request.category} | Rp {Number(request.amount || 0).toLocaleString('id-ID')} |
                      {' '}{request.expense_date}
                    </p>
                    {request.description && <p>Deskripsi: {request.description}</p>}
                    {request.receipt_url && (
                      <p>
                        Bukti:{' '}
                        <button
                          type="button"
                          onClick={() => handleViewPhoto(request.receipt_url)}
                          className="link-btn"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0066cc',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          Lihat Foto
                        </button>
                      </p>
                    )}
                    {request.decline_reason && <p>Ditolak: {request.decline_reason}</p>}
                  </div>
                  <div className="reimburse-actions">
                    <span className={`status-pill status-${request.status}`}>{request.status.toUpperCase()}</span>
                    {canDecide && (
                      <>
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => handleDecideReimbursement(request.id, 'approved')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => handleDecideReimbursement(request.id, 'declined')}
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
      )}

      {activeMenu === 'users' && canManageUsers && (
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

      {/* Photo Modal */}
      {photoModalOpen && selectedPhotoUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleClosePhotoModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhotoUrl}
              alt="Reimbursement Receipt"
              style={{
                maxWidth: '80vw',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
            />
            <button
              type="button"
              onClick={handleClosePhotoModal}
              className="primary-btn"
              style={{
                marginTop: '15px',
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
