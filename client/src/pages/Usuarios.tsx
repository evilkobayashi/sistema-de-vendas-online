import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

type User = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'gerente' | 'operador' | 'inventario';
  employeeCode: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

type Role = {
  id: string;
  name: string;
  description: string;
};

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filterActive, setFilterActive] = useState<'all' | 'true' | 'false'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'operador' as User['role'],
    employeeCode: '',
    password: '',
    confirmPassword: '',
  });
  const [showPasswordModal, setShowPasswordModal] = useState<User | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data: any = await api.get('/employees');
      setUsers(Array.isArray(data.items) ? data.items : []);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data: any = await api.get('/roles');
      setRoles(data);
    } catch {
      console.error('Erro ao carregar funções');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.employeeCode || !formData.role) {
      toast.error('Nome, código e função são obrigatórios');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Senhas não conferem');
      return;
    }

    setProcessing(true);
    try {
      if (editingUser) {
        await api.put(`/employees/${editingUser.id}`, {
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          role: formData.role,
        });
        toast.success('Usuário atualizado com sucesso');
      } else {
        if (!formData.password) {
          toast.error('Senha é obrigatória para novos usuários');
          return;
        }
        await api.post('/employees', {
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          role: formData.role,
          employeeCode: formData.employeeCode,
          password: formData.password,
        });
        toast.success('Usuário criado com sucesso');
      }

      setShowForm(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar usuário');
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      employeeCode: user.employeeCode,
      password: '',
      confirmPassword: '',
    });
    setShowForm(true);
  };

  const handleToggleActive = async (user: User) => {
    setProcessing(true);
    try {
      await api.patch(`/employees/${user.id}/active`, { active: !user.active });
      toast.success(`Usuário ${!user.active ? 'ativado' : 'desativado'} com sucesso`);
      loadUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao alterar status');
    } finally {
      setProcessing(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      toast.error('Nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Senhas não conferem');
      return;
    }

    setProcessing(true);
    try {
      const isOwnPassword = showPasswordModal?.id === getCurrentUserId();
      await api.put(`/employees/${showPasswordModal!.id}/password`, {
        ...(isOwnPassword && { currentPassword: passwordData.currentPassword }),
        newPassword: passwordData.newPassword,
      });
      toast.success('Senha alterada com sucesso');
      setShowPasswordModal(null);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao alterar senha');
    } finally {
      setProcessing(false);
    }
  };

  const getCurrentUserId = () => {
    const user = localStorage.getItem('auth_user');
    if (user) {
      try {
        return JSON.parse(user).id;
      } catch {
        return null;
      }
    }
    return null;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'operador',
      employeeCode: '',
      password: '',
      confirmPassword: '',
    });
  };

  const filteredUsers = users.filter((user) => {
    const matchesActive = filterActive === 'all' || user.active.toString() === filterActive;
    const matchesSearch =
      !searchTerm ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesActive && matchesSearch;
  });

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      gerente: 'Gerente',
      operador: 'Operador',
      inventario: 'Inventário',
    };
    return labels[role] || role;
  };

  const getRoleBadgeStyle = (role: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      admin: { bg: '#7c3aed', color: '#fff' },
      gerente: { bg: '#2563eb', color: '#fff' },
      operador: { bg: '#059669', color: '#fff' },
      inventario: { bg: '#d97706', color: '#fff' },
    };
    return styles[role] || { bg: '#6b7280', color: '#fff' };
  };

  if (loading) return <div className="empty">Carregando usuários...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Gestão de Usuários</h2>
        <button
          className="quick-btn"
          style={{ background: 'var(--accent)' }}
          onClick={() => {
            resetForm();
            setEditingUser(null);
            setShowForm(true);
          }}
        >
          <i className="ph ph-user-plus"></i> Novo Usuário
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <i className="ph ph-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Buscar por nome, código ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => setSearchTerm('')}>
              <i className="ph ph-x"></i>
            </button>
          )}
        </div>

        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as any)}
          style={{
            padding: '10px 16px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-main)',
            cursor: 'pointer',
          }}
        >
          <option value="all">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      <div className="panel">
        {filteredUsers.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  USUÁRIO
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  FUNÇÃO
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  STATUS
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  CRIADO EM
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: '1px solid var(--border-light)', opacity: user.active ? 1 : 0.6 }}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: user.active ? 'linear-gradient(135deg, var(--accent), #0d9488)' : '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {user.employeeCode} • {user.email || 'Sem email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: getRoleBadgeStyle(user.role).bg,
                        color: getRoleBadgeStyle(user.role).color,
                      }}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: user.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: user.active ? '#10b981' : '#ef4444',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: user.active ? '#10b981' : '#ef4444',
                        }}
                      />
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        className="quick-btn"
                        style={{ padding: '6px 12px', fontSize: 12, background: 'var(--bg-secondary)' }}
                        onClick={() => handleEdit(user)}
                        title="Editar"
                      >
                        <i className="ph ph-pencil"></i>
                      </button>
                      <button
                        className="quick-btn"
                        style={{ padding: '6px 12px', fontSize: 12, background: 'var(--bg-secondary)' }}
                        onClick={() => {
                          setShowPasswordModal(user);
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        }}
                        title="Alterar senha"
                      >
                        <i className="ph ph-key"></i>
                      </button>
                      <button
                        className="quick-btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          background: user.active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: user.active ? '#ef4444' : '#10b981',
                        }}
                        onClick={() => handleToggleActive(user)}
                        disabled={processing || user.id === getCurrentUserId()}
                        title={user.active ? 'Desativar' : 'Ativar'}
                      >
                        <i className={`ph ${user.active ? 'ph-user-minus' : 'ph-user-plus'}`}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Nenhum usuário encontrado</div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div
              className="modal-header"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #0d9488)',
                padding: 16,
                borderRadius: '12px 12px 0 0',
                margin: '-20px -20px 20px -20px',
              }}
            >
              <h3 style={{ margin: 0, color: 'white' }}>
                <i className="ph ph-user"></i> {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <i className="ph ph-x" style={{ color: 'white' }}></i>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome Completo *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Código do Funcionário *</label>
                  <input
                    type="text"
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value.toUpperCase() })}
                    placeholder="Ex: 4B-XXX"
                    required={!editingUser}
                    disabled={!!editingUser}
                  />
                </div>

                <div className="form-group">
                  <label>Função *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="joao.silva@4bio.com.br"
                  />
                </div>

                <div className="form-group">
                  <label>Telefone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              {!editingUser && (
                <>
                  <div className="form-group">
                    <label>Senha *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirmar Senha *</label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Repita a senha"
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" className="quick-btn cancel-btn" onClick={() => setShowForm(false)}>
                  <i className="ph ph-x"></i> Cancelar
                </button>
                <button type="submit" className="quick-btn save-btn" disabled={processing}>
                  <i className="ph ph-check"></i> {editingUser ? 'Salvar' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div
              className="modal-header"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                padding: 16,
                borderRadius: '12px 12px 0 0',
                margin: '-20px -20px 20px -20px',
              }}
            >
              <h3 style={{ margin: 0, color: 'white' }}>
                <i className="ph ph-key"></i> Alterar Senha
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowPasswordModal(null)}
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <i className="ph ph-x" style={{ color: 'white' }}></i>
              </button>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
                Alterando senha de: <strong>{showPasswordModal.name}</strong>
              </p>

              {showPasswordModal.id === getCurrentUserId() && (
                <div className="form-group">
                  <label>Senha Atual *</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Nova Senha *</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label>Confirmar Nova Senha *</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="quick-btn cancel-btn" onClick={() => setShowPasswordModal(null)}>
                  Cancelar
                </button>
                <button className="quick-btn save-btn" onClick={handleChangePassword} disabled={processing}>
                  <i className="ph ph-check"></i> Alterar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
