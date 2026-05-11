// frontend/src/components/profile/cards/AchievementsCard.jsx
import { motion } from 'framer-motion';
import { Card, CardTitle } from '../Card';

const RARITY = {
  common: { ring: 'ring-slate-400/40', glow: 'shadow-slate-500/20', label: 'Common' },
  rare: { ring: 'ring-cyan-400/60', glow: 'shadow-cyan-500/30', label: 'Rare' },
  epic: { ring: 'ring-violet-400/70', glow: 'shadow-violet-500/40', label: 'Epic' },
  legendary: { ring: 'ring-amber-400/80', glow: 'shadow-amber-500/60', label: 'Legendary' },
};

export function AchievementsCard({ data = [] }) {
  return (
    <Card>
      <CardTitle action={<span className="text-xs opacity-70">{data.length} unlocked</span>}>
        Achievements
      </CardTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {data.map((a, i) => {
          const r = RARITY[a.rarity] || RARITY.common;
          return (
            <motion.div
              key={a._id || a.code}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 220 }}
              className={`cv-glass p-3 text-center ring-1 ${r.ring} shadow-lg ${r.glow}`}
            >
              <div className="text-3xl mb-1">{a.icon || '🏅'}</div>
              <div className="text-xs font-semibold truncate">{a.title}</div>
              <div className="text-[10px] opacity-60 line-clamp-2 min-h-[2.2em]">{a.description}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider cv-grad-text font-semibold">{r.label}</div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
