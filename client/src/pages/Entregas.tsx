import { useEffect, useState } from 'react';
import api from '../api';

export default function Entregas() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/deliveries?page=1&pageSize=50').then((d: any) => {
      setDeliveries(Array.isArray(d.items) ? d.items : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Carregando entregas...</div>;

  return (
    <>
      <h2>Central de entregas</h2>
      {deliveries.length ? (
        <table className="table">
          <thead><tr><th>Pedido</th><th>Paciente</th><th>Status</th><th>Transportadora</th><th>Rastreio</th><th>Sync</th></tr></thead>
          <tbody>
            {deliveries.map(d => (
              <tr key={d.orderId}>
                <td>{d.orderId}</td>
                <td>{d.patientName}</td>
                <td>
                  <span className="tag" style={{
                    background: d.status === 'entregue' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.1)',
                    color: d.status === 'entregue' ? '#34d399' : 'var(--text-main)'
                  }}>{d.status}</span>
                </td>
                <td>{d.shippingProvider || d.carrier || '-'}</td>
                <td>{d.trackingCode || '-'}</td>
                <td>{d.syncStatus || 'ok'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="empty">Sem entregas.</div>}
    </>
  );
}
