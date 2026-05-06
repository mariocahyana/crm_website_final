import { useState } from 'react';
import { auth } from '../../services/auth';

interface ChangePasswordPageProps {
  token: string | null;
  currentUserRole?: 'admin' | 'staff' | 'manager';
}

export function ChangePasswordPage({ token, currentUserRole }: ChangePasswordPageProps) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (currentUserRole === 'admin') {
    return (
      <section className="panel" style={{ padding: '20px', maxWidth: '480px' }}>
        <h3 style={{ margin: '0 0 6px' }}>Ubah Password</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
          Akun admin tidak dapat mengubah password dari portal ini.
        </p>
      </section>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (form.newPassword.length < 8) {
      setError('Password baru minimal 8 karakter');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Konfirmasi password tidak cocok');
      return;
    }
    if (!token) {
      setError('Sesi tidak valid, silakan login ulang');
      return;
    }

    try {
      setLoading(true);
      await auth.changePassword(token, form.currentPassword, form.newPassword);
      setMessage('Password berhasil diubah!');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#374151',
  };

  return (
    <section className="panel" style={{ padding: '20px', maxWidth: '480px' }}>
      <h3 style={{ margin: '0 0 6px' }}>Ubah Password</h3>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>
        Pastikan password baru Anda minimal 8 karakter.
      </p>

      {error && (
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#c2410c',
        }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#15803d',
        }}>
          ✓ {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Password Saat Ini</label>
          <input
            name="currentPassword"
            type="password"
            value={form.currentPassword}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="Masukkan password saat ini"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Password Baru</label>
          <input
            name="newPassword"
            type="password"
            value={form.newPassword}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="Minimal 8 karakter"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Konfirmasi Password Baru</label>
          <input
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            disabled={loading}
            placeholder="Ulangi password baru"
            style={{
              ...inputStyle,
              borderColor: form.confirmPassword && form.confirmPassword !== form.newPassword ? '#f87171' : undefined,
            }}
          />
          {form.confirmPassword && form.confirmPassword !== form.newPassword && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#ef4444' }}>Password tidak cocok</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '11px',
            background: loading ? '#94a3b8' : 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '4px',
          }}
        >
          {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
        </button>
      </form>
    </section>
  );
}
