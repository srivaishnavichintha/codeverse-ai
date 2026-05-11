/**
 * useAuthGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW FILE.
 *
 * Provides a single `requireAuth(callback)` helper that:
 *   • Runs the callback if the user is logged in.
 *   • Opens the Sign-In modal (via context event) if not.
 *
 * Usage in any component:
 *   const { requireAuth } = useAuthGuard();
 *   <button onClick={() => requireAuth(() => handleSubmit())}>Submit</button>
 */

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSignInModal } from '../context/SignInModalContext.jsx';

export function useAuthGuard() {
  const { isAuthenticated } = useAuth();
  const { openSignInModal } = useSignInModal();

  const requireAuth = useCallback(
    (action) => {
      if (isAuthenticated) {
        action();
      } else {
        openSignInModal();
      }
    },
    [isAuthenticated, openSignInModal]
  );

  return { requireAuth, isAuthenticated };
}
