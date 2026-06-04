import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

interface SidebarProps {
  navItems: NavItem[];
}

function BrandLogo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 48 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        fill="#863bff"
        d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
      />
    </svg>
  );
}

export default function Sidebar({ navItems }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed.toString());
    document.documentElement.setAttribute('data-sidebar-collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  return (
    <>
      <button
        className="sidebar-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <i className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-left'}`}></i>
      </button>

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <BrandLogo />
          {!isCollapsed && (
            <div className="brand-text">
              <div className="brand-logo">4BIO</div>
              <div className="brand-subtitle">Interno</div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <ul>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <i className={item.icon}></i>
                  {!isCollapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
