/**
 * ContestStatsBar.jsx
 * Top stats grid shown on the ContestZone listing page.
 */
export default function ContestStatsBar({ contests, total }) {
  const live    = contests.filter(c => c.status === 'active').length;
  const waiting = contests.filter(c => ['waiting', 'filling', 'starting'].includes(c.status)).length;
  const ended   = contests.filter(c => ['completed', 'cancelled', 'expired'].includes(c.status)).length;

  const stats = [
    { emoji: '🏆', value: total,   label: 'Total Contests'  },
    { emoji: '⚡', value: live,    label: 'Live Now',        accent: live > 0 ? 'var(--easy)' : undefined },
    { emoji: '🕐', value: waiting, label: 'Upcoming'        },
    { emoji: '📜', value: ended,   label: 'Completed'       },
  ];

  return (
    <div className="cv-cz-stats-bar">
      {stats.map((s, i) => (
        <div key={i} className="cv-glass cv-cz-stat-card">
          <span className="cv-cz-stat-emoji">{s.emoji}</span>
          <div>
            <div className="cv-cz-stat-value" style={s.accent ? { color: s.accent } : {}}>
              {s.value}
            </div>
            <div className="cv-cz-stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
