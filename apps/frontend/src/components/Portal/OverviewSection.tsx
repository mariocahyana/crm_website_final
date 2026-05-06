interface LeaveRequestSummary {
  pending: number;
  approved: number;
  declined: number;
}

interface ReimbursementRequestSummary {
  pending: number;
  approved: number;
  declined: number;
  totalApproved: number;
}

interface OverviewSectionProps {
  employeeName: string;
  email: string;
  role: string;
  leaveSummary: LeaveRequestSummary;
  reimbursementSummary: ReimbursementRequestSummary;
}

export function OverviewSection({
  employeeName,
  email,
  role,
  leaveSummary,
  reimbursementSummary,
}: OverviewSectionProps) {
  return (
    <section className="panel overview-panel">
      <h3>Informasi Akun</h3>
      <div className="summary-grid">
        <div className="summary-item">
          <span>Nama</span>
          <strong>{employeeName}</strong>
        </div>
        <div className="summary-item">
          <span>Email</span>
          <strong>{email}</strong>
        </div>
        <div className="summary-item">
          <span>Role</span>
          <strong>{role.toUpperCase()}</strong>
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
  );
}
