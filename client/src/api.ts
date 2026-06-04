import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api', // Assuming proxy in Vite
  timeout: 30000 // 30 second timeout
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle different types of errors appropriately
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
      // Network errors or server errors - don't redirect to login
      toast.error('Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.');
      console.error('API Error:', error);
      return Promise.reject(new Error('Serviço indisponível'));
    }

    if (error.response?.status === 401) {
      // Authentication error - clear tokens and redirect
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
      return Promise.reject(new Error('Não autorizado'));
    }

    const msg = error.response?.data?.error || error.message || 'Erro na API';
    toast.error(msg);
    return Promise.reject(new Error(msg));
  }
);

export default api;
