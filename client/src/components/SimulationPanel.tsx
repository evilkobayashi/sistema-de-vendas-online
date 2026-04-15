import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

type SimulatedAction = {
  id: string;
  type: 'order' | 'ticket' | 'delivery' | 'customer';
  description: string;
  timestamp: string;
  user: string;
};

type SimulationState = {
  enabled: boolean;
  speed: number;
  actionsPerMinute: number;
  startTime: string;
  actions: SimulatedAction[];
  stats: {
    ordersCreated: number;
    ticketsCreated: number;
    deliveriesUpdated: number;
    customersCreated: number;
  };
};

export default function SimulationPanel() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [actionsPerMinute, setActionsPerMinute] = useState(3);

  useEffect(() => {
    loadState();

    const interval = setInterval(() => {
      if (state?.enabled) {
        loadState();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [state?.enabled]);

  const loadState = async () => {
    try {
      const data: any = await api.get('/simulation/status');
      setState(data);
      setSpeed(data.speed);
      setActionsPerMinute(data.actionsPerMinute);
    } catch {
      console.error('Erro ao carregar estado da simulação');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setRefreshing(true);
    try {
      if (state?.enabled) {
        await api.post('/simulation/stop');
        toast.success('Simulação pausada');
      } else {
        await api.post('/simulation/start');
        toast.success('Simulação iniciada!');
      }
      loadState();
    } catch {
      toast.error('Erro ao controlar simulação');
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfigChange = async () => {
    try {
      await api.patch('/simulation/config', { speed, actionsPerMinute });
      toast.success('Configuração atualizada');
      loadState();
    } catch {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.delete('/simulation/history');
      toast.success('Histórico limpo');
      loadState();
    } catch {
      toast.error('Erro ao limpar histórico');
    }
  };

  const handleAddAction = async (type: string) => {
    const descriptions: Record<string, string> = {
      order: 'Criou pedido - Rivotril 2mg (controlado)',
      ticket: 'Novo ticket: Dúvida sobre dosagem',
      delivery: 'Atualizou entrega - Status: em_rota',
      customer: 'Cadastrou novo cliente: Carlos Silva',
    };

    try {
      await api.post('/simulation/action', {
        type,
        description: descriptions[type],
        user: 'Olivia Operadora',
      });
      loadState();
    } catch {
      toast.error('Erro ao adicionar ação');
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'order':
        return 'ph-receipt';
      case 'ticket':
        return 'ph-ticket';
      case 'delivery':
        return 'ph-truck';
      case 'customer':
        return 'ph-user-plus';
      default:
        return 'ph-activity';
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'order':
        return '#10b981';
      case 'ticket':
        return '#f59e0b';
      case 'delivery':
        return '#3b82f6';
      case 'customer':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR');
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando simulação...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          background: state?.enabled
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, #6b7280, #4b5563)',
          borderRadius: 12,
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className={`ph ${state?.enabled ? 'ph-play-circle' : 'ph-pause-circle'}`} style={{ fontSize: 24 }}></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Simulador de Operações</h3>
            <p style={{ margin: 0, opacity: 0.8, fontSize: 13 }}>
              {state?.enabled ? `Rodando há ${formatTime(state.startTime)}` : 'Pausado'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={refreshing}
          style={{
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: 10,
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <i className={`ph ${state?.enabled ? 'ph-pause' : 'ph-play'}`}></i>
          {state?.enabled ? 'Pausar' : 'Iniciar'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="info-card" style={{ textAlign: 'center' }}>
          <i className="ph ph-receipt" style={{ fontSize: 24, color: '#10b981' }}></i>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{state?.stats.ordersCreated || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pedidos</div>
        </div>
        <div className="info-card" style={{ textAlign: 'center' }}>
          <i className="ph ph-ticket" style={{ fontSize: 24, color: '#f59e0b' }}></i>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{state?.stats.ticketsCreated || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tickets</div>
        </div>
        <div className="info-card" style={{ textAlign: 'center' }}>
          <i className="ph ph-truck" style={{ fontSize: 24, color: '#3b82f6' }}></i>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{state?.stats.deliveriesUpdated || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entregas</div>
        </div>
        <div className="info-card" style={{ textAlign: 'center' }}>
          <i className="ph ph-user-plus" style={{ fontSize: 24, color: '#8b5cf6' }}></i>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>{state?.stats.customersCreated || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clientes</div>
        </div>
      </div>

      {/* Config */}
      <div className="panel">
        <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ph ph-gear"></i> Configurações
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Velocidade
            </label>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-light)',
                borderRadius: 8,
                color: 'var(--text-main)',
              }}
            >
              <option value={0.5}>0.5x (Lento)</option>
              <option value={1}>1x (Normal)</option>
              <option value={2}>2x (Rápido)</option>
              <option value={5}>5x (Muito Rápido)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Ações/minuto
            </label>
            <select
              value={actionsPerMinute}
              onChange={(e) => setActionsPerMinute(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-light)',
                borderRadius: 8,
                color: 'var(--text-main)',
              }}
            >
              <option value={1}>1 ação/min</option>
              <option value={3}>3 ações/min</option>
              <option value={6}>6 ações/min</option>
              <option value={12}>12 ações/min</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleConfigChange} className="quick-btn save-btn" style={{ flex: 1 }}>
              <i className="ph ph-check"></i> Aplicar
            </button>
            <button
              onClick={handleClearHistory}
              className="quick-btn"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
            >
              <i className="ph ph-trash"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="panel">
        <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ph ph-lightning"></i> Ações Rápidas
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={() => handleAddAction('order')}
            className="quick-btn"
            style={{ background: '#10b981', color: 'white' }}
          >
            <i className="ph ph-receipt"></i> Novo Pedido
          </button>
          <button
            onClick={() => handleAddAction('ticket')}
            className="quick-btn"
            style={{ background: '#f59e0b', color: 'white' }}
          >
            <i className="ph ph-ticket"></i> Novo Ticket
          </button>
          <button
            onClick={() => handleAddAction('delivery')}
            className="quick-btn"
            style={{ background: '#3b82f6', color: 'white' }}
          >
            <i className="ph ph-truck"></i> Atualizar Entrega
          </button>
          <button
            onClick={() => handleAddAction('customer')}
            className="quick-btn"
            style={{ background: '#8b5cf6', color: 'white' }}
          >
            <i className="ph ph-user-plus"></i> Novo Cliente
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="panel">
        <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ph ph-activity"></i> Feed de Atividades
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {state?.actions.length || 0} registros
          </span>
        </h4>

        {state?.actions && state.actions.length > 0 ? (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {state.actions.map((action, idx) => (
              <div
                key={action.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: idx < state.actions.length - 1 ? '1px solid var(--border-light)' : 'none',
                  animation: idx === 0 ? 'slideIn 0.3s ease' : undefined,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${getActionColor(action.type)}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <i
                    className={`ph ${getActionIcon(action.type)}`}
                    style={{ color: getActionColor(action.type), fontSize: 16 }}
                  ></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, marginBottom: 2 }}>{action.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {action.user} • {formatTime(action.timestamp)}
                  </div>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: `${getActionColor(action.type)}20`,
                    color: getActionColor(action.type),
                  }}
                >
                  {action.type}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <i className="ph ph-activity" style={{ fontSize: 48, opacity: 0.3 }}></i>
            <p style={{ marginTop: 12 }}>Nenhuma atividade registrada</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
