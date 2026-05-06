interface ReimburseManagementPageProps {
  token: string | null;
}

export function ReimburseManagementPage({ token }: ReimburseManagementPageProps) {
  return (
    <section className="panel reimburse-panel">
      <h3>Reimbursement Management</h3>
      <p>Reimbursement section</p>
      {!token && <p style={{ color: '#dc2626' }}>Not authenticated</p>}
    </section>
  );
}
