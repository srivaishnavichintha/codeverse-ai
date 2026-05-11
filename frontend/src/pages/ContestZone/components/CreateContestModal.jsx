/**
 * CreateContestModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-featured modal form to create a new ContestZone contest.
 * Two contest types: Public (Advanced users only) and Private (all eligible users).
 * All backend constraint validations shown inline.
 */

import { useState } from 'react';
import Icon from '../../../components/Icon/Icon.jsx';
import { createContest } from '../../../services/contestZone.service.js';

const DEFAULT = {
  title: '',
  description: '',
  type: 'private',
  difficulty: 'medium',
  problemCount: 3,
  minParticipants: 2,
  maxParticipants: 10,
  entryFee: 0,
  durationMinutes: 60,
  platformFeePercent: 10,
  scheduledStartAt: '',  // ISO string or empty
};

// Helper: minimum datetime value (5 minutes from now) for the picker
function getMinDateTime() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  return d.toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:MM'
}

export default function CreateContestModal({ onClose, onCreated, userLevel }) {
  const [form, setForm]       = useState(DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [created, setCreated] = useState(null); // { contest, inviteLink }
  const [copied, setCopied]   = useState(false);

  const isAdvanced = userLevel === 'advanced';

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Inline validations
  const validationErrors = [];
  if (!form.title.trim()) validationErrors.push('Title is required');
  if (form.problemCount < 1 || form.problemCount > 5) validationErrors.push('Problems must be 1–5');
  if (form.maxParticipants < form.minParticipants) validationErrors.push('Max must be ≥ Min participants');
  if (form.maxParticipants > 20) validationErrors.push('Max participants cannot exceed 20');
  if (form.minParticipants < 2) validationErrors.push('Min participants must be at least 2');
  if (form.type === 'public' && !isAdvanced) validationErrors.push('Only Advanced users can create public contests');
  if (form.scheduledStartAt && new Date(form.scheduledStartAt).getTime() < Date.now() + 2 * 60 * 1000) {
    validationErrors.push('Scheduled start must be at least 2 minutes in the future');
  }

  const canSubmit = validationErrors.length === 0 && form.title.trim() && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        problemCount: Number(form.problemCount),
        minParticipants: Number(form.minParticipants),
        maxParticipants: Number(form.maxParticipants),
        entryFee: Number(form.entryFee),
        durationMinutes: Number(form.durationMinutes),
        platformFeePercent: Number(form.platformFeePercent),
      };
      // Send scheduledStartAt as ISO string or null
      if (form.scheduledStartAt) {
        payload.scheduledStartAt = new Date(form.scheduledStartAt).toISOString();
      } else {
        delete payload.scheduledStartAt;
      }
      const data = await createContest(payload);
      setCreated(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create contest');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(created?.inviteLink || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const estPrizePool = form.entryFee > 0
    ? Math.floor(Number(form.entryFee) * Number(form.maxParticipants) * (1 - Number(form.platformFeePercent) / 100))
    : 0;

  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal cv-cz-create-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cv-cz-modal-header">
          <div>
            <h2 className="cv-section-title">
              <Icon name="trophy" size={18} style={{ color: 'var(--gold)' }} /> Create Contest
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Set up a coding competition for the community
            </p>
          </div>
          <button className="cv-btn cv-btn-ghost cv-btn-sm" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {created ? (
          /* ── Success screen ── */
          <div className="cv-cz-modal-success">
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>
              Contest Created!
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
              <strong>{created.contest?.title}</strong>
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              {created.contest?.type === 'private' ? '🔒 Private Contest' : '🔓 Public Contest'}
              {' · '}
              {created.contest?.difficulty} difficulty
              {' · '}
              {created.contest?.durationMinutes}m duration
            </p>

            {created.inviteLink && (
              <div className="cv-cz-invite-box" style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                  🔒 Share this invite link with friends to join
                </div>
                <div className="cv-cz-invite-code" style={{ fontSize: 14, padding: '8px 0' }}>
                  {created.inviteLink}
                </div>
                <button
                  className="cv-btn cv-btn-ghost cv-btn-sm"
                  style={{ marginTop: 10, width: '100%' }}
                  onClick={handleCopyInvite}
                >
                  <Icon name="copy" size={12} />
                  {copied ? '✓ Copied!' : 'Copy Invite Link'}
                </button>

                {/* Also show just the code for easy sharing */}
                {created.contest?.inviteCode && (
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Room ID / Invite Code</div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 24,
                      fontWeight: 800,
                      letterSpacing: '0.15em',
                      color: 'var(--light-teal)',
                    }}>
                      {created.contest.inviteCode}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="cv-btn cv-btn-primary"
              style={{ marginTop: 24, width: '100%', padding: '12px 20px' }}
              onClick={() => onCreated(created.contest)}
            >
              <Icon name="zap" size={14} /> Go to Contest →
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="cv-cz-modal-form">
            {error && <div className="cv-cz-modal-error">{error}</div>}

            {/* ── Contest Type Selection ── */}
            <div className="cv-cz-field">
              <label className="cv-cz-label">Contest Type *</label>
              <div className="cv-cz-type-selector">
                {/* Private option */}
                <div
                  className={`cv-cz-type-option${form.type === 'private' ? ' active' : ''}`}
                  onClick={() => set('type', 'private')}
                >
                  <div className="cv-cz-type-option__icon">🔒</div>
                  <div className="cv-cz-type-option__info">
                    <div className="cv-cz-type-option__name">Private Contest</div>
                    <div className="cv-cz-type-option__desc">
                      Invite-only via Room ID. All eligible users can create.
                    </div>
                  </div>
                  <div className={`cv-cz-type-option__radio${form.type === 'private' ? ' checked' : ''}`} />
                </div>

                {/* Public option */}
                <div
                  className={`cv-cz-type-option${form.type === 'public' ? ' active' : ''}${!isAdvanced ? ' disabled' : ''}`}
                  onClick={() => isAdvanced && set('type', 'public')}
                  title={!isAdvanced ? 'Solve 50+ problems to unlock public contests' : ''}
                >
                  <div className="cv-cz-type-option__icon">🔓</div>
                  <div className="cv-cz-type-option__info">
                    <div className="cv-cz-type-option__name">
                      Public Contest
                      {!isAdvanced && <span className="cv-cz-type-option__lock">🔐 Locked</span>}
                    </div>
                    <div className="cv-cz-type-option__desc">
                      Open to all. Only Advanced users (50+ solved) can create.
                    </div>
                  </div>
                  <div className={`cv-cz-type-option__radio${form.type === 'public' ? ' checked' : ''}`} />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="cv-cz-field">
              <label className="cv-cz-label">Contest Title *</label>
              <input
                className="cv-input"
                placeholder="e.g. Weekly DSA Sprint #12"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="cv-cz-field">
              <label className="cv-cz-label">Description <span style={{ color: 'var(--text-faint)' }}>(optional)</span></label>
              <textarea
                className="cv-input"
                placeholder="Describe your contest — rules, theme, prizes..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                style={{ resize: 'vertical', minHeight: 60 }}
                maxLength={300}
              />
            </div>

            {/* Difficulty + Duration row */}
            <div className="cv-cz-field-row">
              <div className="cv-cz-field">
                <label className="cv-cz-label">Difficulty</label>
                <select className="cv-select" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                  <option value="mixed">🔀 Mixed</option>
                </select>
              </div>
              <div className="cv-cz-field">
                <label className="cv-cz-label">Duration</label>
                <select className="cv-select" value={form.durationMinutes} onChange={e => set('durationMinutes', e.target.value)}>
                  {[15, 30, 45, 60, 90, 120].map(v => (
                    <option key={v} value={v}>{v} minutes</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Problems + Entry fee row */}
            <div className="cv-cz-field-row">
              <div className="cv-cz-field">
                <label className="cv-cz-label">Number of Problems (1–5)</label>
                <input
                  type="number"
                  className="cv-input"
                  min={1} max={5}
                  value={form.problemCount}
                  onChange={e => set('problemCount', e.target.value)}
                />
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                  AI generates problems matching difficulty
                </div>
              </div>
              <div className="cv-cz-field">
                <label className="cv-cz-label">Entry Fee (coins)</label>
                <input
                  type="number"
                  className="cv-input"
                  min={0}
                  value={form.entryFee}
                  onChange={e => set('entryFee', e.target.value)}
                  placeholder="0 = free"
                />
                {form.entryFee > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>
                    💎 {form.platformFeePercent}% platform fee applies
                  </div>
                )}
              </div>
            </div>

            {/* Participants row */}
            <div className="cv-cz-field-row">
              <div className="cv-cz-field">
                <label className="cv-cz-label">Min Participants (2–20)</label>
                <input
                  type="number"
                  className="cv-input"
                  min={2} max={20}
                  value={form.minParticipants}
                  onChange={e => set('minParticipants', e.target.value)}
                />
                <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                  Contest starts when this many join
                </div>
              </div>
              <div className="cv-cz-field">
                <label className="cv-cz-label">Max Participants (≤20)</label>
                <input
                  type="number"
                  className="cv-input"
                  min={form.minParticipants} max={20}
                  value={form.maxParticipants}
                  onChange={e => set('maxParticipants', e.target.value)}
                />
              </div>
            </div>

            {/* Scheduled start time */}
            <div className="cv-cz-field">
              <label className="cv-cz-label">
                <Icon name="calendar" size={12} style={{ marginRight: 4 }} />
                Scheduled Start <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="datetime-local"
                  className="cv-input"
                  value={form.scheduledStartAt}
                  onChange={e => set('scheduledStartAt', e.target.value)}
                  min={getMinDateTime()}
                  style={{ flex: 1 }}
                />
                {form.scheduledStartAt && (
                  <button
                    className="cv-btn cv-btn-ghost cv-btn-sm"
                    onClick={() => set('scheduledStartAt', '')}
                    title="Clear scheduled time"
                    type="button"
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                {form.scheduledStartAt
                  ? `⏰ Contest will start at ${new Date(form.scheduledStartAt).toLocaleString()}`
                  : '💡 Leave empty to start when enough players join'}
              </div>
            </div>

            {/* Prize pool preview */}
            {form.entryFee > 0 && (
              <div className="cv-cz-prize-preview">
                <div className="cv-cz-prize-preview__row">
                  <span>Entry fee per player</span>
                  <span>💎 {form.entryFee} coins</span>
                </div>
                <div className="cv-cz-prize-preview__row">
                  <span>Max players</span>
                  <span>{form.maxParticipants}</span>
                </div>
                <div className="cv-cz-prize-preview__row">
                  <span>Platform fee ({form.platformFeePercent}%)</span>
                  <span style={{ color: 'var(--text-dim)' }}>
                    −{Math.floor(Number(form.entryFee) * Number(form.maxParticipants) * (Number(form.platformFeePercent) / 100))} coins
                  </span>
                </div>
                <div className="cv-cz-prize-preview__divider" />
                <div className="cv-cz-prize-preview__row cv-cz-prize-preview__total">
                  <span>🏆 Estimated Prize Pool</span>
                  <span style={{ color: 'var(--gold)' }}>{estPrizePool} coins</span>
                </div>
              </div>
            )}

            {/* Validation warnings */}
            {form.type === 'public' && !isAdvanced && (
              <div className="cv-cz-modal-error">
                🔐 You need Advanced status (50+ problems solved) to create public contests. Try creating a private contest instead!
              </div>
            )}

            {/* Actions */}
            <div className="cv-cz-modal-actions" style={{ marginTop: 8 }}>
              <button className="cv-btn cv-btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="cv-btn cv-btn-primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{ padding: '10px 24px' }}
              >
                {loading ? (
                  <>⏳ Creating…</>
                ) : (
                  <><Icon name="zap" size={13} /> Create {form.type === 'private' ? 'Private' : 'Public'} Contest</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
