'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type ChartsPayload = {
  brute_force_hourly_24h: { hour_key: string; failed: number; ok: number }[];
  actions_by_type: { action_type: string; count: number; dangerous: boolean }[];
};

export function SecurityChartsBlock() {
  const q = useQuery({
    queryKey: ['security-charts'],
    queryFn: async () => {
      const r = await fetch('/api/security/charts', { credentials: 'include' });
      const x = (await r.json()) as { data?: ChartsPayload; error?: string };
      if (!r.ok) throw new Error(x.error || 'Charts');
      return x.data!;
    },
    staleTime: 60_000,
  });

  const brute = React.useMemo(
    () =>
      (q.data?.brute_force_hourly_24h ?? []).map((r) => ({
        ...r,
        label: r.hour_key.slice(11, 16),
      })),
    [q.data?.brute_force_hourly_24h],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Tentatives connexion (24 h)</h3>
        {q.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <div className="h-[200px] w-full min-h-[200px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={brute}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <YAxis width={28} />
                <Tooltip />
                <Line type="monotone" dataKey="failed" name="Échecs" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ok" name="OK" stroke="#22c55e" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Actions audit par type (7 j)</h3>
        {q.isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <div className="h-[200px] w-full min-h-[200px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={q.data?.actions_by_type ?? []} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="action_type" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="var(--primary)">
                  {(q.data?.actions_by_type ?? []).map((e, i) => (
                    <Cell key={e.action_type + i} fill={e.dangerous ? '#ef4444' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
