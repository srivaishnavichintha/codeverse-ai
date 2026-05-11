/**
 * ContestLeaderboard.jsx
 * Real-time leaderboard with socket sync.
 */

import { useState, useEffect } from 'react';
import Icon from '../../../components/Icon/Icon.jsx';
import { getLeaderboard } from '../../../services/contestZone.service.js';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function ContestLeaderboard({ contestId, socket, currentUserId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [contestId]);

  // Socket real-time updates
  useEffect(() => {
    if (socket?.leaderboard?.length > 0) {
      setEntries(socket.leaderboard);
    }
  }, [socket?.leaderboard]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(contestId);
      setEntries(data?.leaderboard || []);
    } catch {}
    finally { setLoading(false); }
  };

  const handleRefresh = () => {
    socket?.requestLeaderboard?.();
    fetchLeaderboard();
  };

  if (loading) return (
    <div className="cv-glass cv-cz-section">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="cv-skel" style={{ height: 52, borderRadius: 10, marginBottom: 8 }} />
      ))}
    </div>
  );

  if (entries.length === 0) return (
    <div className="cv-empty-state">
      <span className="cv-empty-icon">📊</span>
      <div className="cv-empty-title">No submissions yet</div>
      <div className="cv-empty-sub">Be the first to solve a problem!</div>
    </div>
  );

  return (
    <div className="cv-glass cv-cz-section">
      <div className="cv-section-header">
        <h3 className="cv-section-title">
          <Icon name="trophy" size={16} style={{ color: 'var(--gold)' }} /> Leaderboard
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {socket?.isConnected && (
            <span style={{ fontSize: 11, color: 'var(--easy)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="cv-pulse-dot" style={{ width: 6, height: 6 }} /> Live
            </span>
          )}
          <button className="cv-btn cv-btn-ghost cv-btn-sm" onClick={handleRefresh}>
            <Icon name="rotateLeft" size={12} /> Refresh
          </button>
        </div>
      </div>

      <div className="cv-cz-leaderboard">
        {/* Header */}
        <div className="cv-cz-lb-header">
          <span style={{ width: 40, textAlign: 'center' }}>Rank</span>
          <span style={{ flex: 1 }}>Participant</span>
          <span style={{ width: 80, textAlign: 'right' }}>Score</span>
          <span style={{ width: 80, textAlign: 'right' }}>Solved</span>
          <span style={{ width: 90, textAlign: 'right' }}>Penalty</span>
        </div>

        {entries.map((entry, i) => {
          const isMe = entry.user?._id === currentUserId || entry.userId === currentUserId;
          const rank = entry.rank || i + 1;
          return (
            <div
              key={entry.user?._id || i}
              className={`cv-cz-lb-row${isMe ? ' cv-cz-lb-row--me' : ''}`}
            >
              <span className="cv-cz-lb-rank">
                {rank <= 3 ? MEDAL[rank - 1] : `#${rank}`}
              </span>
              <div className="cv-cz-lb-user">
                <div
                  className={`cv-avatar cv-avatar-sm ${['cv-avatar-teal','cv-avatar-purple','cv-avatar-rose','cv-avatar-gold','cv-avatar-cyan'][i % 5]}`}
                >
                  {(entry.user?.username || entry.username || '?').slice(0,2).toUpperCase()}
                </div>
                <span className="cv-cz-lb-name">
                  {entry.user?.username || entry.username || 'Unknown'}
                  {isMe && <span className="cv-cz-lb-you"> (You)</span>}
                </span>
              </div>
              <span className="cv-cz-lb-score">{entry.totalScore || entry.totalPoints || entry.score || 0}</span>
              <span className="cv-cz-lb-solved">{entry.problemsSolved || entry.solvedCount || 0}</span>
              <span className="cv-cz-lb-penalty">
                {(entry.totalRuntime || entry.totalTimePenalty) ? `${Math.floor((entry.totalRuntime || entry.totalTimePenalty) / 1000)}s` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
