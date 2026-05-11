// frontend/src/components/profile/charts/SkillRadar.jsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardTitle } from '../Card';

export function SkillRadar({ skills = [] }) {
  const data = skills.slice(0, 8).map((s) => ({ subject: s.name, A: s.proficiency }));
  return (
    <Card>
      <CardTitle>Skill Radar</CardTitle>
      <div className="w-full h-72">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="rgba(127,127,127,.25)" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.8 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip />
            <Radar dataKey="A" stroke="#6366f1" fill="url(#radarGrad)" fillOpacity={0.6} />
            <defs>
              <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.4} />
              </linearGradient>
            </defs>
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
