/**
 * useContestNotifications.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight toast notification system for ContestZone.
 * Used by ContestToastStack to display floating contest event toasts.
 *
 * Usage:
 *   const { toasts, addToast, dismissToast } = useContestToasts();
 */

import { useState, useCallback, useRef, createContext, useContext } from 'react';

// ── Context so toasts can be triggered from anywhere ─────────────────────────
const ContestToastContext = createContext(null);

export function ContestToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const addToast = useCallback(({ label, message, icon = '🏆', color = 'var(--primary-teal)', contestId = null, duration = 5000 }) => {
    const id = ++idCounter.current;

    setToasts(prev => [
      ...prev,
      { id, label, message, icon, color, contestId, createdAt: Date.now() },
    ]);

    // Auto-dismiss after duration
    timers.current[id] = setTimeout(() => {
      dismissToast(id);
    }, duration);

    return id;
  }, [dismissToast]);

  return (
    <ContestToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
    </ContestToastContext.Provider>
  );
}

/**
 * Hook to read toasts and dismiss them.
 * Used by ContestToastStack component.
 */
export function useContestToasts() {
  const ctx = useContext(ContestToastContext);
  if (!ctx) {
    // Graceful fallback if provider is not mounted — return empty state
    return { toasts: [], addToast: () => {}, dismissToast: () => {} };
  }
  return ctx;
}

/**
 * Hook to push toasts from any component.
 */
export function useAddContestToast() {
  const ctx = useContext(ContestToastContext);
  if (!ctx) return () => {};
  return ctx.addToast;
}
