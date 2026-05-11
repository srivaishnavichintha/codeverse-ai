// frontend/src/components/profile/cards/SubmissionsCard.jsx
import { Card, CardTitle } from '../Card';
import { fmtNum } from '../../../utils/format';

function Bar({ label, value, max, color }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs opacity-80 mb-1">
        <span>{label}</span><span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function SubmissionsCard({ data }) {
  const s = data || { easy: 0, medium: 0, hard: 0, total: 0, accepted: 0, accuracy: 0 };
  const max = Math.max(s.easy, s.medium, s.hard, 1);
  return (
    <Card>
      <CardTitle action={<span className="text-xs opacity-70">Accuracy <b className="cv-grad-text">{s.accuracy}%</b></span>}>
        Problems Solved
      </CardTitle>
      <div className="flex items-end gap-4 mb-4">
        <div>
          <div className="text-4xl font-extrabold cv-grad-text leading-none">{fmtNum(s.accepted)}</div>
          <div className="text-xs opacity-70">accepted of {fmtNum(s.total)} attempts</div>
        </div>
      </div>
      <div className="space-y-3">
        <Bar label="Easy" value={s.easy} max={max} color="linear-gradient(90deg,#10b981,#34d399)" />
        <Bar label="Medium" value={s.medium} max={max} color="linear-gradient(90deg,#f59e0b,#fbbf24)" />
        <Bar label="Hard" value={s.hard} max={max} color="linear-gradient(90deg,#f43f5e,#ec4899)" />
      </div>
    </Card>
  );
}
