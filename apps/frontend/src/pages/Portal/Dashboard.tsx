import { useMemo } from 'react';
import { OverviewSection } from '../../components/Portal/OverviewSection';

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

interface DashboardPageProps {
  currentUser: SessionUser;
}

export function DashboardPage({ currentUser }: DashboardPageProps) {
  const employeeName = currentUser.employee?.full_name || 'User';
  const email = currentUser.user.email;
  const role = currentUser.user.role;

  // Mock data - will be replaced with actual API data loading
  const leaveRequests = [];
  const reimbursementRequests = [];

  const leaveSummary = useMemo(() => ({
    pending: leaveRequests.filter((request) => request.status === 'pending').length,
    approved: leaveRequests.filter((request) => request.status === 'approved').length,
    declined: leaveRequests.filter((request) => request.status === 'declined').length,
  }), []);

  const reimbursementSummary = useMemo(() => ({
    pending: reimbursementRequests.filter((request) => request.status === 'pending').length,
    approved: reimbursementRequests.filter((request) => request.status === 'approved').length,
    declined: reimbursementRequests.filter((request) => request.status === 'declined').length,
    totalApproved: reimbursementRequests
      .filter((request) => request.status === 'approved')
      .reduce((sum, request) => sum + Number(request.amount || 0), 0),
  }), []);

  return (
    <OverviewSection
      employeeName={employeeName}
      email={email}
      role={role}
      leaveSummary={leaveSummary}
      reimbursementSummary={reimbursementSummary}
    />
  );
}
