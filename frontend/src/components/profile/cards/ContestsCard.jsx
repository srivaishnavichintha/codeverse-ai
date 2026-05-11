// frontend/src/components/profile/cards/ContestsCard.jsx
import { Card, CardTitle } from '../Card';
import { fmtDate, fmtNum } from '../../../utils/format';

export function ContestsCard({ data }) {
  const totals = data?.totals || {};
  const recent = data?.recent || [];
  return (
    <Card>
      <CardTitle action={<span className="text-xs opacity-70">{totals.participated} participated</span>}>
        Contest Performance
      </CardTitle>
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="cv-grad-soft-bg rounded-lg p-3">
          <div className="text-xs opacity-70">Best Rank</div>
          <div className="text-lg font-bold cv-grad-text">#{fmtNum(totals.bestRank)}</div>
        </div>
        <div className="cv-grad-soft-bg rounded-lg p-3">
          <div className="text-xs opacity-70">Avg Rank</div>
          <div className="text-lg font-bold">#{fmtNum(totals.avgRank)}</div>
        </div>
        <div className="cv-grad-soft-bg rounded-lg p-3">
          <div className="text-xs opacity-70">Total Score</div>
          <div className="text-lg font-bold">{fmtNum(totals.totalScore)}</div>
        </div>
      </div>
      <ul className="space-y-2 max-h-72 overflow-auto pr-1">
        {recent.map((c) => (
          <li key={c._id} className="flex items-center justify-between text-sm border-b border-white/5 dark:border-white/10 pb-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{c.contestTitle}</div>
              <div className="text-[11px] opacity-60">{fmtDate(c.finishedAt)} · {c.type}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">#{fmtNum(c.rank)}<span className="opacity-60 text-[11px]"> / {fmtNum(c.totalParticipants)}</span></div>
              <div className={`text-[11px] ${c.deltaRating >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {c.deltaRating >= 0 ? '+' : ''}{c.deltaRating}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
