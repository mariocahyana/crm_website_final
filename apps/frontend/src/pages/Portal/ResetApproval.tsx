import { useState, useCallback } from 'react';
import { auth, type PendingResetRequest } from '../../services/auth';

interface ResetApprovalPageProps {
  token: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Sudah expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} menit lagi`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} jam lagi`;
}

export function ResetApprovalPage({ token }: ResetApprovalPageProps) {
  const [requests, setRequests] = useState<PendingResetRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await auth.getPendingResets(token);
      setRequests(data);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat request');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleApprove = async (resetId: string, userEmail: string) => {
    if (!token) return;
    if (!confirm(`Approve permintaan reset password dari ${userEmail}?`)) return;
    setActionLoading(resetId);
    setError('');
    try {
      await auth.approveReset(token, resetId);
      setMessage(`✓ Request dari ${userEmail} berhasil diapprove`);
      setRequests((prev) => prev.filter((r) => r.id !== resetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal approve request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (resetId: string, userEmail: string) => {
    if (!token) return;
    if (!confirm(`Tolak permintaan reset password dari ${userEmail}?`)) return;
    setActionLoading(resetId);
    setError('');
    try {
      await auth.rejectReset(token, resetId);
      setMessage(`Request dari ${userEmail} berhasil ditolak`);
      setRequests((prev) => prev.filter((r) => r.id !== resetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal reject request');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Approval Reset Password</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
            Review permintaan reset password dari karyawan
          </p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: loading ? '#94a3b8' : 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {loading ? 'Memuat...' : loaded ? '↺ Refresh' : 'Muat Request'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#c2410c' }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#15803d' }}>
          {message}
        </div>
      )}

      {!loaded && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
          <p style={{ margin: 0, fontSize: '14px' }}>Klik "Muat Request" untuk melihat permintaan yang masuk</p>
        </div>
      )}

      {loaded && !loading && requests.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p style={{ margin: 0, fontSize: '14px' }}>Tidak ada permintaan reset password yang menunggu</p>
        </div>
      )}

      {requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map((req) => {
            const name = req.user.employee?.full_name ?? req.user.email;
            const empNum = req.user.employee?.employee_number;
            const jobTitle = req.user.employee?.job_title;
            const isActing = actionLoading === req.id;

            return (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  background: '#fafafa',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {req.user.email}
                    {empNum && ` · ${empNum}`}
                    {jobTitle && ` · ${jobTitle}`}
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#0f172a' }}>
                    <span style={{ fontWeight: 600 }}>Token:</span>{' '}
                    <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {req.token_value || 'Belum tersedia'}
                    </span>
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', background: '#fef9c3', color: '#854d0e', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fef08a' }}>
                      Diajukan {timeAgo(req.created_at)}
                    </span>
                    <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      Exp: {timeLeft(req.expires_at)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleApprove(req.id, req.user.email)}
                    disabled={isActing}
                    style={{
                      padding: '8px 16px',
                      background: isActing ? '#94a3b8' : '#15803d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isActing ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {isActing ? '...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(req.id, req.user.email)}
                    disabled={isActing}
                    style={{
                      padding: '8px 16px',
                      background: isActing ? '#94a3b8' : '#fee2e2',
                      color: isActing ? '#fff' : '#c2410c',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      cursor: isActing ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {isActing ? '...' : '✕ Tolak'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
