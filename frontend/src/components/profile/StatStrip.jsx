// frontend/src/components/profile/StatStrip.jsx
import { Stat } from './Stat';
import { Code2, Trophy, Brain, Swords, Flame, Target } from 'lucide-react';

export function StatStrip({ submissions, contests, interviews, battles, profile }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Stat icon={<Code2 size={18} />} label="Solved" value={submissions?.accepted} accent="#6366f1" />
      <Stat icon={<Target size={18} />} label="Accuracy" value={submissions?.accuracy ? `${submissions.accuracy}%` : '—'} accent="#06b6d4" />
      <Stat icon={<Trophy size={18} />} label="Contests" value={contests?.totals?.participated} accent="#f59e0b" />
      <Stat icon={<Brain size={18} />} label="AI Score" value={interviews?.avg?.overall} accent="#8b5cf6" />
      <Stat icon={<Swords size={18} />} label="Win Rate" value={battles?.winRate != null ? `${battles.winRate}%` : '—'} accent="#10b981" />
      <Stat icon={<Flame size={18} />} label="Streak" value={profile?.streak?.current} accent="#f43f5e" />
    </div>
  );
}
