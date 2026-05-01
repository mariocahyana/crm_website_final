import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');
      setMessage('');
      setResetToken('');

      const response = await auth.forgotPassword(email);
      setMessage(response.data.message || 'Jika email terdaftar, link reset akan dikirim.');
      setResetToken(response.data.reset_token || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Employee Portal</p>
        <h2>Forgot Password</h2>
        <p className="subtext">Masukkan email Anda untuk mendapatkan token reset.</p>

        {error && <div className="alert-error">{error}</div>}
        {message && <div className="alert-success">{message}</div>}
        {resetToken && (
          <div className="token-box">
            <p>Reset Token</p>
            <code>{resetToken}</code>
            <Link to={`/reset-password?token=${encodeURIComponent(resetToken)}`} className="inline-link">
              Buka halaman reset password
            </Link>
          </div>
        )}

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
            {isLoading ? 'Mengirim...' : 'Kirim Reset Token'}
          </button>
        </form>

        <p className="form-footer">
          Kembali ke <Link to="/login">login</Link>
        </p>
      </section>
    </div>
  );
}
