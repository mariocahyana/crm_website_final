import { useState, useCallback } from 'react';
import { usersApi, type UserTreeNode, type ManagerTreeNode, type UserTreeData } from '../../services/users';

interface UserTreePageProps {
  token: string | null;
  currentUserRole?: 'admin' | 'staff' | 'manager';
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

const ROLE_COLOR: Record<string, { bg: string; border: string; badge: string }> = {
  admin: { bg: '#f0fdf4', border: '#16a34a', badge: '#15803d' },
  manager: { bg: '#eff6ff', border: '#2563eb', badge: '#1d4ed8' },
  staff: { bg: '#fafafa', border: '#94a3b8', badge: '#475569' },
};

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function UserCard({ user, role }: { user: UserTreeNode; role: 'admin' | 'manager' | 'staff' }) {
  const colors = ROLE_COLOR[role] ?? ROLE_COLOR.staff;
  const name = user.employee?.full_name ?? user.email;
  const initials = getInitials(user.employee?.full_name);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: '10px',
        minWidth: '200px',
        maxWidth: '260px',
      }}
    >
      {user.employee?.photo_url ? (
        <img
          src={user.employee.photo_url}
          alt={name}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
            border: `2px solid ${colors.border}`,
          }}
        />
      ) : (
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: colors.border,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '13px',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      )}
      <div style={{ overflow: 'hidden' }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '13px',
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        {user.employee?.job_title && (
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
            {user.employee.job_title}
          </div>
        )}
        <div style={{ marginTop: '3px' }}>
          <span
            style={{
              fontSize: '10px',
              background: colors.badge,
              color: '#fff',
              borderRadius: '4px',
              padding: '1px 6px',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            {ROLE_LABEL[role]}
          </span>
          {user.employee?.employee_number && (
            <span
              style={{
                fontSize: '10px',
                color: '#94a3b8',
                marginLeft: '5px',
              }}
            >
              {user.employee.employee_number}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ManagerBranch({ manager }: { manager: ManagerTreeNode }) {
  const [expanded, setExpanded] = useState(true);
  const hasStaff = manager.subordinates.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <UserCard user={manager} role="manager" />
        {hasStaff && (
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Sembunyikan bawahan' : 'Tampilkan bawahan'}
            style={{
              position: 'absolute',
              bottom: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              border: '1.5px solid #2563eb',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: '#2563eb',
              lineHeight: 1,
              zIndex: 1,
              padding: 0,
            }}
          >
            {expanded ? '−' : '+'}
          </button>
        )}
      </div>

      {hasStaff && expanded && (
        <>
          <div style={{ width: '2px', height: '28px', background: '#cbd5e1', marginTop: '8px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', position: 'relative' }}>
            {manager.subordinates.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: '2px',
                  width: 'calc(100% - 60px)',
                  background: '#cbd5e1',
                }}
              />
            )}
            {manager.subordinates.map((staff) => (
              <div key={staff.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '2px', height: '16px', background: '#cbd5e1' }} />
                <UserCard user={staff} role="staff" />
              </div>
            ))}
          </div>
        </>
      )}

      {hasStaff && !expanded && (
        <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
          {manager.subordinates.length} bawahan tersembunyi
        </div>
      )}
    </div>
  );
}

export function UserTreePage({ token, currentUserRole }: UserTreePageProps) {
  const [treeData, setTreeData] = useState<UserTreeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadTree = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await usersApi.getUserTree(token);
      setTreeData(data);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data tree');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const totalUsers = treeData
    ? treeData.admins.length +
      treeData.managers.length +
      treeData.managers.reduce((acc, m) => acc + m.subordinates.length, 0) +
      treeData.unassigned_staff.length
    : 0;

  return (
    <section className="panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Hierarki Organisasi</h3>
          {treeData && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Total {totalUsers} pengguna aktif
              {currentUserRole === 'admin' && ` · ${treeData.admins.length} admin · ${treeData.managers.length} manager · ${treeData.managers.reduce((acc, m) => acc + m.subordinates.length, 0) + treeData.unassigned_staff.length} staff`}
            </p>
          )}
        </div>
        <button
          onClick={loadTree}
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
          {loading ? 'Memuat...' : loaded ? '↺ Refresh' : 'Tampilkan Tree'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['admin', 'manager', 'staff'] as const).map((r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: ROLE_COLOR[r].badge }} />
            {ROLE_LABEL[r]}
          </div>
        ))}
        <div style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>
          · Klik +/− untuk expand/collapse
        </div>
      </div>

      {error && (
        <p style={{ color: '#c2410c', fontSize: '13px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 14px' }}>
          {error}
        </p>
      )}

      {!loaded && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏢</div>
          <p style={{ margin: 0, fontSize: '14px' }}>Klik "Tampilkan Tree" untuk melihat hierarki organisasi</p>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>Memuat data...</p>
        </div>
      )}

      {treeData && !loading && (
        <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
          {currentUserRole === 'admin' && treeData.admins.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Administrator
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {treeData.admins.map((admin) => (
                  <UserCard key={admin.id} user={admin} role="admin" />
                ))}
              </div>
            </div>
          )}

          {currentUserRole === 'admin' && treeData.admins.length > 0 && (
            <div style={{ borderTop: '1px dashed #e2e8f0', marginBottom: '24px' }} />
          )}

          {treeData.managers.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
                Tim & Struktur
              </div>
              <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {treeData.managers.map((manager) => (
                  <ManagerBranch key={manager.id} manager={manager} />
                ))}
              </div>
            </div>
          )}

          {treeData.unassigned_staff.length > 0 && (
            <div style={{ marginTop: treeData.managers.length > 0 ? '24px' : '0' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Staff Tanpa Manager ({treeData.unassigned_staff.length})
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {treeData.unassigned_staff.map((staff) => (
                  <UserCard key={staff.id} user={staff} role="staff" />
                ))}
              </div>
            </div>
          )}

          {treeData.managers.length === 0 && treeData.unassigned_staff.length === 0 && treeData.admins.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '14px' }}>
              Belum ada user aktif.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
