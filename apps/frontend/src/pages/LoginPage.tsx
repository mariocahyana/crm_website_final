import { useState } from 'react';

interface LoginPageProps {
  isLoading: boolean;
  error: string;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ isLoading, error, onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Employee Portal</p>
        <h2>Login</h2>
        {error && <div className="alert-error">{error}</div>}

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

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Masukkan password"
            />
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </section>
    </div>
  );
}
