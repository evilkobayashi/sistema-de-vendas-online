import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

type Recurrence = {
  orderId: string;
  patientName: string;
  medicineName: string;
  nextBillingDate: string;
  discountPercent: number;
  status: 'pendente' | 'confirmado' | 'adiado' | 'cancelado';
  lastConfirmationAt?: string;
  needsConfirmation: boolean;
};

export default function Recorrencias() {
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pendente' | 'confirmado' | 'adiado' | 'cancelado'>('all');
  const [selectedRecurrence, setSelectedRecurrence] = useState<Recurrence | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadRecurrences();
  }, []);

  const loadRecurrences = async () => {
    setLoading(true);
    try {
      const data: any = await api.get('/orders?recurring=true');
      const orders = Array.isArray(data.items) ? data.items : [];

      const recList: Recurrence[] = orders
        .filter((o: any) => o.recurring)
        .map((o: any) => ({
          orderId: o.id,
          patientName: o.patientName,
          medicineName: o.items?.[0]?.medicineName || 'N/A',
          nextBillingDate: o.recurring?.nextBillingDate || '',
          discountPercent: o.recurring?.discountPercent || 0,
          status: o.recurring?.needsConfirmation
            ? 'pendente'
            : o.recurring?.status === 'canceled'
              ? 'cancelado'
              : o.recurring?.status === 'postponed'
                ? 'adiado'
                : 'confirmado',
          lastConfirmationAt: o.recurring?.lastConfirmationAt,
          needsConfirmation: o.recurring?.needsConfirmation,
        }));

      setRecurrences(recList);
    } catch (err) {
      toast.error('Erro ao carregar recorrências');
    }
    setLoading(false);
  };

  const handleConfirm = async (orderId: string) => {
    setProcessingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/recurring/confirm`, {
        nextBillingDate: getNextMonthDate(),
      });
      toast.success('Recorrência confirmada com sucesso!');
      loadRecurrences();
      setShowDetails(false);
      setSelectedRecurrence(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar');
    }
    setProcessingId(null);
  };

  const handlePostpone = async (orderId: string, days: number = 7) => {
    setProcessingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/recurring/confirm`, {
        postponeDays: days,
      });
      toast.success(`Recorrência adiada por ${days} dias!`);
      loadRecurrences();
      setShowDetails(false);
      setSelectedRecurrence(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adiar');
    }
    setProcessingId(null);
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta recorrência?')) return;

    setProcessingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/recurring/confirm`, {
        action: 'cancel',
      });
      toast.success('Recorrência cancelada!');
      loadRecurrences();
      setShowDetails(false);
      setSelectedRecurrence(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar');
    }
    setProcessingId(null);
  };

  const handleReactivate = async (orderId: string) => {
    setProcessingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/recurring/confirm`, {
        action: 'reactivate',
      });
      toast.success('Recorrência reativada!');
      loadRecurrences();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reativar');
    }
    setProcessingId(null);
  };

  const getNextMonthDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente':
        return { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', label: 'Pendente' };
      case 'confirmado':
        return { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399', label: 'Confirmado' };
      case 'adiado':
        return { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', label: 'Adiado' };
      case 'cancelado':
        return { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171', label: 'Cancelado' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.1)', color: '#94a3b8', label: status };
    }
  };

  const filteredRecurrences = filter === 'all' ? recurrences : recurrences.filter((r) => r.status === filter);

  const stats = {
    total: recurrences.length,
    pendente: recurrences.filter((r) => r.status === 'pendente').length,
    confirmado: recurrences.filter((r) => r.status === 'confirmado').length,
    adiado: recurrences.filter((r) => r.status === 'adiado').length,
    cancelado: recurrences.filter((r) => r.status === 'cancelado').length,
  };

  const handleSelect = (rec: Recurrence) => {
    setSelectedRecurrence(rec);
    setShowDetails(true);
  };

  if (loading) return <div className="empty">Carregando recorrências...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Gestão de Recorrências</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Gerencie as compras recorrentes dos seus pacientes
        </span>
      </div>

      <div className="kpis-grid" style={{ marginBottom: 24 }}>
        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #64748b, #475569)',
            cursor: 'pointer',
            border: filter === 'all' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('all')}
        >
          <div className="kpi-header">
            <i className="ph ph-list-numbers" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Total
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.total}
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            cursor: 'pointer',
            border: filter === 'pendente' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('pendente')}
        >
          <div className="kpi-header">
            <i className="ph ph-clock" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Pendentes
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.pendente}
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            cursor: 'pointer',
            border: filter === 'confirmado' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('confirmado')}
        >
          <div className="kpi-header">
            <i className="ph ph-check-circle" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Confirmados
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.confirmado}
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            cursor: 'pointer',
            border: filter === 'adiado' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('adiado')}
        >
          <div className="kpi-header">
            <i className="ph ph-calendar" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Adiados
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.adiado}
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            cursor: 'pointer',
            border: filter === 'cancelado' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('cancelado')}
        >
          <div className="kpi-header">
            <i className="ph ph-x-circle" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Cancelados
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.cancelado}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showDetails ? '1fr 400px' : '1fr', gap: 24 }}>
        <div className="panel">
          <h3 style={{ marginBottom: 16 }}>
            <i className="ph ph-repeat"></i> Lista de Recorrências ({filteredRecurrences.length})
          </h3>

          {filteredRecurrences.length ? (
            <div className="stack">
              {filteredRecurrences.map((rec) => {
                const statusStyle = getStatusColor(rec.status);
                const isSelected = selectedRecurrence?.orderId === rec.orderId;
                const daysUntil = rec.nextBillingDate
                  ? Math.ceil((new Date(rec.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <div
                    key={rec.orderId}
                    onClick={() => handleSelect(rec)}
                    style={{
                      padding: 16,
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(13,148,136,0.15)' : 'rgba(0,0,0,0.2)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <strong style={{ fontSize: 15 }}>{rec.orderId}</strong>
                        <span
                          style={{
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                          }}
                        >
                          {statusStyle.label}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          color: 'var(--text-muted)',
                          fontSize: 13,
                        }}
                      >
                        <i className="ph ph-user"></i> {rec.patientName}
                        <span>•</span>
                        <i className="ph ph-pill"></i> {rec.medicineName}
                      </div>
                      {rec.discountPercent > 0 && (
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--accent)' }}>
                          <i className="ph ph-percent"></i> {rec.discountPercent}% de desconto
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {daysUntil !== null && daysUntil >= 0 && (
                        <div
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: 12,
                            fontWeight: 600,
                            background:
                              daysUntil <= 1
                                ? 'rgba(239, 68, 68, 0.2)'
                                : daysUntil <= 3
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : 'rgba(16, 185, 129, 0.2)',
                            color: daysUntil <= 1 ? '#f87171' : daysUntil <= 3 ? '#fbbf24' : '#34d399',
                          }}
                        >
                          {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`}
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <i className="ph ph-calendar"></i>{' '}
                        {rec.nextBillingDate ? new Date(rec.nextBillingDate).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Nenhuma recorrência encontrada.</div>
          )}
        </div>

        {showDetails && selectedRecurrence && (
          <div className="panel detail-panel" key={selectedRecurrence.orderId}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}
            >
              <div>
                <h3 style={{ margin: 0 }}>{selectedRecurrence.orderId}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{selectedRecurrence.patientName}</p>
              </div>
              <button
                className="quick-btn"
                onClick={() => {
                  setShowDetails(false);
                  setSelectedRecurrence(null);
                }}
                style={{ background: 'rgba(255,255,255,0.1)', padding: '8px' }}
              >
                <i className="ph ph-x"></i>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div className="info-card">
                <label>
                  <i className="ph ph-pill"></i> Medicamento
                </label>
                <span>{selectedRecurrence.medicineName}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-percent"></i> Desconto
                </label>
                <span>{selectedRecurrence.discountPercent}%</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-calendar"></i> Próxima Cobrança
                </label>
                <span>
                  {selectedRecurrence.nextBillingDate
                    ? new Date(selectedRecurrence.nextBillingDate).toLocaleDateString('pt-BR')
                    : '-'}
                </span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-flag"></i> Status
                </label>
                <span style={{ color: getStatusColor(selectedRecurrence.status).color }}>
                  {getStatusColor(selectedRecurrence.status).label}
                </span>
              </div>
            </div>

            <h4 style={{ marginBottom: 12 }}>Ações</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRecurrence.status === 'pendente' && (
                <button
                  className="quick-btn save-btn"
                  onClick={() => handleConfirm(selectedRecurrence.orderId)}
                  disabled={processingId === selectedRecurrence.orderId}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <i className="ph ph-check"></i> Confirmar Recorrência
                </button>
              )}

              {(selectedRecurrence.status === 'pendente' || selectedRecurrence.status === 'confirmado') && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="quick-btn"
                    onClick={() => handlePostpone(selectedRecurrence.orderId, 7)}
                    disabled={processingId === selectedRecurrence.orderId}
                    style={{ flex: 1, background: 'rgba(59, 130, 246, 0.3)' }}
                  >
                    <i className="ph ph-calendar"></i> +7 dias
                  </button>
                  <button
                    className="quick-btn"
                    onClick={() => handlePostpone(selectedRecurrence.orderId, 15)}
                    disabled={processingId === selectedRecurrence.orderId}
                    style={{ flex: 1, background: 'rgba(59, 130, 246, 0.3)' }}
                  >
                    <i className="ph ph-calendar"></i> +15 dias
                  </button>
                </div>
              )}

              {(selectedRecurrence.status === 'pendente' ||
                selectedRecurrence.status === 'confirmado' ||
                selectedRecurrence.status === 'adiado') && (
                <button
                  className="quick-btn cancel-btn"
                  onClick={() => handleCancel(selectedRecurrence.orderId)}
                  disabled={processingId === selectedRecurrence.orderId}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <i className="ph ph-x"></i> Cancelar Recorrência
                </button>
              )}

              {selectedRecurrence.status === 'cancelado' && (
                <button
                  className="quick-btn save-btn"
                  onClick={() => handleReactivate(selectedRecurrence.orderId)}
                  disabled={processingId === selectedRecurrence.orderId}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <i className="ph ph-arrow-counter-clockwise"></i> Reativar Recorrência
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
