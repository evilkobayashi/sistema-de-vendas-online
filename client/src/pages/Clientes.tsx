import { useEffect, useState } from 'react';
import api from '../api';

type Customer = {
  id: string;
  name: string;
  patientCode: string;
  insuranceCardCode: string;
  healthPlanId: string;
  doctorId: string;
  diseaseCid: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: string;
};

type Activity = {
  id: string;
  activityType: string;
  description: string;
  createdAt: string;
  performedBy: string;
};

export default function Clientes() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [healthPlans, setHealthPlans] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAll = async () => {
    try {
      const [c, h, d] = (await Promise.all([
        api.get('/customers'),
        api.get('/health-plans'),
        api.get('/doctors'),
      ])) as any[];
      setCustomers(Array.isArray(c.items) ? c.items : Array.isArray(c) ? c : []);
      setHealthPlans(Array.isArray(h.items) ? h.items : Array.isArray(h) ? h : []);
      setDoctors(Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSelect = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const data: any = await api.get(`/patients/${customer.id}/activities?page=1&pageSize=20`);
      setActivities(Array.isArray(data.items) ? data.items : []);
    } catch {
      setActivities([]);
    }
  };

  const getHealthPlanName = (id: string) => healthPlans.find((p) => p.id === id)?.name || 'Não informado';
  const getDoctorName = (id: string) => doctors.find((d) => d.id === id)?.name || 'Não informado';

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patientCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActivityIcon = (type: string) => {
    if (type.includes('created')) return '🆕';
    if (type.includes('updated')) return '✏️';
    if (type.includes('delivery')) return '📦';
    if (type.includes('contact')) return '📞';
    if (type.includes('order')) return '🛒';
    return '📋';
  };

  if (loading) return <div className="empty">Carregando pacientes...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Pacientes Cadastrados</h2>
        <div className="search-box">
          <i className="ph ph-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Buscar por nome, código ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => setSearchTerm('')}>
              <i className="ph ph-x"></i>
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer ? '350px 1fr' : '1fr', gap: 24 }}>
        <div className="panel">
          <h3 style={{ marginBottom: 16 }}>
            <i className="ph ph-users"></i> Lista de Pacientes ({filteredCustomers.length})
          </h3>
          {filteredCustomers.length ? (
            <div className="stack">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    background: selectedCustomer?.id === c.id ? 'rgba(13,148,136,0.15)' : 'rgba(0,0,0,0.2)',
                    border:
                      selectedCustomer?.id === c.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 18,
                      }}
                    >
                      {c.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {c.patientCode || 'Sem código'} • {c.phone}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nenhum paciente encontrado.</div>
          )}
        </div>

        {selectedCustomer && (
          <div className="panel detail-panel" key={selectedCustomer.id}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 28,
                  }}
                >
                  {selectedCustomer.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedCustomer.name}</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                    {selectedCustomer.patientCode && `Cód: ${selectedCustomer.patientCode}`}
                  </p>
                </div>
              </div>
              <span className="tag" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                Ativo
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div className="info-card">
                <label>
                  <i className="ph ph-envelope"></i> E-mail
                </label>
                <span>{selectedCustomer.email}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-phone"></i> Telefone
                </label>
                <span>{selectedCustomer.phone}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-credit-card"></i> Carteirinha
                </label>
                <span>{selectedCustomer.insuranceCardCode || 'Não informada'}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-first-aid-kit"></i> Plano de Saúde
                </label>
                <span>{getHealthPlanName(selectedCustomer.healthPlanId)}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-stethoscope"></i> Médico
                </label>
                <span>{getDoctorName(selectedCustomer.doctorId)}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-file-text"></i> CID
                </label>
                <span>{selectedCustomer.diseaseCid || 'Não informado'}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <i className="ph ph-map-pin"></i> Endereço
              </label>
              <p style={{ margin: 0, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                {selectedCustomer.address}
              </p>
            </div>

            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <i className="ph ph-clock-counter-clockwise"></i> Histórico de Atividades
            </h4>
            {activities.length ? (
              <div className="stack">
                {activities.map((a, i) => (
                  <div key={i} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20 }}>{getActivityIcon(a.activityType)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.description}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(a.createdAt).toLocaleString('pt-BR')} • {a.performedBy}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">Sem atividades registradas.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
