import { useState } from 'react';
import api from '../api';

export default function Login() {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loginPassword = password || localStorage.getItem('user_password') || '';
      const res: any = await api.post('/login', { employeeCode, password: loginPassword });
      if (res.token) {
        const savedProfile = localStorage.getItem('user_profile');
        let user = res.user;

        if (savedProfile) {
          const profile = JSON.parse(savedProfile);
          if (profile.employeeCode === user.employeeCode) {
            user = { ...user, ...profile };
          }
        }

        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('user_password', loginPassword);
        window.location.href = '/';
      }
    } catch (err) {
      // Error handled by api interceptor
    }
  };

  return (
    <main className="layout">
      <section className="panel login-panel">
        <h1>Sistema Interno de Compras</h1>
        <p>Faça login com seu código de colaborador para registrar pedidos.</p>
        <form onSubmit={handleLogin} className="grid-form">
          <input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            placeholder="Código interno (ex: 4B-101)"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
          />
          <button type="submit">Entrar</button>
        </form>
        <small style={{ display: 'block', marginTop: '1rem' }}>
          Teste: 4B-001/admin123 • 4B-014/manager123 • 4B-101/operator123
        </small>
      </section>
    </main>
  );
}
