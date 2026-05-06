import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { auth } from '../services/auth';
import * as bootstrapApi from '../services/bootstrap';
import { attendanceApi, type AdminAttendanceQrCode } from '../services/attendance';
import { AttendanceScanner } from '../components/AttendanceScanner';
import { leavesApi, type LeaveRequest, type LeaveType } from '../services/leaves';
import { profileApi } from '../services/profile';
import { payrollApi, type PayrollPeriod, type PayrollPayslip, type PayrollPayslipDetailResponse } from '../services/payroll';
import { reimbursementsApi, type ReimbursementRequest } from '../services/reimbursements';
import { usersApi, type ManagedUser, type UserManagementOptions } from '../services/users';
import { UserTreePage } from './Portal/UserTree';

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
    department_id?: string | null;
    join_date?: string;
    job_title?: string;
  } | null;
}

interface PortalPageProps {
  currentUser: SessionUser;
  onLogout: () => void;
  onEmployeeUpdate: (employee: SessionUser['employee']) => void;
}

type PortalMenu = 'overview' | 'profile' | 'leave' | 'reimburse' | 'users' | 'user-tree' | 'attendance-qr' | 'attendance-history' | 'attendance-scan' | 'payroll' | 'my-payroll';

interface AttendanceQrView extends AdminAttendanceQrCode {
  qrDataUrl: string;
}

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

function normalizePhoneValue(phone: string) {
  let normalizedPhone = phone.trim().replace(/\s/g, '');

  if (normalizedPhone.startsWith('+62')) {
    normalizedPhone = '0' + normalizedPhone.slice(3);
  } else if (normalizedPhone.startsWith('62') && !normalizedPhone.startsWith('0')) {
    normalizedPhone = '0' + normalizedPhone.slice(2);
  }

  return normalizedPhone;
}

