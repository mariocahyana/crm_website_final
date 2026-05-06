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

interface AttendancePageProps {
  currentUser: SessionUser;
  activeTab: 'attendance-qr' | 'attendance-history' | 'attendance-scan';
  token: string | null;
}

export function AttendancePage({ currentUser, activeTab, token }: AttendancePageProps) {
  return (
    <section className="panel attendance-panel">
      <h3>Attendance Management</h3>
      <p>Attendance section - Tab: {activeTab}</p>
      {!token && <p style={{ color: '#dc2626' }}>Not authenticated</p>}
    </section>
  );
}
