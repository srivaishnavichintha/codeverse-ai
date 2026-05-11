/**
 * ContestTimer.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Flexible timer component used in contest cards and the live arena.
 *
 * Props:
 *   startedAt       {string}  ISO timestamp when contest started
 *   durationMinutes {number}  Contest duration in minutes
 *   compact         {boolean} Shows a smaller inline version
 *   onExpired       {fn}      Called when time reaches zero
 *   remainingMs     {number}  Override from socket (more accurate)
 */

import { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/Icon/Icon.jsx';

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatTime(ms) {
  if (ms <= 0) return { h: '00', m: '00', s: '00', total: 0 };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h: pad(h), m: pad(m), s: pad(s), total: totalSec };
}

export default function ContestTimer({
  startedAt,
  durationMinutes,
  compact = false,
  onExpired,
  remainingMs: socketRemainingMs = null,
}) {
  const calcRemaining = () => {
    if (socketRemainingMs !== null) return socketRemainingMs;
    if (!startedAt || !durationMinutes) return null;
    const endsAt = new Date(startedAt).getTime() + durationMinutes * 60_000;
    return Math.max(0, endsAt - Date.now());
  };

  const [remaining, setRemaining] = useState(calcRemaining);
  const expiredFired = useRef(false);

  useEffect(() => {
    // Sync from socket override
    if (socketRemainingMs !== null) {
      setRemaining(socketRemainingMs);
    }
  }, [socketRemainingMs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => {
        const next = Math.max(0, (prev ?? calcRemaining()) - 1000);
        if (next <= 0 && !expiredFired.current) {
          expiredFired.current = true;
          onExpired?.();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes]);

  if (remaining === null) return null;

  const { h, m, s, total } = formatTime(remaining);
  const isUrgent = remaining < 5 * 60_000; // < 5 min
  const isWarning = remaining < 15 * 60_000; // < 15 min

  if (compact) {
    return (
      <div className="cv-cz-timer-compact" style={{
        color: isUrgent ? 'var(--rose)' : isWarning ? 'var(--gold)' : 'var(--light-teal)',
      }}>
        <Icon name="clock" size={12} />
        {h !== '00' && <>{h}:</>}{m}:{s} left
      </div>
    );
  }

  return (
    <div className={`cv-cz-timer${isUrgent ? ' cv-cz-timer--urgent' : ''}`}>
      <div className="cv-cz-timer__label">
        <Icon name="clock" size={14} />
        Time Remaining
      </div>
      <div className="cv-cz-timer__display">
        {h !== '00' && (
          <>
            <div className="cv-cz-timer__unit">
              <span className="cv-cz-timer__value">{h}</span>
              <span className="cv-cz-timer__sub">hrs</span>
            </div>
            <span className="cv-cz-timer__sep">:</span>
          </>
        )}
        <div className="cv-cz-timer__unit">
          <span className="cv-cz-timer__value">{m}</span>
          <span className="cv-cz-timer__sub">min</span>
        </div>
        <span className="cv-cz-timer__sep">:</span>
        <div className="cv-cz-timer__unit">
          <span className="cv-cz-timer__value">{s}</span>
          <span className="cv-cz-timer__sub">sec</span>
        </div>
      </div>
      {isUrgent && (
        <div className="cv-cz-timer__urgent-banner">
          ⚠️ Less than 5 minutes remaining!
        </div>
      )}
    </div>
  );
}
