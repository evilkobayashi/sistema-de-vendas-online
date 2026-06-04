import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';

import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Heavy pages are lazy-loaded to reduce initial bundle size
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pedidos = lazy(() => import('./pages/Pedidos'));
const Estoque = lazy(() => import('./pages/Estoque'));

// Remaining pages — imported eagerly (smaller, less frequent)
import Catalogo from './pages/Catalogo';
import NovaCompra from './pages/NovaCompra';
import Entregas from './pages/Entregas';
import Atendimento from './pages/Atendimento';
import Clientes from './pages/Clientes';
import Medicos from './pages/Medicos';
import PlanosSaude from './pages/PlanosSaude';
import Cadastros from './pages/Cadastros';
import Inventario from './pages/Inventario';
import Orcamentos from './pages/Orcamentos';
import Recorrencias from './pages/Recorrencias';
import Usuarios from './pages/Usuarios';
import Simulacao from './pages/Simulacao';

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, color: 'var(--text-muted)' }}>
      <i className="ph ph-spinner" style={{ fontSize: 24, marginRight: 8 }}></i>
      Carregando página...
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <NotificationsProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #2a3441',
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#0b0f19' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#0b0f19' } },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
              <Route path="catalogo" element={<Catalogo />} />
              <Route path="estoque" element={<Suspense fallback={<PageFallback />}><Estoque /></Suspense>} />
              <Route path="nova-compra" element={<NovaCompra />} />
              <Route path="pedidos" element={<Suspense fallback={<PageFallback />}><Pedidos /></Suspense>} />
              <Route path="entregas" element={<Entregas />} />
              <Route path="atendimento" element={<Atendimento />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="medicos" element={<Medicos />} />
              <Route path="planos-saude" element={<PlanosSaude />} />
              <Route path="cadastros" element={<Cadastros />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="orcamentos" element={<Orcamentos />} />
              <Route path="recorrencias" element={<Recorrencias />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="simulacao" element={<Simulacao />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </NotificationsProvider>
    </ThemeProvider>
  );
}
