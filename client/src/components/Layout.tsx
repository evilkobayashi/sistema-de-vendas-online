import { useEffect, useState, useRef } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationsContext';
import Sidebar from './Sidebar';
import NotificationsPanel from './NotificationsPanel';
import SettingsPanel from './SettingsPanel';

interface UserInfo {
  id: string;
  name: string;
  role: string;
  employeeCode: string;
  email?: string;
  phone?: string;
  photo?: string;
}

export default function Layout() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const notificationsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUser = () => {
      const raw = localStorage.getItem('auth_user');
      if (raw) {
        try {
          setUser(JSON.parse(raw));
        } catch {
          /* ignore */
        }
      }
    };
    loadUser();

    window.addEventListener('storage', loadUser);
    return () => window.removeEventListener('storage', loadUser);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    navigate('/login');
  };

  const refreshUser = () => {
    const raw = localStorage.getItem('auth_user');
    if (raw) {
      setUser(JSON.parse(raw));
    }
  };

  const navItems = [
    { to: '/', icon: 'ph ph-squares-four', label: 'Dashboard' },
    { to: '/catalogo', icon: 'ph ph-book-open-text', label: 'Catálogo' },
    { to: '/estoque', icon: 'ph ph-package', label: 'Estoque' },
    { to: '/nova-compra', icon: 'ph ph-shopping-cart', label: 'Nova compra' },
    { to: '/pedidos', icon: 'ph ph-receipt', label: 'Pedidos' },
    { to: '/entregas', icon: 'ph ph-truck', label: 'Entregas' },
    { to: '/recorrencias', icon: 'ph ph-repeat', label: 'Recorrências' },
    { to: '/atendimento', icon: 'ph ph-headset', label: 'Atendimento' },
    { to: '/clientes', icon: 'ph ph-users', label: 'Clientes' },
    { to: '/medicos', icon: 'ph ph-stethoscope', label: 'Médicos' },
    { to: '/planos-saude', icon: 'ph ph-heart-half', label: 'Planos de saúde' },
    { to: '/cadastros', icon: 'ph ph-folder-plus', label: 'Cadastros' },
    { to: '/inventario', icon: 'ph ph-clipboard-text', label: 'Inventário' },
    { to: '/orcamentos', icon: 'ph ph-calculator', label: 'Orçamentos' },
    { to: '/usuarios', icon: 'ph ph-user-gear', label: 'Usuários' },
  ];

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      gerente: 'Gerente',
      operador: 'Operador',
      inventario: 'Inventário',
    };
    return labels[role] || role;
  };

  return (
    <div className="app-layout">
      <Sidebar navItems={navItems} />

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-search">
            <input type="text" placeholder="Buscar..." className="search-input" />
            <i className="ph ph-magnifying-glass search-icon"></i>
          </div>

          <div className="topbar-actions">
            <button
              className="topbar-btn"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? (
                <i className="ph ph-sun" style={{ fontSize: 18 }}></i>
              ) : (
                <i className="ph ph-moon" style={{ fontSize: 18 }}></i>
              )}
            </button>

            <div className="notifications-wrapper" ref={notificationsRef}>
              <button
                className="topbar-btn notifications-btn"
                title="Notificações"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowSettings(false);
                }}
              >
                <i className="ph ph-bell"></i>
                {unreadCount > 0 && <span className="notifications-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
            </div>

            <div className="settings-wrapper" ref={settingsRef}>
              <button
                className="topbar-btn settings-btn"
                title="Configurações"
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowNotifications(false);
                }}
              >
                <i className="ph ph-gear"></i>
              </button>
              {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
            </div>

            {user && (
              <div className="user-menu">
                <div className="user-badge" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>
                  {user.photo ? (
                    <img src={user.photo} alt={user.name} className="user-photo" />
                  ) : (
                    <i className="ph ph-user-circle" style={{ fontSize: 24, color: 'var(--text-muted)' }}></i>
                  )}
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-role">{getRoleLabel(user.role)}</div>
                  </div>
                </div>
                <button className="logout-btn" onClick={handleLogout} title="Sair">
                  <i className="ph ph-sign-out"></i>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="layout-content">
          <section className="panel" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <Outlet context={{ refreshUser }} />
          </section>
        </main>
      </div>
    </div>
  );
}
