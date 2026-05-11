/**
 * ContestRewards.jsx
 */
import { useState, useEffect } from 'react';
import Icon from '../../../components/Icon/Icon.jsx';
import { getRewardLogs } from '../../../services/contestZone.service.js';

export default function ContestRewards({ contestId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRewardLogs(contestId)
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contestId]);

  if (loading) return (
    <div className="cv-glass cv-cz-section">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="cv-skel" style={{ height: 52, borderRadius: 10, marginBottom: 8 }} />
      ))}
    </div>
  );

  if (logs.length === 0) return (
    <div className="cv-empty-state">
      <span className="cv-empty-icon">💎</span>
      <div className="cv-empty-title">No rewards yet</div>
      <div className="cv-empty-sub">Rewards are distributed after contest completion.</div>
    </div>
  );

  return (
    <div className="cv-glass cv-cz-section">
      <div className="cv-section-header">
        <h3 className="cv-section-title">
          <Icon name="star" size={16} style={{ color: 'var(--gold)' }} /> Reward Distribution
        </h3>
      </div>
      <div className="cv-cz-rewards-list">
        {logs.map((log, i) => (
          <div key={log._id || i} className="cv-cz-reward-item">
            <div className="cv-cz-reward-rank">#{log.rank}</div>
            <div className="cv-cz-reward-user">
              <div className="cv-avatar cv-avatar-sm cv-avatar-gold">
                {(log.user?.username || '?').slice(0,2).toUpperCase()}
              </div>
              <span>{log.user?.username || 'Unknown'}</span>
            </div>
            <div className="cv-cz-reward-amount">
              <Icon name="star" size={12} style={{ color: 'var(--gold)' }} />
              +{log.coinsAwarded || log.amount} coins
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {log.sharePercent ? `${log.sharePercent}% share` : log.type || ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
