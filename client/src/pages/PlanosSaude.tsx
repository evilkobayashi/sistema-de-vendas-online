import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function PlanosSaude() {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/health-plans').then((d: any) => { setPlans(Array.isArray(d.items) ? d.items : []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    const data: any = await api.post('/health-plans', payload);
    toast.success('Plano cadastrado!');
    setPlans(prev => [data.item, ...prev]);
    setSelectedId(data.item.id);
    e.currentTarget.reset();
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    await api.patch(`/health-plans/${selectedId}`, payload);
    toast.success('Plano atualizado!');
    load();
  };

  const selected = plans.find(x => x.id === selectedId);

  if (loading) return <div className="empty">Carregando planos...</div>;

  return (
    <>
      <h2>Planos de saúde</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>Cadastro de plano</h3>
          <form onSubmit={handleCreate} className="grid-form">
            <input name="name" placeholder="Nome do plano" required />
            <input name="providerName" placeholder="Operadora" required />
            <input name="registrationCode" placeholder="Código registro" required />
            <button type="submit">Salvar plano</button>
          </form>
          <h3 style={{ marginTop: 16 }}>Lista</h3>
          {plans.length ? (
            <div className="stack">
              {plans.map(x => (
                <button key={x.id} className="quick-btn" onClick={() => setSelectedId(x.id)} style={x.id === selectedId ? { borderColor: 'var(--primary)', background: 'rgba(13,148,136,0.1)' } : {}}>
                  {x.name} • {x.providerName}
                </button>
              ))}
            </div>
          ) : <div className="empty">Nenhum plano.</div>}
        </div>
        <div>
          <h3>Editar plano</h3>
          {selected ? (
            <form onSubmit={handleEdit} className="grid-form" key={selected.id}>
              <input name="name" defaultValue={selected.name} required />
              <input name="providerName" defaultValue={selected.providerName} required />
              <input name="registrationCode" defaultValue={selected.registrationCode} required />
              <button type="submit">Salvar alterações</button>
            </form>
          ) : <div className="empty">Selecione um plano para editar.</div>}
        </div>
      </div>
    </>
  );
}
