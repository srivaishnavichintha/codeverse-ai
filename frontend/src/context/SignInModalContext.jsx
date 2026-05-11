/**
 * SignInModalContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW FILE.
 *
 * Provides a lightweight global toggle for the "Please sign in" modal.
 * Any component can call openSignInModal() without prop-drilling.
 *
 * Wrap your app:
 *   <SignInModalProvider>
 *     <App />
 *   </SignInModalProvider>
 */

import { createContext, useContext, useState, useCallback } from 'react';

const SignInModalContext = createContext(null);

export function SignInModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSignInModal  = useCallback(() => setIsOpen(true),  []);
  const closeSignInModal = useCallback(() => setIsOpen(false), []);

  return (
    <SignInModalContext.Provider value={{ isOpen, openSignInModal, closeSignInModal }}>
      {children}
    </SignInModalContext.Provider>
  );
}

export function useSignInModal() {
  const ctx = useContext(SignInModalContext);
  if (!ctx) throw new Error('useSignInModal must be used inside <SignInModalProvider>');
  return ctx;
}
