/**
 * ContestToastStack.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders floating contest notification toasts in the bottom-right corner.
 * Mount once inside MainLayout (after <Outlet />).
 *
 * Example:
 *   import ContestToastStack from '../components/ContestZone/ContestToastStack.jsx';
 *   // inside MainLayout return:
 *   <>
 *     <Navbar />
 *     <div className="cv-page-wrapper"><Outlet /></div>
 *     <ContestToastStack />
 *   </>
 */

import { useNavigate } from 'react-router-dom';
import { useContestToasts } from '../../hooks/useContestNotifications.jsx';
import Icon from '../Icon/Icon.jsx';
import './ContestToastStack.css';

export default function ContestToastStack() {
  const { toasts, dismissToast } = useContestToasts();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    <div className="cv-cz-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="cv-cz-toast anim-fade-up"
          style={{ '--toast-accent': toast.color }}
          onClick={() => toast.contestId && navigate(`/contest-zone/${toast.contestId}`)}
          role={toast.contestId ? 'button' : 'status'}
          tabIndex={toast.contestId ? 0 : -1}
        >
          {/* Left accent bar */}
          <div className="cv-cz-toast__bar" />

          {/* Icon */}
          <span className="cv-cz-toast__icon">{toast.icon}</span>

          {/* Content */}
          <div className="cv-cz-toast__body">
            <div className="cv-cz-toast__label">{toast.label}</div>
            <div className="cv-cz-toast__msg">{toast.message}</div>
          </div>

          {/* Dismiss */}
          <button
            className="cv-cz-toast__close"
            onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
            aria-label="Dismiss"
          >
            <Icon name="x" size={12} />
          </button>

          {/* Progress bar (5s auto-dismiss) */}
          <div className="cv-cz-toast__progress" />
        </div>
      ))}
    </div>
  );
}
