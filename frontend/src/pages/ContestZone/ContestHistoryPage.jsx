/**
 * ContestHistoryPage.jsx
 * Route: /contest-zone/history
 * Shows the current user's contest participation history.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon/Icon.jsx';
import { getContestHistory } from '../../services/contestZone.service.js';
import './ContestZone.css';

const STATUS_EMOJI = {
  completed: '✅',
  cancelled: '❌',
  expired:   '⏰',
  active:    '⚡',
};

export default function ContestHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [page, setPage]        = useState(1);

  useEffect(() => {
    setLoading(true);
    getContestHistory({ page, limit: 15 })
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="cv-cz-layout">
      <div className="cv-cz-hero" style={{ marginBottom: 24 }}>
        <div>
          <button
            className="cv-btn cv-btn-ghost cv-btn-sm"
            style={{ marginBottom: 12 }}
            onClick={() => navigate('/contest-zone')}
          >
            <Icon name="arrowLeft" size={13} /> Back to Contests
          </button>
          <h1 className="cv-cz-hero-title" style={{ fontSize: 26 }}>
            Contest History
          </h1>
          <p className="cv-cz-hero-sub">
            Your past participations and results.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="cv-skel" style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="cv-empty-state">
          <span className="cv-empty-icon">📜</span>
          <div className="cv-empty-title">No contest history</div>
          <div className="cv-empty-sub">Join a contest to start building your record!</div>
          <button
            className="cv-btn cv-btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => navigate('/contest-zone')}
          >
            Browse Contests
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((entry, i) => {
            const c = entry.contest;
            if (!c) return null;
            return (
              <div
                key={entry._id || i}
                className="cv-glass cv-cz-history-card anim-fade-up"
                style={{ animationDelay: `${i * 0.04}s`, cursor: 'pointer' }}
                onClick={() => navigate(`/contest-zone/${c._id}`)}
              >
                <div className="cv-cz-history-card__left">
                  <span style={{ fontSize: 24 }}>
                    {STATUS_EMOJI[c.status] || '🏆'}
                  </span>
                  <div>
                    <div className="cv-cz-history-card__title">{c.title}</div>
                    <div className="cv-cz-history-card__meta">
                      <span className="cv-chip">{c.type}</span>
                      <span className="cv-chip" style={{ textTransform: 'capitalize' }}>{c.difficulty}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {c.startedAt ? new Date(c.startedAt).toLocaleDateString() : 'Unknown date'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="cv-cz-history-card__right">
                  {entry.rank && (
                    <div className="cv-cz-history-card__rank">
                      <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                        #{entry.rank}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Rank</div>
                    </div>
                  )}
                  {(entry.totalScore || entry.pointsEarned) > 0 && (
                    <div className="cv-cz-history-card__points">
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>
                        +{entry.totalScore || entry.pointsEarned}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>pts</div>
                    </div>
                  )}
                  {(entry.rewardAmount || entry.coinsEarned) > 0 && (
                    <div className="cv-cz-history-card__coins">
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--light-teal)' }}>
                        +{entry.rewardAmount || entry.coinsEarned} 💎
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>coins won</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
