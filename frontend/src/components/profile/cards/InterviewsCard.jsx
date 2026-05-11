// frontend/src/components/profile/cards/InterviewsCard.jsx
import { Card, CardTitle } from '../Card';
import { fmtRelative } from '../../../utils/format';

function ScoreBar({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs opacity-80">{label}</span>
      <div className="flex-1 h-2 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full cv-grad-bg" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right">{value}</span>
    </div>
  );
}

export function InterviewsCard({ data }) {
  const d = data || { count: 0, avg: {}, recent: [] };
  return (
    <Card>
      <CardTitle action={<span className="text-xs opacity-70">{d.count} interviews</span>}>
        AI Interview Analytics
      </CardTitle>
      <div className="space-y-2 mb-4">
        <ScoreBar label="Overall" value={d.avg.overall || 0} />
        <ScoreBar label="Technical" value={d.avg.technical || 0} />
        <ScoreBar label="Communication" value={d.avg.communication || 0} />
        <ScoreBar label="Problem Solving" value={d.avg.problemSolving || 0} />
      </div>
      <div className="space-y-2 max-h-64 overflow-auto pr-1">
        {d.recent.slice(0, 5).map((i) => (
          <div key={i._id} className="cv-glass p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium">{i.role} · {i.topic}</div>
              <div className="cv-grad-text font-bold">{i.scores.overall}</div>
            </div>
            <div className="text-[11px] opacity-60">{fmtRelative(i.completedAt)}</div>
            <div className="text-xs mt-1 opacity-80 line-clamp-2">{i.aiFeedback}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
