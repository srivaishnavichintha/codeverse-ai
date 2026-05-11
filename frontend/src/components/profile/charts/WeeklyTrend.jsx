// frontend/src/components/profile/charts/WeeklyTrend.jsx
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardTitle } from '../Card';

export function WeeklyTrend({ data = [] }) {
  // Backend may emit numeric ISO week numbers; mock emits "W1".. — normalize.
  const series = (data || []).map((d, i) => ({
    ...d,
    week: typeof d.week === 'number' ? `W${i + 1}` : d.week || `W${i + 1}`,
    solved: Number(d.solved) || 0,
    attempts: Number(d.attempts) || 0,
  }));
  return (
    <Card>
      <CardTitle>Weekly Performance</CardTitle>
      <div className="w-full h-64">
        <ResponsiveContainer>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="solvedG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="attG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(127,127,127,.15)" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }} />
            <YAxis tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }} />
            <Tooltip contentStyle={{ background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: 8 }} />
            <Area type="monotone" dataKey="attempts" stroke="#06b6d4" fill="url(#attG)" />
            <Area type="monotone" dataKey="solved" stroke="#6366f1" fill="url(#solvedG)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
