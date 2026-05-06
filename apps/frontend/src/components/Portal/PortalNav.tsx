export type PortalMenu = 'overview' | 'profile' | 'leave' | 'reimburse' | 'users' | 'attendance-qr' | 'attendance-history' | 'attendance-scan' | 'payroll' | 'my-payroll';

interface PortalNavProps {
  activeMenu: PortalMenu;
  portalMenus: Array<{ id: PortalMenu; label: string }>;
  onMenuChange: (menu: PortalMenu) => void;
}

export function PortalNav({ activeMenu, portalMenus, onMenuChange }: PortalNavProps) {
  return (
    <nav className="portal-nav" aria-label="Portal menu">
      <div className="menu-tabs">
        {portalMenus.map((menu) => (
          <button
            key={menu.id}
            type="button"
            className={activeMenu === menu.id ? 'menu-tab active' : 'menu-tab'}
            onClick={() => onMenuChange(menu.id)}
          >
            {menu.label}
          </button>
        ))}
      </div>
      <div className="menu-select-wrap">
        <label htmlFor="portal-menu">Menu</label>
        <select
          id="portal-menu"
          value={activeMenu}
          onChange={(e) => onMenuChange(e.target.value as PortalMenu)}
        >
          {portalMenus.map((menu) => (
            <option key={menu.id} value={menu.id}>{menu.label}</option>
          ))}
        </select>
      </div>
    </nav>
  );
}
