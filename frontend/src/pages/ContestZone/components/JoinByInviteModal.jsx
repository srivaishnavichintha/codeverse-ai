/**
 * JoinByInviteModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal for joining a private contest by entering the Room ID / invite code.
 * Features clear instructions and styled code input.
 */

import { useState } from 'react';
import Icon from '../../../components/Icon/Icon.jsx';
import { joinByInvite } from '../../../services/contestZone.service.js';

export default function JoinByInviteModal({ onClose, onJoined }) {
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Please enter a Room ID'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await joinByInvite(trimmed);
      onJoined(data?.contest || data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid Room ID or contest unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="cv-cz-modal-header">
          <div>
            <h2 className="cv-section-title">
              <span style={{ marginRight: 6 }}>🔑</span> Join by Room ID
            </h2>
          </div>
          <button className="cv-btn cv-btn-ghost cv-btn-sm" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
          Enter the Room ID (invite code) shared by the contest creator to join their private contest.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'var(--text-dim)', marginBottom: 20,
          padding: '8px 12px', background: 'var(--dark-bg-2)',
          borderRadius: 8, border: '1px solid var(--border-subtle)',
        }}>
          <span>💡</span>
          The code is typically 12 characters, like <strong style={{ color: 'var(--light-teal)', fontFamily: 'var(--font-mono)' }}>A3B9FC1D2E4F</strong>
        </div>

        {error && <div className="cv-cz-modal-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="cv-cz-field" style={{ marginBottom: 0 }}>
          <label className="cv-cz-label">Room ID / Invite Code</label>
          <input
            className="cv-input"
            placeholder="Enter code here…"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={12}
            autoFocus
            style={{
              letterSpacing: '0.18em',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 22,
              textAlign: 'center',
              padding: '14px 16px',
            }}
          />
        </div>

        <div className="cv-cz-modal-actions" style={{ marginTop: 24 }}>
          <button className="cv-btn cv-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="cv-btn cv-btn-primary"
            onClick={handleJoin}
            disabled={loading || !code.trim()}
            style={{ padding: '10px 28px' }}
          >
            {loading ? '⏳ Joining…' : <><Icon name="zap" size={13} /> Join Contest</>}
          </button>
        </div>
      </div>
    </div>
  );
}
