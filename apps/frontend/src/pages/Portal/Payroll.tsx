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

interface PayrollPageProps {
  currentUser: SessionUser;
  activeTab: 'payroll' | 'my-payroll';
  token: string | null;
}

export function PayrollPage({ currentUser, activeTab, token }: PayrollPageProps) {
  return (
    <section className="panel payroll-panel">
      <h3>Payroll Management</h3>
      <p>Payroll section - Tab: {activeTab}</p>
      {!token && <p style={{ color: '#dc2626' }}>Not authenticated</p>}
    </section>
  );
}
