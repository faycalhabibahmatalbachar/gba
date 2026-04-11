'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';

const PRIMARY = '#6C47FF';

type Props = {
  data: number[];
  className?: string;
};

export function MiniSparkline({ data, className }: Props) {
  const pts = (data.length ? data : [0]).map((v, i) => ({ i, v: Number(v) || 0 }));
  return (
    <div className={className} style={{ width: 60, height: 28 }}>
      <ResponsiveContainer width={60} height={28}>
        <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="miniSpark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.25} />
              <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={PRIMARY} strokeWidth={1.5} fill="url(#miniSpark)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
