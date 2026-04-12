'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartWrapper } from '@/components/ui/custom/ChartWrapper';
import { AuditHourlyChart } from '@/components/audit/AuditHourlyChart';
import { AuditDailyChart } from '@/components/audit/AuditDailyChart';
import type { AuditPageKpisResponse } from '@/lib/audit/audit-logger';

const PIE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#ca8a04', '#dc2626', '#64748b'];

export function AuditChartsSection() {
  const kpisQ = useQuery({
    queryKey: ['audit-page-kpis'],
    queryFn: async (): Promise<AuditPageKpisResponse> => {
      const res = await fetch('/api/audit/stats', { credentials: 'include' });
      const j = (await res.json()) as AuditPageKpisResponse & { error?: string };
      if (!res.ok || !j.kpis) {
        throw new Error(typeof j.error === 'string' ? j.error : 'Indicateurs indisponibles');
      }
      return j;
    },
    staleTime: 60_000,
  });

  const roleData = (kpisQ.data?.role_breakdown ?? []).map((r) => ({
    name: r.role || '—',
    value: r.count,
  }));

  return (
    <Tabs defaultValue="hours" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="hours">24 h</TabsTrigger>
        <TabsTrigger value="days">30 j</TabsTrigger>
        <TabsTrigger value="roles">Rôles</TabsTrigger>
      </TabsList>
      <TabsContent value="hours" className="mt-4">
        <AuditHourlyChart hours={24} />
      </TabsContent>
      <TabsContent value="days" className="mt-4">
        <AuditDailyChart days={30} />
      </TabsContent>
      <TabsContent value="roles" className="mt-4">
        <ChartWrapper
          title="Répartition par rôle (période KPI)"
          isLoading={kpisQ.isLoading}
          error={kpisQ.error}
        >
          {roleData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée de rôle pour cette période.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88}>
                  {roleData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value ?? ''}`, String(name ?? '')]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartWrapper>
      </TabsContent>
    </Tabs>
  );
}
