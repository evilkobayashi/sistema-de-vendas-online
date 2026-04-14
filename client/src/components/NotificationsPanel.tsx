import { useNotifications, type Notification } from '../contexts/NotificationsContext';
import { useNavigate } from 'react-router-dom';

type Props = {
  onClose: () => void;
};

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'success':
      return 'ph-check-circle';
    case 'warning':
      return 'ph-warning';
    case 'error':
      return 'ph-x-circle';
    default:
      return 'ph-info';
  }
}

function getNotificationColor(type: Notification['type']) {
  switch (type) {
    case 'success':
      return '#10b981';
    case 'warning':
      return '#f59e0b';
    case 'error':
      return '#ef4444';
    default:
      return '#3b82f6';
  }
}

function getCategoryIcon(category?: string) {
  switch (category) {
    case 'order':
      return 'ph-receipt';
    case 'delivery':
      return 'ph-truck';
    case 'inventory':
      return 'ph-package';
    case 'ticket':
      return 'ph-headset';
    default:
      return 'ph-bell';
  }
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return date.toLocaleDateString('pt-BR');
}

export default function NotificationsPanel({ onClose }: Props) {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    unreadCount,
    loadSampleNotifications,
  } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const groupedNotifications = notifications.reduce(
    (acc, n) => {
      const category = n.category || 'system';
      if (!acc[category]) acc[category] = [];
      acc[category].push(n);
      return acc;
    },
    {} as Record<string, Notification[]>
  );

  return (
    <div className="notifications-panel" onClick={(e) => e.stopPropagation()}>
      <div className="notifications-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3>Notificações</h3>
          {unreadCount > 0 && (
            <span className="notifications-badge" style={{ position: 'static', fontSize: 11 }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button className="notifications-action-btn" onClick={markAllAsRead}>
              <i className="ph ph-check"></i> Marcar todas como lidas
            </button>
          )}
          {notifications.length === 0 && (
            <button
              className="notifications-action-btn"
              onClick={loadSampleNotifications}
              style={{ color: 'var(--primary)' }}
            >
              <i className="ph ph-arrows-clockwise"></i> Carregar exemplos
            </button>
          )}
          {notifications.length > 0 && (
            <button className="notifications-action-btn" onClick={clearAll}>
              <i className="ph ph-trash"></i> Limpar
            </button>
          )}
          <button className="notifications-close" onClick={onClose}>
            <i className="ph ph-x"></i>
          </button>
        </div>
      </div>

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="notifications-empty">
            <i className="ph ph-bell-slash" style={{ fontSize: 48, opacity: 0.3 }}></i>
            <p>Nenhuma notificação</p>
          </div>
        ) : (
          <>
            {Object.entries(groupedNotifications).map(([category, items]) => (
              <div key={category} className="notification-category" data-category={category}>
                <div className="notification-category-header">
                  <i className={`ph ${getCategoryIcon(category)}`}></i>
                  <span>
                    {category === 'order'
                      ? 'Pedidos'
                      : category === 'delivery'
                        ? 'Entregas'
                        : category === 'inventory'
                          ? 'Estoque'
                          : category === 'ticket'
                            ? 'Atendimento'
                            : 'Sistema'}
                  </span>
                </div>
                {items.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {!notification.read && <div className="notification-dot"></div>}
                    <div className="notification-icon" style={{ color: getNotificationColor(notification.type) }}>
                      <i className={`ph ${getNotificationIcon(notification.type)}`}></i>
                    </div>
                    <div className="notification-content">
                      <div className="notification-title">{notification.title}</div>
                      <div className="notification-message">{notification.message}</div>
                      <div className="notification-time">{formatTime(notification.createdAt)}</div>
                    </div>
                    <button
                      className="notification-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotification(notification.id);
                      }}
                    >
                      <i className="ph ph-x"></i>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
