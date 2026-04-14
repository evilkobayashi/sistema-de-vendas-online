import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

type Delivery = {
  orderId: string;
  patientName: string;
  status: 'pendente' | 'em_rota' | 'entregue' | 'falhou';
  forecastDate: string;
  carrier: string;
  trackingCode?: string;
  shippingProvider?: string;
  syncStatus?: string;
};

export default function Entregas() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editForm, setEditForm] = useState({
    status: 'pendente' as Delivery['status'],
    carrier: '',
    trackingCode: '',
    forecastDate: '',
  });

  const loadDeliveries = () => {
    api
      .get('/deliveries?page=1&pageSize=50')
      .then((d: any) => {
        setDeliveries(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => toast.error('Erro ao carregar entregas'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  const handleEdit = (delivery: Delivery) => {
    setEditingDelivery(delivery);
    setEditForm({
      status: delivery.status,
      carrier: delivery.carrier || '',
      trackingCode: delivery.trackingCode || '',
      forecastDate: delivery.forecastDate || '',
    });
  };

  const handleSave = async () => {
    if (!editingDelivery) return;
    try {
      await api.patch(`/deliveries/${editingDelivery.orderId}`, {
        status: editForm.status,
        carrier: editForm.carrier || undefined,
        trackingCode: editForm.trackingCode || undefined,
        forecastDate: editForm.forecastDate || undefined,
      });
      toast.success('Entrega atualizada!');
      setEditingDelivery(null);
      loadDeliveries();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar entrega');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'entregue':
        return { bg: 'rgba(16,185,129,0.15)', color: '#34d399', icon: '✓' };
      case 'em_rota':
        return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', icon: '↗' };
      case 'falhou':
        return { bg: 'rgba(239,68,68,0.15)', color: '#f87171', icon: '✗' };
      default:
        return { bg: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', icon: '○' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'Pendente';
      case 'em_rota':
        return 'Em rota';
      case 'entregue':
        return 'Entregue';
      case 'falhou':
        return 'Falhou';
      default:
        return status;
    }
  };

  if (loading) return <div className="empty">Carregando entregas...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Central de entregas</h2>
      </div>

      <div className="panel">
        {deliveries.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Paciente</th>
                <th>Status</th>
                <th>Transportadora</th>
                <th>Rastreio</th>
                <th>Previsão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => {
                const statusStyle = getStatusColor(d.status);
                return (
                  <tr key={d.orderId}>
                    <td>{d.orderId}</td>
                    <td>{d.patientName}</td>
                    <td>
                      <span
                        className={`status-tag ${d.status}`}
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        <span className="status-icon">{statusStyle.icon}</span>
                        {getStatusLabel(d.status)}
                      </span>
                    </td>
                    <td>{d.shippingProvider || d.carrier || '-'}</td>
                    <td>{d.trackingCode || '-'}</td>
                    <td>{d.forecastDate || '-'}</td>
                    <td>
                      <button className="quick-btn" onClick={() => handleEdit(d)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">Sem entregas.</div>
        )}
      </div>

      {editingDelivery && (
        <div className="modal-overlay" onClick={() => setEditingDelivery(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Entrega</h3>
            <p>
              <strong>Pedido:</strong> {editingDelivery.orderId}
            </p>
            <p>
              <strong>Paciente:</strong> {editingDelivery.patientName}
            </p>

            <div className="form-group">
              <label>Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Delivery['status'] }))}
              >
                <option value="pendente">Pendente</option>
                <option value="em_rota">Em Rota</option>
                <option value="entregue">Entregue</option>
                <option value="falhou">Falhou</option>
              </select>
            </div>

            <div className="form-group">
              <label>Transportadora</label>
              <input
                type="text"
                value={editForm.carrier}
                onChange={(e) => setEditForm((f) => ({ ...f, carrier: e.target.value }))}
                placeholder="Ex: Correios, Jadlog"
              />
            </div>

            <div className="form-group">
              <label>Código de Rastreio</label>
              <input
                type="text"
                value={editForm.trackingCode}
                onChange={(e) => setEditForm((f) => ({ ...f, trackingCode: e.target.value }))}
                placeholder="Código de rastreio"
              />
            </div>

            <div className="form-group">
              <label>Previsão de Entrega</label>
              <input
                type="date"
                value={editForm.forecastDate}
                onChange={(e) => setEditForm((f) => ({ ...f, forecastDate: e.target.value }))}
              />
            </div>

            <div className="inline" style={{ marginTop: 16, gap: 8 }}>
              <button className="quick-btn save-btn" onClick={handleSave}>
                Salvar
              </button>
              <button className="quick-btn cancel-btn" onClick={() => setEditingDelivery(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
