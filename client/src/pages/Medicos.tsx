import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

type Doctor = {
  id: string;
  name: string;
  crm: string;
  specialty: string;
  email: string;
  phone: string;
  createdAt?: string;
};

export default function Medicos() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    crm: '',
    specialty: '',
    email: '',
    phone: '',
  });

  const load = () =>
    api.get('/doctors').then((d: any) => {
      setDoctors(Array.isArray(d.items) ? d.items : []);
      setLoading(false);
    });

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = await api.post('/doctors', formData);
      toast.success('Médico cadastrado!');
      setDoctors((prev) => [data.item, ...prev]);
      setShowForm(false);
      setFormData({ name: '', crm: '', specialty: '', email: '', phone: '' });
      setSelectedDoctor(data.item);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar');
    }
  };

  const getSpecialtyColor = (specialty: string) => {
    const colors: Record<string, string> = {
      // Vermelho / Rosa
      Cardiologia: '#ef4444',
      Cardiologista: '#ef4444',
      Dermatologia: '#ec4899',
      Dermatologista: '#ec4899',
      Oncologia: '#dc2626',
      Oncologista: '#dc2626',
      Hematologia: '#f43f5e',
      Hematologista: '#f43f5e',
      // Roxo
      Neurologia: '#8b5cf6',
      Neurologista: '#8b5cf6',
      Psiquiatria: '#a855f7',
      Psiquiatra: '#a855f7',
      Neurocirurgia: '#7c3aed',
      Neurocirurgião: '#7c3aed',
      // Azul
      Pneumologia: '#3b82f6',
      Pneumologista: '#3b82f6',
      Nefrologia: '#0ea5e9',
      Nefrologista: '#0ea5e9',
      Urologia: '#06b6d4',
      Urologista: '#06b6d4',
      // Amarelo / Laranja
      Endocrinologia: '#f59e0b',
      Endocrinologista: '#f59e0b',
      Gastroenterologia: '#f97316',
      Gastroenterologista: '#f97316',
      Infectologia: '#84cc16',
      Infectologista: '#84cc16',
      // Verde
      Ortopedia: '#22c55e',
      Ortopedista: '#22c55e',
      Reumatologia: '#16a34a',
      Reumatologista: '#16a34a',
      // Azul Escuro / Índigo
      Oftalmologia: '#6366f1',
      Oftalmologista: '#6366f1',
      Otorrinolaringologia: '#4f46e5',
      Otorrinolaringologista: '#4f46e5',
      // Teal / Ciano
      Ginecologia: '#14b8a6',
      Ginecologista: '#14b8a6',
      Obstetricia: '#0d9488',
      Obstetra: '#0d9488',
      Pediatria: '#0891b2',
      Pediatra: '#0891b2',
      // Rosa / Coral
      Alergologia: '#f472b6',
      Alergologista: '#f472b6',
      Angiologia: '#fb7185',
      Angiologista: '#fb7185',
      // Vermelho Escuro / Bordô
      Cirurgia: '#b91c1c',
      Cirurgião: '#b91c1c',
      // Cinza
      default: '#64748b',
      'Clínico Geral': '#94a3b8',
      'Clínica Geral': '#94a3b8',
      'Medicina Geral': '#94a3b8',
      'Medicina de Família': '#94a3b8',
      // Outro
      Geriatria: '#6b7280',
      Geriatra: '#6b7280',
      Homeopatia: '#a3e635',
      Homeopata: '#a3e635',
      Mastologia: '#f9a8d4',
      Mastologista: '#f9a8d4',
      Nutrologia: '#fbbf24',
      Nutrologista: '#fbbf24',
      Proctologia: '#c2410c',
      Proctologista: '#c2410c',
      Radiologia: '#1e40af',
      Radiologista: '#1e40af',
      Traumatologia: '#ea580c',
      Traumatologista: '#ea580c',
    };
    return colors[specialty] || colors.default;
  };

  const filteredDoctors = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.crm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="empty">Carregando médicos...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Médicos</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="search-box">
            <i className="ph ph-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Buscar por nome, CRM ou especialidade..."
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
            <i className="ph ph-plus"></i> Novo Médico
          </button>
        </div>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h3>
            <i className="ph ph-user-plus"></i> Cadastrar Novo Médico
          </h3>
          <form
            onSubmit={handleCreate}
            className="form-modern"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}
          >
            <input
              name="name"
              placeholder="Nome completo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <input
              name="crm"
              placeholder="CRM (ex: 123456/SP)"
              value={formData.crm}
              onChange={(e) => setFormData({ ...formData, crm: e.target.value })}
              required
            />
            <input
              name="specialty"
              placeholder="Especialidade"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              required
            />
            <input
              name="email"
              type="email"
              placeholder="E-mail"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <input
              name="phone"
              placeholder="Telefone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
            <button type="submit" className="save-btn" style={{ justifySelf: 'start' }}>
              <i className="ph ph-check"></i> Salvar
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedDoctor ? '350px 1fr' : '1fr', gap: 24 }}>
        <div className="panel">
          <h3 style={{ marginBottom: 16 }}>
            <i className="ph ph-stethoscope"></i> Médicos ({filteredDoctors.length})
          </h3>
          {filteredDoctors.length ? (
            <div className="stack">
              {filteredDoctors.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDoctor(d)}
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    background: selectedDoctor?.id === d.id ? 'rgba(13,148,136,0.15)' : 'rgba(0,0,0,0.2)',
                    border: selectedDoctor?.id === d.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: getSpecialtyColor(d.specialty),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 18,
                      }}
                    >
                      {d.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>Dr(a). {d.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>CRM: {d.crm}</div>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: `${getSpecialtyColor(d.specialty)}20`,
                          color: getSpecialtyColor(d.specialty),
                        }}
                      >
                        {d.specialty}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nenhum médico encontrado.</div>
          )}
        </div>

        {selectedDoctor && (
          <div className="panel detail-panel" key={selectedDoctor.id}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: getSpecialtyColor(selectedDoctor.specialty),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 32,
                  }}
                >
                  {selectedDoctor.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>Dr(a). {selectedDoctor.name}</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>CRM: {selectedDoctor.crm}</p>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      fontSize: 13,
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: `${getSpecialtyColor(selectedDoctor.specialty)}20`,
                      color: getSpecialtyColor(selectedDoctor.specialty),
                      fontWeight: 600,
                    }}
                  >
                    {selectedDoctor.specialty}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              <div className="info-card">
                <label>
                  <i className="ph ph-envelope"></i> E-mail
                </label>
                <span>{selectedDoctor.email}</span>
              </div>
              <div className="info-card">
                <label>
                  <i className="ph ph-phone"></i> Telefone
                </label>
                <span>{selectedDoctor.phone}</span>
              </div>
            </div>

            <div
              style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}
            >
              <h4 style={{ marginBottom: 12 }}>
                <i className="ph ph-info"></i> Informações
              </h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
                Este médico está cadastrado no sistema 4Bio e pode ser associado aos pacientes. Caso precise atualizar
                as informações, entre em contato com o administrador.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
