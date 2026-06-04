import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

type HealthPlan = {
  id: string;
  name: string;
  providerName: string;
  registrationCode: string;
  createdAt?: string;
};

export default function PlanosSaude() {
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<HealthPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    providerName: '',
    registrationCode: '',
  });

  const load = () => {
    setLoading(true);
    api
      .get('/health-plans')
      .then((d: any) => {
        setPlans(Array.isArray(d.items) ? d.items : []);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Erro ao carregar planos');
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = await api.post('/health-plans', formData);
      toast.success('Plano cadastrado!');
      setPlans((prev) => [data.item, ...prev]);
      setSelectedPlan(data.item);
      setShowForm(false);
      setFormData({ name: '', providerName: '', registrationCode: '' });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar');
    }
  };

  const filteredPlans = plans.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.registrationCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      amil: '#e53935',
      unimed: '#1e88e5',
      bradesco: '#ff9800',
      sulamerica: '#43a047',
      hapvida: '#7b1fa2',
      notredame: '#00acc1',
      default: '#64748b',
    };
    const key = provider.toLowerCase();
    for (const k of Object.keys(colors)) {
      if (key.includes(k)) return colors[k];
    }
    return colors.default;
  };

  if (loading) return <div className="empty">Carregando planos...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Planos de Saúde</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="search-box">
            <i className="ph ph-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Buscar por nome, operadora ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>
                <i className="ph ph-x"></i>
              </button>
            )}
          </div>
          <button className="quick-btn" onClick={() => setShowForm(!showForm)} style={{ background: 'var(--primary)' }}>
            <i className="ph ph-plus"></i> Novo Plano
          </button>
        </div>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h3>
            <i className="ph ph-plus-circle"></i> Cadastrar Novo Plano
          </h3>
          <form
            onSubmit={handleCreate}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}
          >
            <input
              name="name"
              placeholder="Nome do plano"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <input
              name="providerName"
              placeholder="Operadora"
              value={formData.providerName}
              onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
              required
            />
            <input
              name="registrationCode"
              placeholder="Código de registro"
              value={formData.registrationCode}
              onChange={(e) => setFormData({ ...formData, registrationCode: e.target.value })}
              required
            />
            <button type="submit" className="save-btn" style={{ justifySelf: 'start' }}>
              <i className="ph ph-check"></i> Salvar
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedPlan ? '350px 1fr' : '1fr', gap: 24 }}>
        <div className="panel">
          <h3 style={{ marginBottom: 16 }}>
            <i className="ph ph-heart"></i> Planos de Saúde ({filteredPlans.length})
          </h3>
          {filteredPlans.length ? (
            <div className="stack">
              {filteredPlans.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    background: selectedPlan?.id === p.id ? 'rgba(13,148,136,0.15)' : 'rgba(0,0,0,0.2)',
                    border: selectedPlan?.id === p.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 'var(--radius-md)',
                        background: getProviderColor(p.providerName),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 20,
                      }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{p.providerName}</div>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: `${getProviderColor(p.providerName)}20`,
                          color: getProviderColor(p.providerName),
                        }}
                      >
                        {p.registrationCode}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nenhum plano encontrado.</div>
          )}
        </div>

        {selectedPlan && (
          <div className="panel detail-panel" key={selectedPlan.id}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 'var(--radius-lg)',
                    background: getProviderColor(selectedPlan.providerName),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 32,
                  }}
                >
                  {selectedPlan.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedPlan.name}</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{selectedPlan.providerName}</p>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      fontSize: 13,
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: `${getProviderColor(selectedPlan.providerName)}20`,
                      color: getProviderColor(selectedPlan.providerName),
                      fontWeight: 600,
                    }}
                  >
                    {selectedPlan.registrationCode}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              <div className="info-card">
                <label>
                  <i className="ph ph-identification-card"></i> Nome do Plano
                </label>
                <span>{selectedPlan.name}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-buildings"></i> Operadora
                </label>
                <span>{selectedPlan.providerName}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-barcode"></i> Código de Registro
                </label>
                <span>{selectedPlan.registrationCode}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-calendar"></i> Data de Cadastro
                </label>
                <span>
                  {selectedPlan.createdAt ? new Date(selectedPlan.createdAt).toLocaleDateString('pt-BR') : '-'}
                </span>
              </div>
            </div>

            <div
              style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}
            >
              <h4 style={{ marginBottom: 12 }}>
                <i className="ph ph-info"></i> Informações
              </h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
                Este plano de saúde está cadastrado no sistema 4Bio e pode ser associado aos pacientes. Caso precise
                atualizar as informações, utilize o formulário de edição.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
