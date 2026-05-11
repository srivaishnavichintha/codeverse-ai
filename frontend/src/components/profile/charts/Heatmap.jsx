// frontend/src/components/profile/charts/Heatmap.jsx
import { useMemo } from 'react';
import { Card, CardTitle } from '../Card';

function bucket(c) {
  if (!c) return 0;
  if (c <= 1) return 1;
  if (c <= 2) return 2;
  if (c <= 4) return 3;
  if (c <= 6) return 4;
  return 5;
}

export function Heatmap({ data = [] }) {
  const { weeks, total } = useMemo(() => {
    // Group by week (7 columns per week, 7 rows = days)
    const byDate = new Map(data.map((d) => [d.date, d.count]));
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 364);
    // align to Sunday
    start.setDate(start.getDate() - start.getDay());
    const weeks = [];
    let cur = new Date(start);
    let total = 0;
    while (cur <= today) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const key = cur.toISOString().slice(0, 10);
        const c = byDate.get(key) ?? 0;
        total += c;
        week.push({ date: key, count: c });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return { weeks, total };
  }, [data]);

  return (
    <Card>
      <CardTitle action={<span className="text-xs opacity-70">{total} contributions · last year</span>}>
        Activity Heatmap
      </CardTitle>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {w.map((d, di) => (
                <div
                  key={di}
                  title={`${d.date}: ${d.count}`}
                  className={`cv-heat-cell cv-heat-${bucket(d.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] opacity-70">
        Less
        {[0, 1, 2, 3, 4, 5].map((b) => <div key={b} className={`cv-heat-cell cv-heat-${b}`} />)}
        More
      </div>
    </Card>
  );
}