// Maximum allowed file size for uploads (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function PortalPage({ currentUser, onLogout, onEmployeeUpdate }: PortalPageProps) {
  const defaultProfilePhoto = '/images/default-profile.svg';
  const portalType = currentUser.user.role === 'admin'
    ? 'Admin'
    : currentUser.user.role === 'manager'
      ? 'Manager'
      : 'Staff';
  const canManageUsers = currentUser.user.role === 'admin';
  const canViewTree = currentUser.user.role === 'admin' || currentUser.user.role === 'manager';
  const canManageAttendanceQr = currentUser.user.role === 'admin';
  const canScanAttendance = currentUser.user.role === 'staff' || currentUser.user.role === 'manager';
  const canManagePayroll = currentUser.user.role === 'admin';
  const canViewMyPayroll = Boolean(currentUser.employee);
  const canCreateReimbursement = currentUser.user.role !== 'admin';
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
  const [attendanceQr, setAttendanceQr] = useState<AttendanceQrView | null>(null);
  const [attendanceQrLoading, setAttendanceQrLoading] = useState(false);
  const [attendanceQrError, setAttendanceQrError] = useState('');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] = useState(false);
  const [attendanceHistoryError, setAttendanceHistoryError] = useState('');
  const [attendanceHistoryFilters, setAttendanceHistoryFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [payrollPayslips, setPayrollPayslips] = useState<PayrollPayslip[]>([]);
  const [selectedPayrollPeriodId, setSelectedPayrollPeriodId] = useState('');
  const [selectedPayrollPayslipId, setSelectedPayrollPayslipId] = useState('');
  const [payrollPayslipDetail, setPayrollPayslipDetail] = useState<PayrollPayslipDetailResponse | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollActionLoading, setPayrollActionLoading] = useState(false);
  const [payrollDetailLoading, setPayrollDetailLoading] = useState(false);
  const [payrollError, setPayrollError] = useState('');
  const [payrollDetailError, setPayrollDetailError] = useState('');
  const [payrollMessage, setPayrollMessage] = useState('');
  const [payrollView, setPayrollView] = useState<'payslips' | 'items'>('payslips');
  const [myPayrollPayslips, setMyPayrollPayslips] = useState<PayrollPayslip[]>([]);
  const [myPayrollDetail, setMyPayrollDetail] = useState<PayrollPayslipDetailResponse | null>(null);
  const [myPayrollLoading, setMyPayrollLoading] = useState(false);
  const [myPayrollError, setMyPayrollError] = useState('');
  const [selectedMyPayslipId, setSelectedMyPayslipId] = useState('');

  const [periodForm, setPeriodForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const [manualItemForm, setManualItemForm] = useState({
    payslip_id: '',
    employee_id: '',
    type: 'incentive' as 'incentive' | 'penalty',
    amount: 0,
    description: '',
  });
  
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
  const hasLoadedBootstrapRef = useRef(false);

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
  const [editingUserSnapshot, setEditingUserSnapshot] = useState<{
    full_name: string;
    email: string;
    role: 'admin' | 'staff' | 'manager';
    join_date: string;
    base_salary: number;
    job_title: string;
    phone: string;
    address: string;
    department_id: string;
    manager_id: string;
  } | null>(null);
  
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
  
  const [reimbursementForm, setReimbursementForm] = useState<{
    category: string;
    amount: string | number;
    expense_date: string;
    description: string;
    receipt_file: File | null;
  }>({
    category: 'Transport',
    amount: '',
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

  const loadBootstrap = async () => {
    if (!token) return;
    try {
      const data: any = await bootstrapApi.getBootstrap(token);

      // me is already available from currentUser, but keep in sync
      // Leaves
      if (data.leaveTypes) setLeaveTypes(data.leaveTypes);
      if (data.leaveRequests) setLeaveRequests(data.leaveRequests);

      // Reimbursements
      if (data.reimbursements) setReimbursementRequests(data.reimbursements);

      // Admin-only data
      if (data.users) setUsers(data.users);
      if (data.options) setOptions(data.options);
      if (data.payrollPeriods) setPayrollPeriods(data.payrollPeriods);

      // Attendance QR (admin)
      if (data.attendanceQr && data.attendanceQr.token) {
        try {
          const qrDataUrl = await QRCode.toDataURL(data.attendanceQr.token, {
            width: 260,
            margin: 1,
            errorCorrectionLevel: 'M',
          });
          setAttendanceQr({ ...data.attendanceQr, qrDataUrl });
        } catch (e) {
          setAttendanceQr({ ...data.attendanceQr, qrDataUrl: '' });
        }
      }

      // My payslips for staff
      if (data.myPayslips) {
        setMyPayrollPayslips(data.myPayslips);
        if (!selectedMyPayslipId && data.myPayslips.length > 0) {
          setSelectedMyPayslipId(data.myPayslips[0].id);
        }
      }

      hasLoadedBootstrapRef.current = true;
    } catch (err) {
      console.error('Bootstrap load failed', err);
    }
  };

  useEffect(() => {
    if (!token || hasLoadedBootstrapRef.current) return;
    void loadBootstrap();

    // Open SSE stream to receive payslip change notifications
    try {
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      es.addEventListener('payslip_changed', async (ev: MessageEvent) => {
        try {
          const payload = JSON.parse((ev as any).data);
          // If current user is the affected employee, refresh my payslips
          if (payload.employee_id && currentUser.employee?.id === payload.employee_id) {
            try {
              const myPayslips = await payrollApi.listMyPayslips(token);
              setMyPayrollPayslips(myPayslips || []);
            } catch (e) { console.error('Failed refreshing my payslips', e); }
          }

          // If admin viewing payroll, refresh current period/payslips
          if (currentUser.user.role === 'admin') {
            try {
              await loadPayrollPeriods();
              if (selectedPayrollPeriodId) {
                await loadPayrollPayslips(selectedPayrollPeriodId);
              }
            } catch (e) { console.error('Failed refreshing payroll after notification', e); }
          }
        } catch (e) { console.error('Invalid SSE payload', e); }
      });

      es.onerror = (e) => {
        // keep silently
        console.warn('SSE error', e);
      };

      return () => {
        try { es.close(); } catch {}
      };
    } catch (e) {
      console.error('Failed to open SSE', e);
    }
  }, [token]);

  // Sync profile form with currentUser.employee data
  useEffect(() => {
    if (currentUser.employee) {
      setProfileForm((prev) => ({
        ...prev,
        full_name: currentUser.employee?.full_name || '',
        phone: currentUser.employee?.phone || '',
        address: currentUser.employee?.address || '',
      }));
    }
  }, [currentUser.employee?.id, currentUser.employee?.full_name, currentUser.employee?.phone, currentUser.employee?.address]);

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
    amount: '',
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
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const baseUrl = apiBase.replace('/api', '');
        fullUrl = baseUrl + receiptUrl;
      }
      
      console.log('Opening photo:', fullUrl);
      setSelectedPhotoUrl(fullUrl);
      setPhotoModalOpen(true);
    }
  };

  const getFullPhotoUrl = (photoUrl: string | null | undefined): string | null => {
    if (!photoUrl) return null;
    
    if (photoUrl.startsWith('http')) {
      return photoUrl;
    } else {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const baseUrl = apiBase.replace('/api', '');
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

    setProfileForm((prev) => ({ ...prev, photo_file: file, photo_deleted: false }));

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

    if (canManageUsers) menus.push({ id: 'users', label: 'User Management' });
    if (canViewTree) menus.push({ id: 'user-tree', label: 'User Tree' });
    if (canManagePayroll) menus.push({ id: 'payroll', label: 'Payroll' });
    if (canViewMyPayroll) menus.push({ id: 'my-payroll', label: 'Payslip Saya' });
    if (canManageAttendanceQr) menus.push({ id: 'attendance-qr', label: 'Attendance QR' });
    if (canManageAttendanceQr) menus.push({ id: 'attendance-history', label: 'Attendance History' });
    if (canScanAttendance) menus.push({ id: 'attendance-scan', label: 'Scan QR' });

    return menus;
  }, [canManageUsers, canViewTree, canManagePayroll, canViewMyPayroll, canManageAttendanceQr, canScanAttendance]);

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

  const canDecideLeaveRequest = (request: LeaveRequest) => {
    if (request.status !== 'pending') {
      return false;
    }

    if (request.employee_id === currentUser.employee?.id) {
      return false;
    }

    if (currentUser.user.role === 'admin') {
      return true;
    }

    if (currentUser.user.role !== 'manager') {
      return false;
    }

    if (request.employee?.user?.role !== 'staff') {
      return false;
    }

    const currentDepartmentId = currentUser.employee?.department_id || null;
    if (!currentDepartmentId) {
      return request.employee?.manager_id === currentUser.employee?.id;
    }

    return request.employee?.department_id === currentDepartmentId;
  };

  const profileIsDirty = useMemo(() => {
    if (!currentUser.employee) return false;

    const currentPhone = normalizePhoneValue(currentUser.employee.phone || '');
    const draftPhone = normalizePhoneValue(profileForm.phone || '');
    const hasExistingPhoto = Boolean(currentUser.employee.photo_url);
    const photoRemoved = hasExistingPhoto && profileForm.photo_deleted;

    return (
      profileForm.full_name.trim() !== (currentUser.employee.full_name || '').trim()
      || draftPhone !== currentPhone
      || profileForm.address.trim() !== (currentUser.employee.address || '').trim()
      || Boolean(profileForm.photo_file)
      || photoRemoved
    );
  }, [currentUser.employee, profileForm.address, profileForm.full_name, profileForm.phone, profileForm.photo_deleted, profileForm.photo_file]);

  const getProfileValidationError = () => {
    if (!profileForm.full_name.trim()) {
      return 'Nama Lengkap wajib diisi';
    }

    if (!profileForm.phone.trim()) {
      return 'Nomor Telepon wajib diisi';
    }

    const normalizedPhone = normalizePhoneValue(profileForm.phone);
    const phoneDigitsOnly = normalizedPhone.replace(/\D/g, '');
    if (phoneDigitsOnly.length < 10) {
      return 'Nomor Telepon harus minimal 10 digit (contoh: 081234567890)';
    }

    if (!profileForm.address.trim()) {
      return 'Alamat wajib diisi';
    }

    if (profileForm.address.trim().length < 15) {
      return 'Alamat harus minimal 15 karakter (contoh: Jl. Merdeka No. 123)';
    }

    if (profileForm.photo_file && profileForm.photo_file.size > MAX_FILE_SIZE) {
      return 'Ukuran foto maksimal 5MB';
    }

    if (!profileIsDirty) {
      return 'Tidak ada perubahan pada profile';
    }

    return null;
  };

  const getLeaveValidationError = () => {
    const today = new Date().toISOString().slice(0, 10);

    if (!leaveForm.reason || !leaveForm.reason.trim()) {
      return 'Alasan cuti wajib diisi';
    }

    if (leaveForm.start_date < today) {
      return 'Tanggal mulai cuti tidak boleh sebelum hari ini';
    }

    if (leaveForm.end_date < leaveForm.start_date) {
      return 'Tanggal selesai cuti harus lebih besar atau sama dengan tanggal mulai';
    }

    return null;
  };

  const getUserFormValidationError = () => {
    if (!form.full_name.trim()) {
      return 'Nama lengkap wajib diisi';
    }

    if (!form.email.trim()) {
      return 'Email wajib diisi';
    }

    if (!/^\S+@company\.com$/i.test(form.email.trim())) {
      return 'Email harus menggunakan domain @company.com';
    }

    if (!editingUserId && !form.password.trim()) {
      return 'Password wajib diisi';
    }

    if (!editingUserId && form.password.trim().length < 8) {
      return 'Password minimal 8 karakter';
    }

    if (!form.department_id) {
      return 'Department wajib dipilih';
    }

    if (!form.join_date) {
      return 'Tanggal bergabung wajib diisi';
    }

    if (Number(form.base_salary) < 0) {
      return 'Gaji pokok tidak boleh negatif';
    }

    if (form.phone.trim() && form.phone.trim().replace(/\D/g, '').length < 10) {
      return 'Nomor telepon harus minimal 10 digit';
    }

    if (form.address.trim() && form.address.trim().length < 15) {
      return 'Alamat harus minimal 15 karakter';
    }

    if (!form.job_title.trim()) {
      return 'Jabatan wajib diisi';
    }

    if (editingUserId && editingUserSnapshot) {
      const sameFullName = form.full_name.trim() === editingUserSnapshot.full_name.trim();
      const sameEmail = form.email.trim() === editingUserSnapshot.email.trim();
      const sameRole = form.role === editingUserSnapshot.role;
      const sameJoinDate = form.join_date === editingUserSnapshot.join_date;
      const sameBaseSalary = Number(form.base_salary) === editingUserSnapshot.base_salary;
      const sameJobTitle = form.job_title.trim() === editingUserSnapshot.job_title.trim();
      const samePhone = normalizePhoneValue(form.phone) === normalizePhoneValue(editingUserSnapshot.phone);
      const sameAddress = form.address.trim() === editingUserSnapshot.address.trim();
      const sameDepartment = form.department_id === editingUserSnapshot.department_id;
      const sameManager = (form.manager_id || '') === (editingUserSnapshot.manager_id || '');

      if (
        sameFullName
        && sameEmail
        && sameRole
        && sameJoinDate
        && sameBaseSalary
        && sameJobTitle
        && samePhone
        && sameAddress
        && sameDepartment
        && sameManager
      ) {
        return 'Tidak ada perubahan pada data user';
      }
    }

    return null;
  };

  const userFormValidationError = getUserFormValidationError();

  const userFormHasChanges = useMemo(() => {
    if (!editingUserId || !editingUserSnapshot) {
      return false;
    }

    const sameFullName = form.full_name.trim() === editingUserSnapshot.full_name.trim();
    const sameEmail = form.email.trim() === editingUserSnapshot.email.trim();
    const sameRole = form.role === editingUserSnapshot.role;
    const sameJoinDate = form.join_date === editingUserSnapshot.join_date;
    const sameBaseSalary = Number(form.base_salary) === editingUserSnapshot.base_salary;
    const sameJobTitle = form.job_title.trim() === editingUserSnapshot.job_title.trim();
    const samePhone = normalizePhoneValue(form.phone) === normalizePhoneValue(editingUserSnapshot.phone);
    const sameAddress = form.address.trim() === editingUserSnapshot.address.trim();
    const sameDepartment = form.department_id === editingUserSnapshot.department_id;
    const sameManager = (form.manager_id || '') === (editingUserSnapshot.manager_id || '');

    return !(
      sameFullName
      && sameEmail
      && sameRole
      && sameJoinDate
      && sameBaseSalary
      && sameJobTitle
      && samePhone
      && sameAddress
      && sameDepartment
      && sameManager
    );
  }, [editingUserId, editingUserSnapshot, form.address, form.base_salary, form.department_id, form.email, form.full_name, form.job_title, form.join_date, form.manager_id, form.phone, form.role]);

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
    setEditingEmployeeId(null);
    setEditingUserSnapshot(null);
    setCreatedEmployeeNumber('');
  };

  const startEdit = (user: ManagedUser) => {
    setEditingUserId(user.id);
    setEditingEmployeeId(user.employee?.id || null);
    setUsersError('');
    setCreatedEmployeeNumber(user.employee?.employee_number || '');
    const nextForm = {
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
    setEditingUserSnapshot({
      full_name: nextForm.full_name,
      email: nextForm.email,
      role: nextForm.role,
      join_date: nextForm.join_date,
      base_salary: Number(nextForm.base_salary),
      job_title: nextForm.job_title,
      phone: nextForm.phone,
      address: nextForm.address,
      department_id: nextForm.department_id,
      manager_id: nextForm.manager_id,
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
    if (!canManageUsers || !token || hasLoadedAdminDataRef.current || hasLoadedBootstrapRef.current) {
      return;
    }

    hasLoadedAdminDataRef.current = true;
    void Promise.all([loadUsers(), loadOptions()]);
  }, [canManageUsers, token]);

  useEffect(() => {
    setProfileForm(getDefaultProfileForm());
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
    if (hasLoadedBootstrapRef.current) return;
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
    if (hasLoadedBootstrapRef.current) return;
    void loadReimbursements();
  }, [token]);

  const loadAttendanceQr = async (forceRefresh = false) => {
    if (!canManageAttendanceQr || !token) {
      return;
    }

    try {
      setAttendanceQrLoading(true);
      setAttendanceQrError('');
      const result = await attendanceApi.getAdminQrCode(token, forceRefresh);

      if (!result || !result.token) {
        throw new Error('Data QR tidak lengkap dari server');
      }

      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(result.token, {
          width: 260,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
      } catch (genErr) {
        console.error('QR generation failed', genErr);
        throw new Error('Gagal membuat gambar QR');
      }

      setAttendanceQr({
        ...result,
        qrDataUrl,
      });
    } catch (err) {
      console.error('loadAttendanceQr error', err);
      setAttendanceQrError(err instanceof Error ? err.message : 'Gagal memuat QR absensi');
    } finally {
      setAttendanceQrLoading(false);
    }
  };

  const loadAttendanceHistory = async () => {
    if (!canManageAttendanceQr || !token) {
      return;
    }

    try {
      setAttendanceHistoryLoading(true);
      setAttendanceHistoryError('');
      const result = await attendanceApi.getAttendanceHistory(token, {
        month: attendanceHistoryFilters.month,
        year: attendanceHistoryFilters.year,
      });

      setAttendanceHistory(result || []);
    } catch (error) {
      setAttendanceHistoryError(error instanceof Error ? error.message : 'Failed to load attendance history');
    } finally {
      setAttendanceHistoryLoading(false);
    }
  };

  const loadPayrollPeriods = async () => {
    if (!token || !canManagePayroll) return;

    try {
      setPayrollLoading(true);
      setPayrollError('');
      const periods = await payrollApi.listPeriods(token);
      setPayrollPeriods(periods);
      if (!selectedPayrollPeriodId && periods.length > 0) {
        setSelectedPayrollPeriodId(periods[0].id);
      }
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal memuat payroll periods');
    } finally {
      setPayrollLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu !== 'attendance-qr' || !canManageAttendanceQr || !token || hasLoadedBootstrapRef.current) {
      return;
    }
    void loadAttendanceQr();
  }, [activeMenu, canManageAttendanceQr, token]);

  useEffect(() => {
    if (hasLoadedBootstrapRef.current) return;
    void loadPayrollPeriods();
  }, [token, canManagePayroll]);

  const loadMyPayrollPayslips = async () => {
    if (!token || !canViewMyPayroll) return;

    try {
      setMyPayrollLoading(true);
      setMyPayrollError('');
      const payslips = await payrollApi.listMyPayslips(token);
      setMyPayrollPayslips(payslips);
      if (!selectedMyPayslipId && payslips.length > 0) {
        setSelectedMyPayslipId(payslips[0].id);
      }
      if (payslips.length === 0) {
        setMyPayrollDetail(null);
      }
    } catch (err) {
      setMyPayrollError(err instanceof Error ? err.message : 'Gagal memuat payslip saya');
    } finally {
      setMyPayrollLoading(false);
    }
  };

  const loadMyPayrollDetail = async (payslipId: string) => {
    if (!token || !payslipId || !canViewMyPayroll) return;

    try {
      setMyPayrollLoading(true);
      setMyPayrollError('');
      const detail = await payrollApi.getMyPayslipDetail(token, payslipId);
      setMyPayrollDetail(detail);
    } catch (err) {
      setMyPayrollError(err instanceof Error ? err.message : 'Gagal memuat detail payslip saya');
    } finally {
      setMyPayrollLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu !== 'my-payroll' || hasLoadedBootstrapRef.current) return;
    void loadMyPayrollPayslips();
  }, [activeMenu, token, canViewMyPayroll]);

  useEffect(() => {
    if (activeMenu !== 'my-payroll' || !selectedMyPayslipId) return;
    void loadMyPayrollDetail(selectedMyPayslipId);
  }, [activeMenu, selectedMyPayslipId, token, canViewMyPayroll]);

  useEffect(() => {
    if (activeMenu !== 'attendance-history') return;
    void loadAttendanceHistory();
  }, [activeMenu, attendanceHistoryFilters, token, canManageAttendanceQr]);

  useEffect(() => {
    if (!selectedPayrollPeriodId) {
      setPayrollPayslips([]);
      setSelectedPayrollPayslipId('');
      setPayrollPayslipDetail(null);
      return;
    }

    void loadPayrollPayslips(selectedPayrollPeriodId);
  }, [selectedPayrollPeriodId, token]);

  useEffect(() => {
    if (activeMenu !== 'payroll' || !selectedPayrollPayslipId) return;
    void loadPayrollPayslipDetail(selectedPayrollPayslipId);
  }, [activeMenu, selectedPayrollPayslipId, token, canManagePayroll]);

  const handleCreatePayrollPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canManagePayroll) return;

    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      const period = await payrollApi.createPeriod(token, periodForm.month, periodForm.year);
      setPayrollMessage('Payroll period berhasil dibuat');
      setSelectedPayrollPeriodId(period.id);
      await loadPayrollPeriods();
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal membuat payroll period');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const loadPayrollPayslips = async (periodId: string) => {
    if (!token || !periodId) return;
    try {
      const payslips = await payrollApi.listPayslips(token, periodId);
      setPayrollPayslips(payslips);
      const nextSelectedPayslipId = payslips.some((payslip) => payslip.id === selectedPayrollPayslipId)
        ? selectedPayrollPayslipId
        : payslips[0]?.id || '';

      if (nextSelectedPayslipId !== selectedPayrollPayslipId) {
        setSelectedPayrollPayslipId(nextSelectedPayslipId);
      }

      if (!manualItemForm.payslip_id && payslips.length > 0) {
        setManualItemForm((prev) => ({ ...prev, payslip_id: payslips[0].id }));
      }

      if (payslips.length === 0) {
        setSelectedPayrollPayslipId('');
        setPayrollPayslipDetail(null);
        setPayrollDetailError('');
      }
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal memuat payslips');
    }
  };

  const loadPayrollPayslipDetail = async (payslipId: string) => {
    if (!token || !payslipId || !canManagePayroll) return;

    try {
      setPayrollDetailLoading(true);
      setPayrollDetailError('');
      const detail = await payrollApi.getPayslipDetail(token, payslipId);
      setPayrollPayslipDetail(detail);
    } catch (err) {
      setPayrollDetailError(err instanceof Error ? err.message : 'Gagal memuat detail payslip');
    } finally {
      setPayrollDetailLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    if (!token || !selectedPayrollPeriodId) return;
    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      await payrollApi.generatePeriod(token, selectedPayrollPeriodId);
      await loadPayrollPayslips(selectedPayrollPeriodId);
      setPayrollMessage('Payslip berhasil di-generate dan semua item sudah di-attach');
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal membuat payslip draft');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleFinalizePayroll = async () => {
    if (!token || !selectedPayrollPeriodId) return;
    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      await payrollApi.finalizePeriod(token, selectedPayrollPeriodId);
      await loadPayrollPeriods();
      setPayrollMessage('Payroll period berhasil difinalisasi');
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal finalize payroll period');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleAddManualPayrollItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      if (payrollView === 'items') {
        // create period-level item
        if (!selectedPayrollPeriodId || !manualItemForm.employee_id) {
          setPayrollError('Pilih period dan employee terlebih dahulu');
          return;
        }

        await payrollApi.addManualItemToPeriod(token, selectedPayrollPeriodId, {
          employee_id: manualItemForm.employee_id,
          type: manualItemForm.type,
          amount: Number(manualItemForm.amount),
          description: manualItemForm.description,
        });

        setManualItemForm((prev) => ({ ...prev, employee_id: '', amount: 0, description: '' }));
        await loadPayrollPayslips(selectedPayrollPeriodId);
        setPayrollMessage('Item manual berhasil ditambahkan dan langsung attach ke payslip');
      } else {
        if (!manualItemForm.payslip_id) return;
        await payrollApi.addManualItem(token, manualItemForm.payslip_id, {
          type: manualItemForm.type,
          amount: Number(manualItemForm.amount),
          description: manualItemForm.description,
        });

        setManualItemForm((prev) => ({ ...prev, amount: 0, description: '' }));
        await loadPayrollPayslips(selectedPayrollPeriodId);
        setPayrollMessage('Item manual berhasil ditambahkan');
      }
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal menambah item manual');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleDeleteManualPayrollItem = async (payslipId: string, itemId: string) => {
    if (!token || !canManagePayroll) return;

    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      await payrollApi.deleteManualItem(token, payslipId, itemId);
      await loadPayrollPayslips(selectedPayrollPeriodId);
      if (selectedPayrollPayslipId === payslipId) {
        await loadPayrollPayslipDetail(payslipId);
      }
      setPayrollMessage('Item manual berhasil dihapus');
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal menghapus item manual');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentUser.employee) return;

    const profileValidationError = getProfileValidationError();
    if (profileValidationError) {
      setProfileError(profileValidationError);
      return;
    }

    const normalizedPhone = normalizePhoneValue(profileForm.phone);

    try {
      setProfileLoading(true);
      setProfileError('');
      setProfileMessage('');
      const employee = await profileApi.updateMyProfile(token, {
        full_name: profileForm.full_name,
        phone: normalizedPhone,
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
      
      setProfileForm((prev) => ({ ...prev, phone: normalizedPhone, photo_file: null, photo_deleted: false }));
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
      const leaveValidationError = getLeaveValidationError();
      if (leaveValidationError) {
        setLeaveError(leaveValidationError);
        return;
      }
      
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
    if (!reimbursementForm.receipt_file) {
      setReimbursementError('Foto struk/bukti wajib diupload');
      return;
    }
    // Validasi ukuran file struk
    if (reimbursementForm.receipt_file && reimbursementForm.receipt_file.size > MAX_FILE_SIZE) {
      setReimbursementError('Ukuran file struk maksimal 5MB');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (reimbursementForm.expense_date > today) {
      setReimbursementError('Tanggal pengeluaran tidak boleh melebihi hari ini');
      return;
    }
    if (!reimbursementForm.description.trim()) {
      setReimbursementError('Deskripsi pengeluaran wajib diisi');
      return;
    }
    if (!reimbursementForm.amount || Number(reimbursementForm.amount) <= 0) {
      setReimbursementError('Nominal harus lebih dari 0');
      return;
    }
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
        amount: '',
        description: '',
        receipt_file: null,
      }));
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

    const validationError = userFormValidationError;
    if (validationError) {
      setUsersError(validationError);
      return;
    }

    try {
      setSubmitLoading(true);
      setUsersError('');
      const response = await usersApi.createUser(token, {
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

    const validationError = userFormValidationError;
    if (validationError) {
      setUsersError(validationError);
      return;
    }

    if (!userFormHasChanges) {
      setUsersError('Tidak ada perubahan pada data user');
      return;
    }

    try {
      setSubmitLoading(true);
      setUsersError('');
      await usersApi.updateUser(token, editingUserId, {
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

  const handleRefreshAttendanceQr = async () => {
    await loadAttendanceQr(true);
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
            {profileError && <p className="inline-error" style={{ color: '#dc2626' }}>{profileError}</p>}
            {profileMessage && <p className="inline-success">{profileMessage}</p>}

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Foto Profile</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
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

                {photoPreviewUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#666' ,transform: 'translateY(-23px)'}}>Preview Foto Baru</div>
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
                          //naikin foto agak ke atass
                          transform: 'translateY(-23px)',
                        }}
                      />
                      <button
                        type="button"
                        className="secondary-btn"
                       
                        //button color red
                        
                        onClick={() => {
                          try { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); } catch {}
                          setPhotoPreviewUrl(null);
                          setProfileForm((prev) => ({ ...prev, photo_file: null }));
                          if (photoInputRef.current) {
                            try { photoInputRef.current.value = ''; } catch {}
                          }
                        }}
                        style={{ marginTop: 8, width: '100%'}}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                  
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
                    Ganti Foto
                  </button>
                </div>
              </div>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Nama lengkap"
                  required
                  minLength={3}
                  maxLength={50}
                  disabled={profileLoading}
                />
              </div>
              <div className="form-group">
                <label>Nomor Telepon</label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Contoh: 081234567890 (minimal 10 digit)"
                  required
                  minLength={10}
                  maxLength={14}
                  disabled={profileLoading}
                  pattern="^\d{10,}$"
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
                  required
                  minLength={15}
                  maxLength={255}
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label>Tanggal Bergabung</label>
                <input
                  type="text"
                  value={currentUser.employee?.join_date ? new Date(currentUser.employee.join_date).toLocaleDateString('id-ID') : '-'}
                  disabled={true}
                  style={{ backgroundColor: '#f5f5f5' }}
                />
              </div>
              <div className="form-group">
                <label>Jabatan</label>
                <input
                  type="text"
                  value={currentUser.employee?.job_title || '-'}
                  disabled={true}
                  style={{ backgroundColor: '#f5f5f5' }}
                />
              </div>
            </div>

            <div className="form-actions compact-actions">
              <button type="submit" disabled={profileLoading || !profileIsDirty} className="primary-btn">
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
                  min={new Date().toISOString().slice(0, 10)}
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
                  min={leaveForm.start_date || new Date().toISOString().slice(0, 10)}
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
                  required
                  minLength={3}
                  maxLength={300}
                  disabled={leaveSubmitLoading}
                  pattern="^[a-zA-Z\s\-_]+$"
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
              const canDecide = canDecideLeaveRequest(request);

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
          <p>{currentUser.user.role === 'admin' ? 'Admin hanya dapat review reimburse.' : canReviewLeaves ? 'Review dan ajukan reimburse.' : 'Ajukan dan pantau reimburse Anda.'}</p>
          <div className="leave-summary">
            <span>Pending: {reimbursementSummary.pending}</span>
            <span>Approved: {reimbursementSummary.approved}</span>
            <span>Declined: {reimbursementSummary.declined}</span>
            <span>Total Approved: Rp {reimbursementSummary.totalApproved.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {reimbursementError && <p className="inline-error" style={{ color: '#dc2626' }}>{reimbursementError}</p>}
        {reimbursementMessage && <p className="inline-success">{reimbursementMessage}</p>}

        {canCreateReimbursement && currentUser.employee ? (
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
                  min={1}
                  value={reimbursementForm.amount}
                  onChange={(e) => setReimbursementForm((prev) => ({ ...prev, amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                  required
                  disabled={reimbursementSubmitLoading}
                />
              </div>
              <div className="form-group">
                <label>Tanggal Pengeluaran</label>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
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
                  //input ga boleh berupa angka
                  pattern="^[a-zA-Z\s\-_]+$"
                  onChange={(e) => setReimbursementForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Contoh: Transport meeting client"
                  disabled={reimbursementSubmitLoading}
                  maxLength={50}
                  
                />
              </div>
              <div className="form-group">
                <label>Upload Foto Struk/Bukti</label>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptFileChange}
                  required
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
        ) : currentUser.user.role === 'admin' ? (
          <p>Admin hanya dapat approve atau decline request reimburse.</p>
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

      {activeMenu === 'attendance-qr' && canManageAttendanceQr && (
      <section className="panel attendance-panel">
        <div className="section-head">
          <div>
            <h3>Attendance QR</h3>
            <p className="subtext">QR hari ini untuk absensi masuk. Klik Refresh QR untuk membuat kode baru.</p>
          </div>
          <button type="button" onClick={handleRefreshAttendanceQr} disabled={attendanceQrLoading}>
            {attendanceQrLoading ? 'Memuat...' : 'Refresh QR'}
          </button>
        </div>

        {attendanceQrError && <div className="alert-error">{attendanceQrError}</div>}

        {attendanceQr ? (
          <div className="qr-layout">
            <div className="qr-card">
              <img
                className="qr-code-image"
                src={attendanceQr.qrDataUrl}
                alt="QR code absensi"
              />
              <div className="qr-card-meta">
                <span className="qr-card-pill">Hari ini</span>
                <strong>{attendanceQr.valid_for_date}</strong>
              </div>
              <p className="subtext qr-card-note">QR akan berganti saat Anda menekan Refresh QR.</p>
            </div>
          </div>
        ) : (
          !attendanceQrLoading && !attendanceQrError && (
            <p className="subtext">Belum ada QR code yang dimuat.</p>
          )
        )}
      </section>
      )}

      {activeMenu === 'attendance-scan' && canScanAttendance && (
      <section className="panel scanner-panel">
        <div className="section-head">
          <div>
            <h3>Scan QR Absensi</h3>
            <p className="subtext">Scan QR absensi yang ditampilkan admin untuk mencatat kehadiran Anda.</p>
          </div>
        </div>

        {token && <AttendanceScanner token={token} />}
      </section>
      )}

      {activeMenu === 'attendance-history' && canManageAttendanceQr && (
      <section className="panel attendance-history-panel">
        <div className="section-head">
          <div>
            <h3>Riwayat Absensi</h3>
            <p className="subtext">Lihat riwayat absensi semua karyawan.</p>
          </div>
        </div>

        {attendanceHistoryError && <div className="alert-error">{attendanceHistoryError}</div>}

        <div className="filter-row" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
            <label>Bulan</label>
            <select
              value={attendanceHistoryFilters.month}
              onChange={(e) => setAttendanceHistoryFilters((prev) => ({ ...prev, month: Number(e.target.value) }))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {String(month).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
            <label>Tahun</label>
            <select
              value={attendanceHistoryFilters.year}
              onChange={(e) => setAttendanceHistoryFilters((prev) => ({ ...prev, year: Number(e.target.value) }))}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {attendanceHistoryLoading ? (
          <p>Memuat riwayat absensi...</p>
        ) : attendanceHistory.length === 0 ? (
          <p className="subtext">Tidak ada data absensi untuk bulan ini.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Nama</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Tanggal</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Jam Masuk</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Terlambat (menit)</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record, idx) => (
                  <tr
                    key={record.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <td style={{ padding: 12 }}>
                      <strong>{record.employee_name || 'N/A'}</strong>
                    </td>
                    <td style={{ padding: 12 }}>
                      {record.employee_email || 'N/A'}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {record.date}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {record.check_in_at
                        ? new Date(record.check_in_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {record.late_minutes || 0}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span
                        className={`status-pill status-${record.status}`}
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor:
                            record.status === 'present' ? '#d1fae5' :
                            record.status === 'late' ? '#fef3c7' :
                            '#f3f4f6',
                          color:
                            record.status === 'present' ? '#065f46' :
                            record.status === 'late' ? '#92400e' :
                            '#374151',
                        }}
                      >
                        {record.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {activeMenu === 'payroll' && canManagePayroll && (
        <section className="panel payroll-panel">
          <h3>Payroll Management</h3>
          <p className="subtext">Buat period, tambah item manual saat draft, generate payslip, lalu finalize untuk mengunci.</p>

          {payrollError && <p className="inline-error">{payrollError}</p>}
          {payrollMessage && <p className="inline-success">{payrollMessage}</p>}

          <div className="form-group" style={{ maxWidth: 320 }}>
            <label>Menu Payroll</label>
            <select value={payrollView} onChange={(e) => setPayrollView(e.target.value as 'payslips' | 'items')}>
              <option value="payslips">Daftar Payslip</option>
              <option value="items">Tambah Item Manual</option>
            </select>
          </div>

          {payrollView === 'payslips' && (
            <>
              <form className="crm-form" onSubmit={handleCreatePayrollPeriod}>
                <div className="form-header">
                  <h4>Buat Payroll Period</h4>
                </div>
                <div className="form-row-three">
                  <div className="form-group">
                    <label>Bulan</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={periodForm.month}
                      onChange={(e) => setPeriodForm((prev) => ({ ...prev, month: Number(e.target.value) }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Tahun</label>
                    <input
                      type="number"
                      min={2000}
                      value={periodForm.year}
                      onChange={(e) => setPeriodForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button type="submit" className="primary-btn" disabled={payrollActionLoading}>
                      {payrollActionLoading ? 'Menyimpan...' : 'Buat Period'}
                    </button>
                  </div>
                </div>
              </form>

              <div className="crm-form">
                <div className="form-header">
                  <h4>Period Aktif</h4>
                </div>
                <div className="form-row-three">
                  <div className="form-group">
                    <label>Period</label>
                    <select
                      value={selectedPayrollPeriodId}
                      onChange={(e) => setSelectedPayrollPeriodId(e.target.value)}
                      disabled={payrollLoading || payrollPeriods.length === 0}
                    >
                      {payrollPeriods.length === 0 && <option value="">Belum ada period</option>}
                      {payrollPeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {String(period.month).padStart(2, '0')}/{period.year} ({period.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button type="button" className="secondary-btn" onClick={handleGeneratePayroll} disabled={payrollActionLoading || !selectedPayrollPeriodId} style={{ width: '100%' }}>
                      {payrollActionLoading ? 'Generating...' : 'Generate Payslip'}
                    </button>
                  </div>
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button type="button" className="danger-btn" onClick={handleFinalizePayroll} disabled={payrollActionLoading || !selectedPayrollPeriodId} style={{ width: '100%' }}>
                      Finalize Period
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {payrollView === 'payslips' && (
            <>
              <div className="payroll-preview-table">
                <h4>Payslips</h4>
               
                {payrollPayslips.length === 0 ? (
                  <p>Belum ada payslip di period ini.</p>
                ) : (
                  <div className="payroll-grid">
                    {payrollPayslips.map((payslip) => (
                      <div key={payslip.id} className="user-item">
                        <div>
                          <strong>{payslip.employee?.full_name || payslip.employee_id}</strong>
                          <p>
                            Incentive: Rp {Number(payslip.total_incentive || 0).toLocaleString('id-ID')} | Reimburse: Rp {Number(payslip.total_reimburse || 0).toLocaleString('id-ID')} | Penalty: Rp {Number(payslip.total_penalty || 0).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div>
                          <span className="status-pill">Net: Rp {Number(payslip.net_salary || 0).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {payrollDetailError && <p className="inline-error">{payrollDetailError}</p>}

              {payrollDetailLoading && <p>Memuat detail payslip...</p>}

              {payrollPayslipDetail && !payrollDetailLoading && (
                <div className="payroll-preview-table">
                  <h4>Detail Payslip</h4>
                  {payrollPayslips.length > 0 && (
                  <div className="form-group" style={{ maxWidth: 320, marginBottom: 16 }}>
                    <label>Pilih Detail Payslip</label>
                    <select value={selectedPayrollPayslipId} onChange={(e) => setSelectedPayrollPayslipId(e.target.value)}>
                      <option value="">Pilih payslip</option>
                      {payrollPayslips.map((payslip) => (
                        <option key={payslip.id} value={payslip.id}>
                          {payslip.employee?.full_name || payslip.employee_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                  <div className="payroll-grid">
                    <div className="user-item">
                      <div>
                        <strong>{payrollPayslipDetail.payslip.employee?.full_name || payrollPayslipDetail.payslip.employee_id}</strong>
                        <p>
                          Base: Rp {Number(payrollPayslipDetail.totals.base_salary || 0).toLocaleString('id-ID')} | Incentive: Rp {Number(payrollPayslipDetail.totals.total_incentive || 0).toLocaleString('id-ID')} | Reimburse: Rp {Number(payrollPayslipDetail.totals.total_reimburse || 0).toLocaleString('id-ID')} | Penalty: Rp {Number(payrollPayslipDetail.totals.total_penalty || 0).toLocaleString('id-ID')}
                        </p>
                        <p>
                          Net: Rp {Number(payrollPayslipDetail.totals.net_salary || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div>
                        <span className="status-pill">
                          {payrollPayslipDetail.payslip.period?.month
                            ? `${String(payrollPayslipDetail.payslip.period.month).padStart(2, '0')}/${payrollPayslipDetail.payslip.period.year}`
                            : 'Payslip'}
                        </span>
                      </div>
                    </div>

                    <div className="user-item" style={{ gridColumn: '1 / -1' }}>
                      <div>
                        <strong>Breakdown Item</strong>
                        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                          {payrollPayslipDetail.items.length === 0 ? (
                            <p>Tidak ada item detail.</p>
                          ) : (
                            payrollPayslipDetail.items.map((item) => (
                              <div key={item.id} className="summary-item">
                                <span>{item.type.toUpperCase()} / {item.source}</span>
                                <strong>Rp {Number(item.amount || 0).toLocaleString('id-ID')}</strong>
                                {item.description && <p>{item.description}</p>}
                                {item.source === 'manual' && payrollPeriods.find((period) => period.id === selectedPayrollPeriodId)?.status === 'draft' && (
                                  <button
                                    type="button"
                                    className="danger-btn"
                                    onClick={() => void handleDeleteManualPayrollItem(payrollPayslipDetail.payslip.id, item.id)}
                                    disabled={payrollActionLoading}
                                    style={{ width: 'fit-content' }}
                                  >
                                    Hapus Item Manual
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {payrollView === 'items' && (
            <>
              <div className="crm-form">
                <div className="form-header">
                  <h4>Period</h4>
                </div>
                <div className="form-row-three">
                  <div className="form-group">
                    <label>Pilih Period</label>
                    <select
                      value={selectedPayrollPeriodId}
                      onChange={(e) => setSelectedPayrollPeriodId(e.target.value)}
                      disabled={payrollLoading || payrollPeriods.filter((p) => p.status === 'draft').length === 0}
                    >
                      {payrollPeriods.filter((p) => p.status === 'draft').length === 0 && <option value="">Belum ada period draft</option>}
                      {payrollPeriods.filter((p) => p.status === 'draft').map((period) => (
                        <option key={period.id} value={period.id}>
                          {String(period.month).padStart(2, '0')}/{period.year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <form className="crm-form" onSubmit={handleAddManualPayrollItem}>
                <div className="form-header">
                  <h4>Tambah Item Manual (Insentif / Penalti)</h4>
                </div>
                <div className="form-row-three">
                  <div className="form-group">
                    <label>Employee</label>
                    <select
                      value={manualItemForm.employee_id}
                      onChange={(e) => setManualItemForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                      required
                    >
                      <option value="">Pilih employee</option>
                      {users.filter((u) => u.employee).map((u) => (
                        <option key={u.id} value={u.employee?.id || ''}>
                          {u.employee?.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tipe</label>
                    <select
                      value={manualItemForm.type}
                      onChange={(e) => setManualItemForm((prev) => ({ ...prev, type: e.target.value as 'incentive' | 'penalty' }))}
                    >
                      <option value="incentive">Incentive</option>
                      <option value="penalty">Penalty (kerusakan/dll)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nominal</label>
                    <input
                      type="number"
                      min={1}
                      value={manualItemForm.amount}
                      onChange={(e) => setManualItemForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                      required
                    />
                  </div>
                </div>
                <div className="form-row-one">
                  <div className="form-group">
                    <label>Deskripsi</label>
                    <input
                      value={manualItemForm.description}
                      onChange={(e) => setManualItemForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Contoh: Penalti kerusakan inventaris"
                    />
                  </div>
                </div>
                <div className="form-actions compact-actions">
                  <button type="submit" className="primary-btn" disabled={payrollActionLoading || !selectedPayrollPeriodId || !manualItemForm.employee_id}>
                    {payrollActionLoading ? 'Menyimpan...' : 'Tambah Item Manual'}
                  </button>
                </div>
              </form>

              {payrollPayslips.length > 0 && (
                <div className="payroll-preview-table">
                  <h4>Item Manual di Payslips</h4>
                  <div className="payroll-grid">
                    {payrollPayslips.map((payslip) => {
                      const manualItems = payslip.items?.filter((item) => item.source === 'manual') || [];
                      return (
                        <div key={payslip.id} className="user-item">
                          <div>
                            <strong>{payslip.employee?.full_name || payslip.employee_id}</strong>
                            {manualItems.length > 0 ? (
                              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                                {manualItems.map((item) => (
                                  <div key={item.id} style={{ fontSize: 12, color: '#666' }}>
                                    {item.type.toUpperCase()}: Rp {Number(item.amount || 0).toLocaleString('id-ID')} {item.description && `(${item.description})`}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Tidak ada item manual</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeMenu === 'my-payroll' && canViewMyPayroll && (
        <section className="panel payroll-panel">
          <h3>Payslip Saya</h3>
          <p>Lihat ringkasan gaji, insentif, dan penalti Anda sendiri.</p>

          {myPayrollError && <p className="inline-error">{myPayrollError}</p>}

          {myPayrollLoading && <p>Memuat payslip...</p>}

          {!myPayrollLoading && myPayrollPayslips.length === 0 && (
            <p>Belum ada payslip untuk akun ini.</p>
          )}

          {myPayrollPayslips.length > 0 && (
            <div className="payroll-preview-table">
              <div className="form-group" style={{ maxWidth: 320 }}>
                <label>Pilih Payslip</label>
                <select
                  value={selectedMyPayslipId}
                  onChange={(e) => setSelectedMyPayslipId(e.target.value)}
                >
                  <option value="">Pilih payslip</option>
                  {myPayrollPayslips.map((payslip) => (
                    <option key={payslip.id} value={payslip.id}>
                      {(() => {
                        const payslipPeriod = (payslip as PayrollPayslip & { period?: PayrollPeriod }).period;
                        return payslipPeriod?.month
                          ? `${String(payslipPeriod.month).padStart(2, '0')}/${payslipPeriod.year}`
                          : payslip.period_id;
                      })()}
                    </option>
                  ))}
                </select>
              </div>

              {myPayrollDetail && (
                <div className="payroll-grid" style={{ marginTop: 16 }}>
                  <div className="user-item">
                    <div>
                      <strong>{myPayrollDetail.payslip.employee?.full_name || employeeName}</strong>
                      <p>
                        Base: Rp {Number(myPayrollDetail.totals.base_salary || 0).toLocaleString('id-ID')} | Incentive: Rp {Number(myPayrollDetail.totals.total_incentive || 0).toLocaleString('id-ID')} | Reimburse: Rp {Number(myPayrollDetail.totals.total_reimburse || 0).toLocaleString('id-ID')} | Penalty: Rp {Number(myPayrollDetail.totals.total_penalty || 0).toLocaleString('id-ID')}
                      </p>
                      <p>
                        Net: Rp {Number(myPayrollDetail.totals.net_salary || 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div>
                      <span className="status-pill">{myPayrollDetail.payslip.period?.month ? `${String(myPayrollDetail.payslip.period.month).padStart(2, '0')}/${myPayrollDetail.payslip.period.year}` : 'Payslip'}</span>
                    </div>
                  </div>

                  <div className="user-item" style={{ gridColumn: '1 / -1' }}>
                    <div>
                      <strong>Breakdown Item</strong>
                      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                        {myPayrollDetail.items.length === 0 ? (
                          <p>Tidak ada item detail.</p>
                        ) : (
                          myPayrollDetail.items.map((item) => (
                            <div key={item.id} className="summary-item">
                              <span>{item.type.toUpperCase()} / {item.source}</span>
                              <strong>Rp {Number(item.amount || 0).toLocaleString('id-ID')}</strong>
                              {item.description && <p>{item.description}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeMenu === 'user-tree' && canViewTree && (
        <UserTreePage token={token} currentUserRole={currentUser.user.role} />
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
              {!editingUserId ? (
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="primary-btn"
                >
                  {submitLoading ? 'Menyimpan...' : 'Tambah User'}
                </button>
              ) : userFormHasChanges ? (
                <>
                  <button type="button" className="secondary-btn" onClick={resetForm}>
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading || Boolean(userFormValidationError)}
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
