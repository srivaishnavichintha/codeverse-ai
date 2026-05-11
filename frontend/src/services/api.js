// frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Soft-fail: bubble up but never crash the app.
    console.warn('[api]', err?.response?.status, err?.config?.url, err?.message);
    return Promise.reject(err);
  }
);

export default api;
