// frontend/src/components/profile/charts/TopicBars.jsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Card, CardTitle } from '../Card';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];

export function TopicBars({ data = [] }) {
  const top = data.slice(0, 8);
  return (
    <Card>
      <CardTitle>Topic Mastery</CardTitle>
      <div className="w-full h-64">
        <ResponsiveContainer>
          <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke="rgba(127,127,127,.12)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }} />
            <YAxis type="category" dataKey="topic" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.85 }} width={90} />
            <Tooltip contentStyle={{ background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: 8 }} />
            <Bar dataKey="solved" radius={[0, 6, 6, 0]}>
              {top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
