// frontend/src/components/profile/charts/LanguageDonut.jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardTitle } from '../Card';

const COLORS = ['#6366f1', '#06b6d4', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];

export function LanguageDonut({ data = [] }) {
  const series = data.map((d) => ({ name: d.language || d.name, value: d.percent || d.count }));
  return (
    <Card>
      <CardTitle>Language Usage</CardTitle>
      <div className="w-full h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={series} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
              {series.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
            </Pie>
            <Tooltip contentStyle={{ background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
