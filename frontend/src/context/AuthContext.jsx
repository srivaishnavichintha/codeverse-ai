/**
 * AuthContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from original:
 *   1. Imports from './apiClient' instead of './problemsService' directly —
 *      setAuthToken/getAuthToken now live in apiClient (single source of truth).
 *   2. Listens to 'auth:unauthorized' custom event fired by the axios interceptor
 *      so the user is auto-logged-out on 401 without duplicating logic.
 *   3. Exposes `isAuthenticated` boolean so components don't do `!!user` everywhere.
 *   4. `login` and `register` now correctly extract the token from the backend
 *      response shape: { success, token, data: { user } }.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { AuthAPI, setAuthToken, getAuthToken } from '../services/problemsService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount (page refresh) ──────────────────────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    AuthAPI.me()
      .then((data) => {
        // Backend: GET /api/auth/me → { success, data: { user } }
        // unwrap() in problemsService strips outer wrapper → { user } or user directly
        const u = data?.user ?? data;
        setUser(u || null);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Auto-logout on 401 (axios interceptor fires this) ────────────────────
  useEffect(() => {
    const handle = () => {
      setUser(null);
      // Token already cleared by the interceptor
    };
    window.addEventListener('auth:unauthorized', handle);
    return () => window.removeEventListener('auth:unauthorized', handle);
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  // Backend: POST /api/auth/login → { success: true, token, data: { user } }
  const login = useCallback(async (email, password) => {
    const data = await AuthAPI.login({ email, password });
    // After unwrap(): data = { user, token } or data = { token } + data.user
    const token = data?.token;
    const u     = data?.user ?? data;
    if (token) setAuthToken(token);
    setUser(u || null);
    return u;
  }, []);

  // ── register ──────────────────────────────────────────────────────────────
  // Backend: POST /api/auth/register → { success: true, token, data: { user } }
  const register = useCallback(async (username, email, password) => {
    const data = await AuthAPI.register({ username, email, password });
    const token = data?.token;
    const u     = data?.user ?? data;
    if (token) setAuthToken(token);
    setUser(u || null);
    return u;
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
