/**
 * SubmissionPanel.jsx
 * Shows the current user's submissions for a problem in the arena.
 */
import Icon from '../../../components/Icon/Icon.jsx';

const VERDICT_COLORS = {
  accepted:  'var(--easy)',
  Accepted:  'var(--easy)',
  wrong:     'var(--rose)',
  'Wrong Answer': 'var(--rose)',
  tle:       'var(--gold)',
  'Time Limit Exceeded': 'var(--gold)',
  runtime:   'var(--amber)',
  'Runtime Error': 'var(--amber)',
  'Compilation Error': 'var(--amber)',
  pending:   'var(--text-secondary)',
  Pending:   'var(--text-secondary)',
  'Internal Error': 'var(--rose)',
};

export default function SubmissionPanel({ submissions, onClose }) {
  return (
    <div className="cv-glass cv-cz-sub-panel">
      <div className="cv-cz-sub-panel__header">
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          <Icon name="history" size={13} /> My Submissions
        </span>
        <button className="cv-btn cv-btn-ghost cv-btn-sm" onClick={onClose}>
          <Icon name="x" size={12} />
        </button>
      </div>
      {submissions.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
          No submissions yet for this problem.
        </div>
      ) : (
        submissions.map((s, i) => (
          <div key={s._id || i} className="cv-cz-sub-item">
            <span
              className="cv-cz-sub-verdict"
              style={{ color: VERDICT_COLORS[s.verdict] || 'var(--text-secondary)' }}
            >
              {(s.verdict === 'accepted' || s.verdict === 'Accepted') ? '✅' : '❌'} {s.verdict}
            </span>
            <span className="cv-cz-sub-lang">{s.language}</span>
            <span className="cv-cz-sub-time" style={{ marginLeft: 'auto' }}>
              {(s.runtimeMs || s.executionTime) ? `${s.runtimeMs || s.executionTime}ms` : '—'}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
