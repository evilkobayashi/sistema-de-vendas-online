import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Medicos() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<'menu' | 'cadastro'>('menu');
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/doctors').then((d: any) => { setDoctors(Array.isArray(d.items) ? d.items : []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    const data: any = await api.post('/doctors', payload);
    toast.success('Médico cadastrado!');
    setDoctors(prev => [data.item, ...prev]);
    setSelectedId(data.item.id);
    setView('menu');
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    await api.patch(`/doctors/${selectedId}`, payload);
    toast.success('Médico atualizado!');
    load();
  };

  const selected = doctors.find(d => d.id === selectedId);

  if (loading) return <div className="empty">Carregando médicos...</div>;

  return (
    <>
      <h2>Médicos</h2>
      <div className="inline" style={{ marginBottom: 16 }}>
        <button className={`quick-btn${view === 'menu' ? ' active' : ''}`} onClick={() => setView('menu')} style={view === 'menu' ? { borderColor: 'var(--primary)' } : {}}>Menu de médicos</button>
        <button className={`quick-btn${view === 'cadastro' ? ' active' : ''}`} onClick={() => setView('cadastro')} style={view === 'cadastro' ? { borderColor: 'var(--primary)' } : {}}>Cadastro de médicos</button>
      </div>

      {view === 'cadastro' && (
        <form onSubmit={handleCreate} className="grid-form" style={{ marginBottom: 24 }}>
          <input name="name" placeholder="Nome do médico" required />
          <input name="crm" placeholder="CRM" required />
          <input name="specialty" placeholder="Especialidade" required />
          <input name="email" type="email" placeholder="E-mail" required />
          <input name="phone" placeholder="Telefone" required />
          <button type="submit">Cadastrar médico</button>
        </form>
      )}

      {view === 'menu' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <h3>Menu de médicos</h3>
            {doctors.length ? (
              <div className="stack">
                {doctors.map(d => (
                  <button key={d.id} className="quick-btn" onClick={() => setSelectedId(d.id)} style={d.id === selectedId ? { borderColor: 'var(--primary)', background: 'rgba(13,148,136,0.1)' } : {}}>
                    {d.name} • CRM {d.crm}
                  </button>
                ))}
              </div>
            ) : <div className="empty">Nenhum médico.</div>}
          </div>
          <div>
            <h3>Informações do médico</h3>
            {selected ? (
              <>
                <form onSubmit={handleEdit} className="grid-form" key={selected.id}>
                  <input name="name" defaultValue={selected.name} required />
                  <input name="crm" defaultValue={selected.crm} required />
                  <input name="specialty" defaultValue={selected.specialty} required />
                  <input name="email" type="email" defaultValue={selected.email} required />
                  <input name="phone" defaultValue={selected.phone} required />
                  <button type="submit">Salvar alterações</button>
                </form>
                <small style={{ color: 'var(--text-muted)' }}>ID: {selected.id}</small>
              </>
            ) : <div className="empty">Selecione um médico.</div>}
          </div>
        </div>
      )}
    </>
  );
}
