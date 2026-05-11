// frontend/src/components/profile/charts/RankHistory.jsx
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardTitle } from '../Card';

export function RankHistory({ data = [] }) {
  const last = data[data.length - 1]?.rating ?? 0;
  return (
    <Card>
      <CardTitle action={<span className="text-xs opacity-70">Current: <b className="cv-grad-text">{last}</b></span>}>
        Rating Trajectory
      </CardTitle>
      <div className="w-full h-56">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(127,127,127,.15)" vertical={false} />
            <XAxis dataKey="round" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }} />
            <YAxis domain={['dataMin - 50', 'dataMax + 50']} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }} />
            <Tooltip contentStyle={{ background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: 8 }} />
            <Line type="monotone" dataKey="rating" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
