/**
 * SignInModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW FILE.
 *
 * A lightweight modal that appears whenever a guest user tries a protected
 * action (submit, run code, bookmark, upvote, etc.).
 *
 * Place this once in your root layout (e.g. MainLayout.jsx or App.jsx).
 * It reads open/close state from SignInModalContext — no props needed.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignInModal } from '../../context/SignInModalContext.jsx';
import './SignInModal.css';

export default function SignInModal() {
  const { isOpen, closeSignInModal } = useSignInModal();
  const navigate = useNavigate();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e) => { if (e.key === 'Escape') closeSignInModal(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, closeSignInModal]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  function goToLogin() {
    closeSignInModal();
    navigate('/login');
  }

  function goToRegister() {
    closeSignInModal();
    navigate('/register');
  }

  return (
    <div className="signin-modal-overlay" onClick={closeSignInModal} role="dialog" aria-modal="true">
      <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="signin-modal__close" onClick={closeSignInModal} aria-label="Close">
          ✕
        </button>

        <div className="signin-modal__icon">🔒</div>

        <h2 className="signin-modal__title">Sign in to continue</h2>
        <p className="signin-modal__body">
          Create a free account to run code, submit solutions, bookmark
          problems, and track your progress.
        </p>

        <div className="signin-modal__actions">
          <button className="signin-modal__btn signin-modal__btn--primary" onClick={goToLogin}>
            Sign In
          </button>
          <button className="signin-modal__btn signin-modal__btn--secondary" onClick={goToRegister}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
