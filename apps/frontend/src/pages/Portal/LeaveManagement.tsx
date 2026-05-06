interface LeaveManagementPageProps {
  token: string | null;
}

export function LeaveManagementPage({ token }: LeaveManagementPageProps) {
  return (
    <section className="panel leave-panel">
      <h3>Leave Management</h3>
      <p>Leave management section</p>
      {!token && <p style={{ color: '#dc2626' }}>Not authenticated</p>}
    </section>
  );
}
