import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const money = (v: number) => `R$ ${Number(v).toFixed(2)}`;

function getColorForValue(value: number, thresholds: { green: number; yellow: number }): string {
  if (value <= thresholds.green) return '#10b981';
  if (value <= thresholds.yellow) return '#f59e0b';
  return '#ef4444';
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [dash, met] = await Promise.all([api.get('/dashboard'), api.get('/metrics/operational').catch(() => null)]);
      setData(dash);
      setMetrics(met);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [dash, met] = await Promise.all([
          api.get('/dashboard'),
          api.get('/metrics/operational').catch(() => null),
        ]);
        setData(dash);
        setMetrics(met);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConfirmRecurrence = async (orderId: string) => {
    setProcessingOrder(orderId);
    try {
      await api.patch(`/orders/${orderId}/recurrence`, {
        action: 'confirm',
        nextBillingDate: getNextMonthDate(),
      });
      toast.success(`Recorrência do pedido ${orderId} confirmada!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar recorrência');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handlePostponeRecurrence = async (orderId: string) => {
    setProcessingOrder(orderId);
    try {
      await api.patch(`/orders/${orderId}/recurrence`, {
        action: 'postpone',
        days: 7,
      });
      toast.success(`Recorrência do pedido ${orderId} adiada por 7 dias!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adiar recorrência');
    } finally {
      setProcessingOrder(null);
    }
  };

  const getNextMonthDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
  };

  if (loading) return <SkeletonBlock />;
  if (!data) return <div className="empty">Erro ao carregar dashboard.</div>;

  const ind = data.indicators || {};
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];

  const callFailures = 0; // verde (0 é verde)
  const emailFailures = 8; // vermelho (>5)
  const eligibilityBlocks = 1; // verde (0-0 verde, >0 amarelo)
  const dialerLatency = 80; // verde (<100)
  const emailLatency = 350; // amarelo (100-500)
  const shippingLatency = 600; // vermelho (>500)
  const ordersProcessed = 45; // verde (<50 verde, >50 amarelo)

  return (
    <>
      <div className="dashboard-header">
        <h2>Dashboard Operacional</h2>
        <p className="dashboard-subtitle">Visão geral das operações do sistema</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="kpis-grid">
            <KPI
              value={ind.pedidos}
              label="Pedidos"
              icon="ph ph-shopping-cart"
              gradient="linear-gradient(135deg, #0ea5e9, #0284c7)"
            />
            <KPI
              value={ind.entregasPendentes}
              label="Entregas pendentes"
              icon="ph ph-truck"
              gradient="linear-gradient(135deg, #f59e0b, #d97706)"
              alert={ind.entregasPendentes > 10}
            />
            <KPI
              value={ind.estoqueCritico}
              label="Estoque crítico"
              icon="ph ph-warning-circle"
              gradient="linear-gradient(135deg, #ef4444, #dc2626)"
              status={ind.estoqueCritico > 5 ? 'attention' : 'normal'}
            />
            <KPI
              value={ind.lotesProximosVencimento}
              label="Lotes prox. vencimento"
              icon="ph ph-clock-countdown"
              gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)"
            />
            <KPI
              value={money(ind.totalSales || 0)}
              label="Total vendido"
              icon="ph ph-currency-dollar"
              gradient="linear-gradient(135deg, #10b981, #059669)"
            />
          </div>

          <div className="operational-metrics">
            <h3>Métricas Operacionais</h3>
            {metrics ? (
              <div className="metrics-list">
                <div className="metric-item">
                  <div
                    className="metric-icon"
                    style={{ color: getColorForValue(callFailures, { green: 0, yellow: 5 }) }}
                  >
                    <i className="ph ph-x-circle"></i>
                  </div>
                  <div className="metric-details">
                    <div className="metric-label">Falhas de contato (Ligação)</div>
                    <div
                      className="metric-value"
                      style={{ color: getColorForValue(callFailures, { green: 0, yellow: 5 }) }}
                    >
                      {callFailures}
                    </div>
                  </div>
                </div>

                <div className="metric-item">
                  <div
                    className="metric-icon"
                    style={{ color: getColorForValue(emailFailures, { green: 0, yellow: 5 }) }}
                  >
                    <i className="ph ph-x-circle"></i>
                  </div>
                  <div className="metric-details">
                    <div className="metric-label">Falhas de contato (Email)</div>
                    <div
                      className="metric-value"
                      style={{ color: getColorForValue(emailFailures, { green: 0, yellow: 5 }) }}
                    >
                      {emailFailures}
                    </div>
                  </div>
                </div>

                <div className="metric-item">
                  <div
                    className="metric-icon"
                    style={{ color: getColorForValue(eligibilityBlocks, { green: 0, yellow: 3 }) }}
                  >
                    <i className="ph ph-x-circle"></i>
                  </div>
                  <div className="metric-details">
                    <div className="metric-label">Bloqueios por competência</div>
                    <div
                      className="metric-value"
                      style={{ color: getColorForValue(eligibilityBlocks, { green: 0, yellow: 3 }) }}
                    >
                      {eligibilityBlocks}
                    </div>
                  </div>
                </div>

                <div className="metric-item">
                  <div
                    className="metric-icon"
                    style={{ color: getColorForValue(dialerLatency, { green: 100, yellow: 500 }) }}
                  >
                    <i className="ph ph-clock"></i>
                  </div>
                  <div className="metric-details">
                    <div className="metric-label">Latência média (Discador)</div>
                    <div
                      className="metric-value"
                      style={{ color: getColorForValue(dialerLatency, { green: 100, yellow: 500 }) }}
                    >
                      {dialerLatency}ms
                    </div>
                  </div>
                </div>

                <div className="metric-item">
                  <div
                    className="metric-icon"
                    style={{ color: getColorForValue(emailLatency, { green: 100, yellow: 500 }) }}
                  >
                    <i className="ph ph-clock"></i>
                  </div>
                  <div className="metric-details">
                    <div className="metric-label">Latência média (Email)</div>
                    <div
                      className="metric-value"
                      style={{ color: getColorForValue(emailLatency, { green: 100, yellow: 500 }) }}
                    >
                      {emailLatency}ms
                    </div>
                  </div>
                </div>

                <div className="metric-item">
                  <div
                    className="metric-icon"
                    style={{ color: getColorForValue(ordersProcessed, { green: 50, yellow: 100 }) }}
                  >
                    <i className="ph ph-check-circle"></i>
                  </div>
                  <div className="metric-details">
                    <div className="metric-label">Pedidos processados</div>
                    <div
                      className="metric-value"
                      style={{ color: getColorForValue(ordersProcessed, { green: 50, yellow: 100 }) }}
                    >
                      {ordersProcessed}
                    </div>
                  </div>
                </div>

                <div className="metric-item">
                  <div
                    className="metric-icon"
                    style={{ color: getColorForValue(shippingLatency, { green: 100, yellow: 500 }) }}
                  >
                    <i className="ph ph-truck"></i>
                  </div>
                  <div className="metric-details">
                    <div className="metric-label">Latência média (Frete)</div>
                    <div
                      className="metric-value"
                      style={{ color: getColorForValue(shippingLatency, { green: 100, yellow: 500 }) }}
                    >
                      {shippingLatency}ms
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty">Métricas indisponíveis para este perfil.</div>
            )}
          </div>

          <div className="metrics-legend">
            <h4>Legenda de cores:</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#10b981' }}></span>
                <span>Normal (verde)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#f59e0b' }}></span>
                <span>Atenção (amarelo)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#ef4444' }}></span>
                <span>Crítico (vermelho)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-sidebar">
          <div className="recurrence-reminders">
            <div className="reminders-header">
              <h3>
                <i className="ph ph-repeat"></i> Lembretes de Recorrência
              </h3>
              <span className="reminder-badge">{reminders.length}</span>
            </div>

            {reminders.length ? (
              <div className="reminders-list">
                {reminders.map((r: any) => {
                  const daysUntil = r.nextBillingDate
                    ? Math.ceil((new Date(r.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  const urgencyClass =
                    daysUntil !== null && daysUntil <= 1
                      ? 'urgent'
                      : daysUntil !== null && daysUntil <= 2
                        ? 'soon'
                        : '';

                  return (
                    <div key={r.orderId} className={`reminder-item ${urgencyClass}`}>
                      <div className="reminder-icon">
                        <i className="ph ph-calendar-check"></i>
                      </div>
                      <div className="reminder-content">
                        <div className="reminder-header">
                          <strong>{r.orderId}</strong>
                          {daysUntil !== null && (
                            <span className={`reminder-days ${urgencyClass}`}>
                              {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`}
                            </span>
                          )}
                        </div>
                        <div className="reminder-patient">
                          <i className="ph ph-user"></i> {r.patientName}
                        </div>
                        <div className="reminder-details">
                          <i className="ph ph-info"></i> {r.message}
                        </div>
                        {r.estimatedTreatmentEndDate && (
                          <div className="reminder-end">
                            <i className="ph ph-clock"></i> Término:{' '}
                            {new Date(r.estimatedTreatmentEndDate).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                        <div className="reminder-actions">
                          <button
                            className="reminder-btn confirm"
                            onClick={() => handleConfirmRecurrence(r.orderId)}
                            disabled={processingOrder === r.orderId}
                          >
                            {processingOrder === r.orderId ? (
                              <i className="ph ph-spinner"></i>
                            ) : (
                              <i className="ph ph-check"></i>
                            )}{' '}
                            Confirmar
                          </button>
                          <button
                            className="reminder-btn postpone"
                            onClick={() => handlePostponeRecurrence(r.orderId)}
                            disabled={processingOrder === r.orderId}
                          >
                            <i className="ph ph-clock"></i> Adiar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-reminders">
                <i className="ph ph-check-circle"></i>
                <p>Todas as recorrências estão em dia!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function KPI({
  value,
  label,
  icon,
  gradient,
  alert = false,
  status = 'normal',
}: {
  value: any;
  label: string;
  icon: string;
  gradient: string;
  alert?: boolean;
  status?: 'normal' | 'attention' | 'critical';
}) {
  let statusClass = '';
  if (status === 'attention') statusClass = 'status-attention';
  if (status === 'critical') statusClass = 'status-critical';

  return (
    <div className={`kpi-card ${alert ? 'kpi-alert' : ''} ${statusClass}`} style={{ background: gradient }}>
      <div className="kpi-header">
        <i className={icon} style={{ fontSize: '24px', color: 'white' }}></i>
        <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {label}
        </div>
      </div>
      <div className="kpi-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
        {value ?? 0}
      </div>
      <div className="kpi-progress">
        <div className="progress-bar">
          <div className="progress-fill"></div>
        </div>
      </div>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="card"
          style={{
            height: 60,
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: 'var(--radius-md)',
          }}
        />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
