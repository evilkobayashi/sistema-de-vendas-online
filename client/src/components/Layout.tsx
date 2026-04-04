import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface UserInfo {
  id: string;
  name: string;
  role: string;
  employeeCode: string;
}

export default function Layout() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem('auth_user');
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    navigate('/login');
  };

  const tabs = [
    { to: '/',              icon: 'ph ph-squares-four',    label: 'Dashboard' },
    { to: '/catalogo',      icon: 'ph ph-book-open-text',  label: 'Catálogo' },
    { to: '/estoque',       icon: 'ph ph-package',         label: 'Estoque' },
    { to: '/nova-compra',   icon: 'ph ph-shopping-cart',   label: 'Nova compra' },
    { to: '/pedidos',       icon: 'ph ph-receipt',         label: 'Pedidos' },
    { to: '/entregas',      icon: 'ph ph-truck',           label: 'Entregas' },
    { to: '/atendimento',   icon: 'ph ph-headset',         label: 'Atendimento' },
    { to: '/clientes',      icon: 'ph ph-users',           label: 'Clientes' },
    { to: '/medicos',       icon: 'ph ph-stethoscope',     label: 'Médicos' },
    { to: '/planos-saude',  icon: 'ph ph-heart-half',      label: 'Planos de saúde' },
    { to: '/cadastros',     icon: 'ph ph-folder-plus',     label: 'Cadastros' },
    { to: '/inventario',    icon: 'ph ph-clipboard-text',  label: 'Inventário' },
    { to: '/orcamentos',    icon: 'ph ph-calculator',      label: 'Orçamentos' },
  ];

  return (
    <>
      <header className="topbar">
        <div className="brand">4BIO <span>Interno</span></div>
        <div className="topbar-actions">
          {user && (
            <div className="user-badge">
              <i className="ph ph-user-circle" style={{ fontSize: 18 }}></i>
              {user.name} • {user.role}
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            <i className="ph ph-sign-out"></i> Sair
          </button>
        </div>
      </header>

      <main className="layout">
        <nav className="tabs">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
            >
              <i className={t.icon}></i> {t.label}
            </NavLink>
          ))}
        </nav>
        <section className="panel" style={{ animation: 'slideUp 0.4s ease-out' }}>
          <Outlet />
        </section>
      </main>
    </>
  );
}
