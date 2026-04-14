import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../api';

export type Notification = {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
  category?: 'order' | 'delivery' | 'inventory' | 'ticket' | 'system';
};

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  loadFromServer: () => Promise<void>;
  loadSampleNotifications: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const NOTIFICATIONS_KEY = 'app_notifications';

const sampleNotifications: Omit<Notification, 'id' | 'createdAt'>[] = [
  {
    type: 'error',
    title: 'Estoque Crítico',
    message: 'Rivotril 2mg está com apenas 3 unidades. Repor imediatamente!',
    read: false,
    category: 'inventory',
    link: '/estoque',
  },
  {
    type: 'error',
    title: 'Entrega Falhou',
    message: 'Entrega para Maria Silva falhou. Cliente não estava no endereço.',
    read: false,
    category: 'delivery',
    link: '/entregas',
  },
  {
    type: 'warning',
    title: 'Lembrete de Recorrência',
    message: 'Pedido de João Antônio Pereira precisa de confirmação para próximo mês.',
    read: false,
    category: 'order',
    link: '/recorrencias',
  },
  {
    type: 'info',
    title: 'Nova Entrega',
    message: 'Pedido P-2026-ABC12 saiu para entrega com prazo de 3 dias.',
    read: false,
    category: 'delivery',
    link: '/entregas',
  },
  {
    type: 'warning',
    title: 'Lote Próximo ao Vencimento',
    message: 'Lote ONC-2401 de OncoRelief vence em 15 dias.',
    read: false,
    category: 'inventory',
    link: '/inventario',
  },
  {
    type: 'success',
    title: 'Pedido Entregue',
    message: 'Pedido P-2026-ABC10 foi entregue com sucesso para Carlos Eduardo.',
    read: true,
    category: 'delivery',
    link: '/entregas',
  },
  {
    type: 'info',
    title: 'Novo Ticket',
    message: 'Paciente Ana Beatriz abriu ticket: "Dúvida sobre dosagem de medicamento"',
    read: true,
    category: 'ticket',
    link: '/atendimento',
  },
  {
    type: 'success',
    title: 'Orçamento Aprovado',
    message: 'Orçamento ORC-001 para paciente Pedro Santos foi aprovado.',
    read: true,
    category: 'order',
    link: '/orcamentos',
  },
  {
    type: 'warning',
    title: 'Estoque Baixo',
    message: 'NeuroSafe 5mg está com apenas 8 unidades em estoque.',
    read: true,
    category: 'inventory',
    link: '/estoque',
  },
  {
    type: 'info',
    title: 'Nova Receita Processada',
    message: 'Receita de Dr. Roberto Mendes validada com sucesso.',
    read: true,
    category: 'order',
    link: '/pedidos',
  },
];

function loadSampleNotifications(): Notification[] {
  const now = Date.now();
  const timeOffsets = [
    2 * 60 * 1000,
    15 * 60 * 1000,
    45 * 60 * 1000,
    2 * 60 * 60 * 1000,
    4 * 60 * 60 * 1000,
    6 * 60 * 60 * 1000,
    8 * 60 * 60 * 1000,
    12 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    2 * 24 * 60 * 60 * 1000,
  ];
  return sampleNotifications.map((n, i) => ({
    ...n,
    id: `sample-${i}`,
    createdAt: new Date(now - (timeOffsets[i] || i * 3600000)).toISOString(),
  }));
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      } catch {
        return [];
      }
    }
    return loadSampleNotifications();
  });

  const loadSample = () => {
    localStorage.removeItem(NOTIFICATIONS_KEY);
    setNotifications(loadSampleNotifications());
  };

  const loadFromServer = async () => {
    try {
      const data: any = await api.get('/notifications');
      if (Array.isArray(data.items)) {
        setNotifications(data.items);
      }
    } catch {
      console.log('Usando notificações locais');
    }
  };

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        loadFromServer,
        loadSampleNotifications: loadSample,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
