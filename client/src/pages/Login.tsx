import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // The backend expects normal POST to /login
      const res: any = await api.post('/login', { employeeCode, password });
      if (res.token) {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_user', JSON.stringify(res.user));
        // Force reload to update token states, or use Context (reload is simpler for legacy compat atm)
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
            onChange={e => setEmployeeCode(e.target.value)} 
            placeholder="Código interno (ex: 4B-101)" 
            required 
          />
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Senha" 
            required 
          />
          <button type="submit">Entrar</button>
        </form>
        <small style={{display: 'block', marginTop: '1rem'}}>
          Teste: 4B-001/admin123 • 4B-014/gerente123 • 4B-101/operador123 • 4B-220/inventario123
        </small>
      </section>
    </main>
  );
}
