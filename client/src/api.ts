import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api' // Assuming proxy in Vite
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
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    const msg = error.response?.data?.error || error.message || 'Erro na API';
    toast.error(msg);
    return Promise.reject(new Error(msg));
  }
);

export default api;
