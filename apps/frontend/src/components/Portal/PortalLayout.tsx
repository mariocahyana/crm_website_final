import { useState, useMemo } from 'react';
import { PortalHeader, PortalNav, type PortalMenu } from '../Portal';

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

interface PortalLayoutProps {
  currentUser: SessionUser;
  onLogout: () => void;
  activeMenu: PortalMenu;
  onMenuChange: (menu: PortalMenu) => void;
  children: React.ReactNode;
}

export function PortalLayout({
  currentUser,
  onLogout,
  activeMenu,
  onMenuChange,
  children,
}: PortalLayoutProps) {
  const portalType = currentUser.user.role === 'admin'
    ? 'Admin'
    : currentUser.user.role === 'manager'
      ? 'Manager'
      : 'Staff';

  const employeeName = currentUser.employee?.full_name || 'User';
  const canManageUsers = currentUser.user.role === 'admin';
  const canManageAttendanceQr = currentUser.user.role === 'admin';
  const canManagePayroll = currentUser.user.role === 'admin';
  const canViewMyPayroll = Boolean(currentUser.employee);
  const canScanAttendance = currentUser.user.role === 'staff' || currentUser.user.role === 'manager';

  const defaultProfilePhoto = '/images/default-profile.svg';
  const headerProfilePhotoSrc = currentUser.employee?.photo_url?.startsWith('http')
    ? currentUser.employee.photo_url
    : currentUser.employee?.photo_url
      ? `${import.meta.env.VITE_API_BASE_URL}${currentUser.employee.photo_url}`
      : defaultProfilePhoto;

  const portalMenus = useMemo(() => {
    const menus: Array<{ id: PortalMenu; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'profile', label: 'Profile' },
      { id: 'leave', label: 'Leave' },
      { id: 'reimburse', label: 'Reimburse' },
    ];

    if (canManageUsers) menus.push({ id: 'users', label: 'User Management' });
    if (canManagePayroll) menus.push({ id: 'payroll', label: 'Payroll' });
    if (canViewMyPayroll) menus.push({ id: 'my-payroll', label: 'Payslip Saya' });
    if (canManageAttendanceQr) menus.push({ id: 'attendance-qr', label: 'Attendance QR' });
    if (canManageAttendanceQr) menus.push({ id: 'attendance-history', label: 'Attendance History' });
    if (canScanAttendance) menus.push({ id: 'attendance-scan', label: 'Scan QR' });

    return menus;
  }, [canManageUsers, canManagePayroll, canViewMyPayroll, canManageAttendanceQr, canScanAttendance]);

  return (
    <div className="portal-shell">
      <PortalHeader
        portalType={portalType}
        employeeName={employeeName}
        profilePhotoSrc={headerProfilePhotoSrc}
        onLogout={onLogout}
        onProfileClick={() => onMenuChange('profile')}
      />

      <PortalNav
        activeMenu={activeMenu}
        portalMenus={portalMenus}
        onMenuChange={onMenuChange}
      />

      {children}
    </div>
  );
}
