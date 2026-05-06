import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');
      await auth.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim permintaan reset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Employee Portal</p>
        <h2>Forgot Password</h2>
        <p className="subtext">Masukkan email Anda untuk meminta reset password.</p>

        {error && <div className="alert-error">{error}</div>}

        {submitted ? (
          <div>
            <div className="alert-success">
              <strong>Permintaan terkirim!</strong>
              <br />
              Permintaan reset password Anda sedang menunggu persetujuan Admin.
              Setelah disetujui, Anda akan mendapatkan token reset untuk membuat password baru.
            </div>
            <div style={{
              marginTop: '16px',
              padding: '14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#475569',
              lineHeight: 1.6,
            }}>
              <strong style={{ color: '#0f172a' }}>Langkah selanjutnya:</strong>
              <ol style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                <li>Admin akan mereview permintaan Anda</li>
                <li>Jika disetujui, hubungi Admin untuk mendapatkan token reset</li>
                <li>Gunakan token tersebut di halaman Reset Password</li>
              </ol>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Link to="/reset-password" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px' }}>
                Sudah punya token? Reset Password →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                placeholder="nama@company.com"
              />
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Mengirim...' : 'Kirim Permintaan Reset'}
            </button>
          </form>
        )}

        <p className="form-footer">
          Kembali ke <Link to="/login">login</Link>
        </p>
      </section>
    </div>
  );
}
