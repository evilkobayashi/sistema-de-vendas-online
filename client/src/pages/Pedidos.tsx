import { useEffect, useState } from 'react';
import api from '../api';

const money = (v: number) => `R$ ${Number(v).toFixed(2)}`;

export default function Pedidos() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders?page=1&pageSize=50').then((d: any) => {
      setOrders(Array.isArray(d.items) ? d.items : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Carregando pedidos...</div>;

  return (
    <>
      <h2>Histórico de pedidos</h2>
      {orders.length ? (
        <table className="table">
          <thead><tr><th>Pedido</th><th>Paciente</th><th>Total</th><th>Término estimado</th><th>Criado em</th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.patientName}</td>
                <td>{money(o.total)}</td>
                <td>{o.estimatedTreatmentEndDate || '-'}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="empty">Sem pedidos.</div>}
    </>
  );
}
