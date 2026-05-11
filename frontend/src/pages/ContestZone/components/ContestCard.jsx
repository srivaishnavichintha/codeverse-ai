/**
 * ContestCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Card component for a single contest in the listing grid.
 * Matches the existing CodeVerse card style (cv-glass, cv-btn, etc.)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import Icon from '../../../components/Icon/Icon.jsx';
import { joinContest } from '../../../services/contestZone.service.js';
import ContestTimer from './ContestTimer.jsx';

const STATUS_CONFIG = {
  waiting:    { label: 'Waiting',    color: 'var(--text-secondary)',  dot: 'offline'    },
  filling:    { label: 'Filling Up', color: 'var(--gold)',            dot: 'attempted'  },
  starting:   { label: 'Starting',   color: 'var(--cyan)',            dot: 'in-contest' },
  active:     { label: 'LIVE',       color: 'var(--easy)',            dot: 'online'     },
  evaluating: { label: 'Evaluating', color: 'var(--purple)',          dot: 'offline'    },
  completed:  { label: 'Ended',      color: 'var(--text-faint)',      dot: 'offline'    },
  cancelled:  { label: 'Cancelled',  color: 'var(--rose)',            dot: 'offline'    },
  expired:    { label: 'Expired',    color: 'var(--text-faint)',      dot: 'offline'    },
};

const DIFF_CLASS = {
  easy:   'cv-badge-easy',
  medium: 'cv-badge-medium',
  hard:   'cv-badge-hard',
};

export default function ContestCard({ contest, onRefresh, style }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError]     = useState('');

  const cfg     = STATUS_CONFIG[contest.status] || STATUS_CONFIG.waiting;
  const isLive  = contest.status === 'active';
  const canJoin = ['waiting', 'filling'].includes(contest.status) && isAuthenticated;
  const filled  = contest.currentParticipants >= contest.maxParticipants;

  const handleJoin = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) { navigate('/login'); return; }
    setJoining(true);
    setError('');
    try {
      await joinContest(contest._id);
      navigate(`/contest-zone/${contest._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join contest');
    } finally {
      setJoining(false);
    }
  };

  const handleView = () => navigate(`/contest-zone/${contest._id}`);

  const fillPct = contest.maxParticipants > 0
    ? Math.round((contest.currentParticipants / contest.maxParticipants) * 100)
    : 0;

  return (
    <div
      className={`cv-glass cv-cz-card anim-fade-up${isLive ? ' cv-cz-card--live' : ''}`}
      style={style}
      onClick={handleView}
    >
      {/* ── Header ── */}
      <div className="cv-cz-card__header">
        <div className="cv-cz-card__status">
          <span className={`status-dot ${cfg.dot}`} />
          <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>
            {cfg.label}
            {isLive && <span className="cv-cz-live-pulse" />}
          </span>
        </div>
        <div className="cv-cz-card__type-badge">
          {contest.type === 'private' ? '🔒' : '🔓'}
          <span>{contest.type}</span>
        </div>
      </div>

      {/* ── Title ── */}
      <h3 className="cv-cz-card__title">{contest.title}</h3>
      {contest.description && (
        <p className="cv-cz-card__desc">{contest.description}</p>
      )}

      {/* ── Meta chips ── */}
      <div className="cv-cz-card__meta">
        <span className={`cv-badge ${DIFF_CLASS[contest.difficulty] || 'cv-badge-medium'}`}>
          {contest.difficulty}
        </span>
        <span className="cv-chip">
          <Icon name="code" size={11} />
          {contest.problemCount} problem{contest.problemCount !== 1 ? 's' : ''}
        </span>
        <span className="cv-chip">
          <Icon name="clock" size={11} />
          {contest.durationMinutes}m
        </span>
        {contest.entryFee > 0 && (
          <span className="cv-chip" style={{ color: 'var(--gold)' }}>
            💎 {contest.entryFee} coins
          </span>
        )}
      </div>

      {/* ── Participant fill bar ── */}
      <div className="cv-cz-card__fill">
        <div className="cv-cz-card__fill-label">
          <span>
            <Icon name="users" size={11} style={{ marginRight: 4 }} />
            {contest.currentParticipants}/{contest.maxParticipants} participants
          </span>
          <span style={{ color: filled ? 'var(--rose)' : 'var(--text-dim)' }}>
            {filled ? 'Full' : `${fillPct}%`}
          </span>
        </div>
        <div className="cv-progress-track">
          <div
            className="cv-progress-fill"
            style={{
              width: `${fillPct}%`,
              background: filled
                ? 'linear-gradient(90deg, var(--rose), #be123c)'
                : undefined,
            }}
          />
        </div>
      </div>

      {/* ── Timer (for active contests) ── */}
      {isLive && contest.startedAt && (
        <div className="cv-cz-card__timer">
          <ContestTimer
            startedAt={contest.startedAt}
            durationMinutes={contest.durationMinutes}
            compact
          />
        </div>
      )}

      {/* ── Prize pool ── */}
      {contest.prizePool > 0 && (
        <div className="cv-cz-card__prize">
          <Icon name="trophy" size={13} style={{ color: 'var(--gold)' }} />
          <span>Prize pool: </span>
          <strong style={{ color: 'var(--gold)' }}>{contest.prizePool} coins</strong>
        </div>
      )}

      {/* ── Error ── */}
      {error && <div className="cv-cz-card__error">{error}</div>}

      {/* ── Actions ── */}
      <div className="cv-cz-card__actions" onClick={e => e.stopPropagation()}>
        <button className="cv-btn cv-btn-ghost cv-btn-sm" onClick={handleView}>
          View Details
        </button>
        {canJoin && !filled && !contest.isParticipant && (
          <button
            className="cv-btn cv-btn-primary cv-btn-sm"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? 'Joining…' : (
              <><Icon name="zap" size={12} /> Join</>
            )}
          </button>
        )}
        {isLive && (
          <button className="cv-btn cv-btn-primary cv-btn-sm cv-cz-live-btn" onClick={handleView}>
            <span className="cv-pulse-dot" style={{ width: 6, height: 6 }} />
            Enter Live
          </button>
        )}
      </div>
    </div>
  );
}
