interface SessionUser {
  user: {
    id: string;
    email: string;
    role: 'admin' | 'staff';
  };
  employee: {
    id: string;
    full_name: string;
    phone: string;
    address: string;
    photo_url: string | null;
  } | null;
}

interface PortalPageProps {
  currentUser: SessionUser;
  onLogout: () => void;
}

export function PortalPage({ currentUser, onLogout }: PortalPageProps) {
  const portalType = currentUser.user.role === 'admin' ? 'Admin' : 'Staff';
  const employeeName = currentUser.employee?.full_name || 'User';

  return (
    <div className="portal-shell">
      <header className="portal-head">
        <div>
          <p className="eyebrow">{portalType} Portal</p>
          <h1>Selamat datang, {employeeName}</h1>
          <p className="subtext">Anda sudah login.</p>
        </div>
        <button onClick={onLogout} className="danger-btn">
          Logout
        </button>
      </header>

      <section className="panel">
        <h3>Informasi Akun</h3>
        <p><strong>Nama:</strong> {employeeName}</p>
        <p><strong>Email:</strong> {currentUser.user.email}</p>
        <p><strong>Role:</strong> {currentUser.user.role.toUpperCase()}</p>
      </section>
    </div>
  );
}
