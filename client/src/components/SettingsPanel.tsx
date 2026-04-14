import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface UserInfo {
  id: string;
  name: string;
  role: string;
  employeeCode: string;
  email?: string;
  phone?: string;
  photo?: string;
}

type Props = {
  onClose: () => void;
};

export default function SettingsPanel({ onClose }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<UserInfo>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    photo: user?.photo || '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'appearance'>('profile');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (maximo 2MB)');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo invalido. Use JPG, PNG, WEBP ou GIF');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setForm((prev) => ({ ...prev, photo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    if (!form.name.trim()) {
      toast.error('Nome e obrigatorio');
      return;
    }

    const updatedUser = {
      ...user,
      name: form.name,
      email: form.email,
      phone: form.phone,
      photo: form.photo,
    };

    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    localStorage.setItem(
      'user_profile',
      JSON.stringify({
        photo: form.photo,
        email: form.email,
        phone: form.phone,
        name: form.name,
        employeeCode: user?.employeeCode,
      })
    );
    setUser(updatedUser);
    toast.success('Perfil atualizado com sucesso!');
  };

  const handleChangePassword = () => {
    if (password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas nao coincidem');
      return;
    }

    localStorage.setItem('user_password', password);
    toast.success('Senha alterada com sucesso!');
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    toast.success('Logout realizado!');
    navigate('/login');
  };

  return (
    <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
      <div className="settings-header">
        <h3>Configuracoes</h3>
        <button className="settings-close" onClick={onClose}>
          <i className="ph ph-x"></i>
        </button>
      </div>

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <i className="ph ph-user"></i>
          Perfil
        </button>
        <button
          className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <i className="ph ph-gear"></i>
          Conta
        </button>
        <button
          className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          <i className="ph ph-palette"></i>
          Aparencia
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'profile' && (
          <div className="settings-section">
            <div className="profile-photo-section">
              <div className="profile-photo-container" onClick={() => fileInputRef.current?.click()}>
                {form.photo ? (
                  <img src={form.photo} alt="Foto de perfil" className="profile-photo" />
                ) : (
                  <div className="profile-photo-placeholder">
                    <i className="ph ph-camera"></i>
                    <span>Adicionar foto</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
              <button
                className="profile-photo-remove"
                onClick={() => setForm((prev) => ({ ...prev, photo: '' }))}
                style={{ display: form.photo ? 'block' : 'none' }}
              >
                <i className="ph ph-trash"></i>
                Remover foto
              </button>
            </div>

            <div className="form-group">
              <label>Nome completo *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Seu nome"
              />
            </div>

            <div className="form-group">
              <label>Codigo do colaborador</label>
              <input
                type="text"
                value={user?.employeeCode || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label>Cargo</label>
              <input type="text" value={user?.role || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>

            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="seu@email.com"
              />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>

            <button className="settings-save-btn" onClick={handleSaveProfile}>
              <i className="ph ph-check"></i>
              Salvar alteracoes
            </button>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="settings-section">
            <h4>Alterar senha</h4>
            <p className="settings-description">Sua senha deve ter pelo menos 6 caracteres.</p>

            <div className="form-group">
              <label>Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
              />
            </div>

            <div className="form-group">
              <label>Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="********"
              />
            </div>

            <button className="settings-save-btn" onClick={handleChangePassword}>
              <i className="ph ph-lock"></i>
              Alterar senha
            </button>

            <hr style={{ margin: '24px 0', borderColor: 'var(--border-light)' }} />

            <h4>Informacoes da conta</h4>
            <div className="account-info">
              <div className="account-info-item">
                <span className="account-info-label">ID da conta</span>
                <span className="account-info-value">{user?.id || 'N/A'}</span>
              </div>
              <div className="account-info-item">
                <span className="account-info-label">Codigo</span>
                <span className="account-info-value">{user?.employeeCode || 'N/A'}</span>
              </div>
              <div className="account-info-item">
                <span className="account-info-label">Tipo</span>
                <span className="account-info-value">{user?.role || 'N/A'}</span>
              </div>
            </div>

            <hr style={{ margin: '24px 0', borderColor: 'var(--border-light)' }} />

            <button className="settings-danger-btn" onClick={handleLogout}>
              <i className="ph ph-sign-out"></i>
              Sair da conta
            </button>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="settings-section">
            <h4>Aparencia</h4>
            <p className="settings-description">Personalize a aparencia do sistema.</p>

            <div className="theme-options">
              <div className="theme-option" data-theme="dark">
                <div className="theme-preview dark-preview">
                  <div className="theme-preview-sidebar"></div>
                  <div className="theme-preview-content">
                    <div className="theme-preview-header"></div>
                  </div>
                </div>
                <span>Escuro</span>
              </div>
              <div className="theme-option" data-theme="light">
                <div className="theme-preview light-preview">
                  <div className="theme-preview-sidebar"></div>
                  <div className="theme-preview-content">
                    <div className="theme-preview-header"></div>
                  </div>
                </div>
                <span>Claro</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
