// frontend/src/components/profile/cards/BattlesCard.jsx
import { Card, CardTitle } from '../Card';
import { fmtRelative } from '../../../utils/format';

export function BattlesCard({ data }) {
  const d = data || { wins: 0, losses: 0, total: 0, winRate: 0, longestStreak: 0, recent: [] };
  return (
    <Card>
      <CardTitle action={<span className="text-xs opacity-70">Win rate <b className="cv-grad-text">{d.winRate}%</b></span>}>
        Peer Battles
      </CardTitle>
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="rounded-lg p-2 bg-emerald-500/10 border border-emerald-500/30">
          <div className="text-xs opacity-70">Wins</div><div className="text-lg font-bold text-emerald-500">{d.wins}</div>
        </div>
        <div className="rounded-lg p-2 bg-rose-500/10 border border-rose-500/30">
          <div className="text-xs opacity-70">Losses</div><div className="text-lg font-bold text-rose-500">{d.losses}</div>
        </div>
        <div className="rounded-lg p-2 cv-grad-soft-bg">
          <div className="text-xs opacity-70">Streak</div><div className="text-lg font-bold cv-grad-text">{d.longestStreak}</div>
        </div>
      </div>
      <ul className="space-y-2 max-h-64 overflow-auto pr-1">
        {d.recent.map((b) => (
          <li key={b._id} className="flex items-center justify-between text-sm border-b border-white/5 dark:border-white/10 pb-2">
            <div className="min-w-0">
              <div className="font-medium truncate">vs @{b.opponent}</div>
              <div className="text-[11px] opacity-60">{b.problemTitle} · {fmtRelative(b.finishedAt)}</div>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${b.won ? 'text-emerald-500' : 'text-rose-500'}`}>{b.won ? 'WIN' : 'LOSS'}</div>
              <div className="text-[11px] opacity-70">{b.eloDelta >= 0 ? '+' : ''}{b.eloDelta} ELO</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
