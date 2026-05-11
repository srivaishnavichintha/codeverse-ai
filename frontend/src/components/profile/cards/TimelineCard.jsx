// frontend/src/components/profile/cards/TimelineCard.jsx
import { Card, CardTitle } from '../Card';
import { fmtRelative } from '../../../utils/format';

export function TimelineCard({ data = [] }) {
  return (
    <Card>
      <CardTitle>Activity Timeline</CardTitle>
      <ol className="relative border-l border-white/10 dark:border-white/10 ml-3 space-y-4">
        {data.map((t) => (
          <li key={t._id} className="ml-4">
            <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full cv-grad-bg ring-4 ring-black/5 dark:ring-white/5" />
            <div className="flex items-center gap-2 text-xs opacity-70">
              <span>{t.icon}</span><span>{t.label}</span><span>·</span><span>{fmtRelative(t.at)}</span>
            </div>
            <div className="font-medium text-sm">{t.title}</div>
            <div className="text-[11px] opacity-70">{t.meta}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
