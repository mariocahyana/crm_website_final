interface PortalHeaderProps {
  portalType: 'Admin' | 'Manager' | 'Staff';
  employeeName: string;
  profilePhotoSrc: string;
  onLogout: () => void;
  onProfileClick: () => void;
}

export function PortalHeader({
  portalType,
  employeeName,
  profilePhotoSrc,
  onLogout,
  onProfileClick,
}: PortalHeaderProps) {
  return (
    <header className="portal-head">
      <div>
        <p className="eyebrow">{portalType} Portal</p>
        <h1>Selamat datang, {employeeName}</h1>
        <p className="subtext">Anda sudah login.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onLogout} className="danger-btn">
          Logout
        </button>
        <button
          type="button"
          onClick={onProfileClick}
          title="Buka Profile"
          aria-label="Buka Profile"
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            width: 44,
            height: 44,
            borderRadius: 8,
          }}
        >
          <img
            src={profilePhotoSrc}
            alt="Foto profil user"
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              objectFit: 'cover',
              border: '2px solid #d1d5db',
              display: 'block',
            }}
          />
        </button>
      </div>
    </header>
  );
}
