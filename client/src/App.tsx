import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';

// Placeholders for actual pages we'll build
const Login = () => <div className="login-panel"><h1>Login - 4BIO Vite</h1></div>;
const Dashboard = () => <div className="content-pane active"><h1>Dashboard</h1><p>Sistema sendo migrado para React...</p></div>;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  useEffect(() => {
    // If we have token, simple mock verification
  }, [token]);

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}
