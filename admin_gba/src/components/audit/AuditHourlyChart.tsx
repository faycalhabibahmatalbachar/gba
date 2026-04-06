'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartWrapper } from '@/components/ui/custom/ChartWrapper';

type Series = { hour_key: string; total: number; failed: number; success: number };

export function AuditHourlyChart({ hours = 24 }: { hours?: number }) {
  const q = useQuery({
    queryKey: ['audit-hourly', hours],
    queryFn: async () => {
      const r = await fetch(`/api/audit/hourly?hours=${hours}`, { credentials: 'include' });
      const j = (await r.json()) as { data?: { series?: Series[] }; error?: string };
      if (!r.ok) throw new Error(j.error || 'Erreur');
      return j.data?.series ?? [];
    },
    staleTime: 60_000,
  });

  const data = React.useMemo(
    () =>
      (q.data ?? []).map((s) => ({
        ...s,
        label: s.hour_key.slice(11, 16),
      })),
    [q.data],
  );

  return (
    <ChartWrapper title={`Volume audit par heure (${hours} h)`} isLoading={q.isLoading}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis width={28} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v, name) => [v, name === 'failed' ? 'Échecs' : name === 'success' ? 'Succès' : 'Total']}
            labelFormatter={(_, p) => (p?.[0]?.payload?.hour_key as string) || ''}
          />
          <Bar dataKey="success" stackId="a" fill="color-mix(in srgb, var(--brand) 75%, white)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="failed" stackId="a" fill="oklch(0.55 0.2 25)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
