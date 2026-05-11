// frontend/src/components/profile/cards/SkillsCard.jsx
import { Card, CardTitle } from '../Card';

const CAT_COLOR = {
  dsa: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
  frontend: 'linear-gradient(90deg,#06b6d4,#3b82f6)',
  backend: 'linear-gradient(90deg,#10b981,#06b6d4)',
  aiml: 'linear-gradient(90deg,#f43f5e,#8b5cf6)',
  devops: 'linear-gradient(90deg,#f59e0b,#f43f5e)',
  language: 'linear-gradient(90deg,#8b5cf6,#06b6d4)',
};

export function SkillsCard({ skills = [] }) {
  return (
    <Card>
      <CardTitle>Skill Ecosystem</CardTitle>
      <div className="space-y-3">
        {skills.map((s) => (
          <div key={s.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">{s.name}</span>
              <span className="opacity-70">{s.proficiency}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${s.proficiency}%`, background: CAT_COLOR[s.category] || CAT_COLOR.dsa }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
