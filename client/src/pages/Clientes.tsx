import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Clientes() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activities, setActivities] = useState<any[]>([]);
  const [healthPlans, setHealthPlans] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const [c, h, d] = await Promise.all([
      api.get('/patients').catch(() => api.get('/customers')),
      api.get('/health-plans'),
      api.get('/doctors'),
    ]) as any[];
    setCustomers(Array.isArray(c.items) ? c.items : []);
    setHealthPlans(Array.isArray(h.items) ? h.items : []);
    setDoctors(Array.isArray(d.items) ? d.items : []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    try {
      const data: any = await api.get(`/patients/${id}/activities?page=1&pageSize=20`);
      setActivities(Array.isArray(data.items) ? data.items : []);
    } catch { setActivities([]); }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await api.patch(`/patients/${selectedId}`, payload);
      toast.success('Paciente atualizado!');
      loadAll();
    } catch {}
  };

  const selected = customers.find(c => c.id === selectedId);

  if (loading) return <div className="empty">Carregando pacientes...</div>;

  return (
    <>
      <h2>Pacientes cadastrados</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>Menu de pacientes</h3>
          {customers.length ? (
            <div className="stack">
              {customers.map(c => (
                <button key={c.id} className={`quick-btn${c.id === selectedId ? ' active' : ''}`} onClick={() => handleSelect(c.id)} style={c.id === selectedId ? { borderColor: 'var(--primary)', background: 'rgba(13,148,136,0.1)' } : {}}>
                  {c.name} • {c.patientCode || 'sem código'}
                </button>
              ))}
            </div>
          ) : <div className="empty">Nenhum paciente cadastrado.</div>}
        </div>
        <div>
          <h3>Dados do paciente</h3>
          {selected ? (
            <>
              <form onSubmit={handleEdit} className="grid-form">
                <input name="name" defaultValue={selected.name} required />
                <input name="patientCode" defaultValue={selected.patientCode || ''} placeholder="Código" required />
                <input name="insuranceCardCode" defaultValue={selected.insuranceCardCode || ''} placeholder="Carteirinha" required />
                <select name="healthPlanId" defaultValue={selected.healthPlanId}>
                  {healthPlans.map(p => <option key={p.id} value={p.id}>{p.name} • {p.providerName}</option>)}
                </select>
                <select name="doctorId" defaultValue={selected.doctorId}>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name} • CRM {d.crm}</option>)}
                </select>
                <input name="diseaseCid" defaultValue={selected.diseaseCid || ''} placeholder="CID" required />
                <input name="email" type="email" defaultValue={selected.email} required />
                <input name="phone" defaultValue={selected.phone} required />
                <input name="address" defaultValue={selected.address} required />
                <button type="submit">Salvar alterações</button>
              </form>
              <small style={{ color: 'var(--text-muted)' }}>ID: {selected.id}</small>

              <h4 style={{ marginTop: 16 }}>Histórico de ações</h4>
              {activities.length ? (
                <div className="stack">
                  {activities.map((a, i) => (
                    <div key={i} className="card">
                      <strong>{a.activityType}</strong><br/>
                      {a.description}<br/>
                      <small style={{ color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleString()} • {a.performedBy}</small>
                    </div>
                  ))}
                </div>
              ) : <div className="empty">Sem atividades registradas.</div>}
            </>
          ) : <div className="empty">Selecione um paciente no menu.</div>}
        </div>
      </div>
    </>
  );
}
