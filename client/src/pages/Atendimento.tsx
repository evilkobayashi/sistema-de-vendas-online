import { useEffect, useState } from 'react';
import api from '../api';

export default function Atendimento() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
    api.get(`/tickets/${user.id}`).then((d: any) => {
      setTickets(Array.isArray(d.items) ? d.items : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Carregando tickets...</div>;

  return (
    <>
      <h2>Atendimento</h2>
      {tickets.length ? (
        <div className="stack">
          {tickets.map((t, i) => (
            <div key={i} className="card">
              <strong>{t.subject}</strong>
              <p style={{ color: 'var(--text-muted)' }}>Status: {t.status}</p>
            </div>
          ))}
        </div>
      ) : <div className="empty">Sem tickets.</div>}
    </>
  );
}
