import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auth } from '../services/auth';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');
      setMessage('');

      const response = await auth.resetPassword(token, newPassword);
      setMessage(response.data.message || 'Password berhasil diperbarui');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Employee Portal</p>
        <h2>Reset Password</h2>
        <p className="subtext">Gunakan token reset untuk membuat password baru.</p>

        {error && <div className="alert-error">{error}</div>}
        {message && <div className="alert-success">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="token">Reset Token</label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Masukkan token reset"
            />
          </div>

          <div>
            <label htmlFor="newPassword">Password Baru</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Password baru"
            />
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Menyimpan...' : 'Reset Password'}
          </button>
        </form>

        <p className="form-footer">
          Kembali ke <Link to="/login">login</Link>
        </p>
      </section>
    </div>
  );
}
