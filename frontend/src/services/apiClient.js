/**
 * apiClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Axios instance shared by the whole frontend.
 * Handles:
 *   • Base URL from env
 *   • Automatic Bearer token injection on every request
 *   • Token persistence in localStorage (survives page refresh)
 *   • 401 auto-logout (clears token, dispatches custom event)
 */

import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Axios instance ───────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ─── Token storage key ────────────────────────────────────────────────────────
const TOKEN_KEY = 'auth_token';

// ─── Token helpers ────────────────────────────────────────────────────────────
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common['Authorization'];
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

// ─── Restore token on module load (page refresh keeps user logged in) ─────────
const _saved = getAuthToken();
if (_saved) {
  api.defaults.headers.common['Authorization'] = `Bearer ${_saved}`;
}

// ─── Request interceptor: always attach freshest token ────────────────────────
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: handle 401 globally ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale token
      setAuthToken(null);
      // Let AuthContext / consumers react via custom event
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
