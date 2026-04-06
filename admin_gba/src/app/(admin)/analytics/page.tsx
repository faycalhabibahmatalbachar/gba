'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

type AnalyticsPayload = {
  periodDays: number;
  revenue: number;
  orderCount: number;
  newUsers: number;
  activeBuyers: number;
  arpu: number;
  ordersByStatus: { status: string; count: number }[];
  avgReviewRating: number;
  reviewCount: number;
  topProductsByStockRisk: { name: string; quantity: number | null }[];
  ordersLast8d: { label: string; orders: number }[];
};

async function fetchAnalytics(days: number) {
  const r = await fetch(`/api/analytics?days=${days}`, { credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<AnalyticsPayload>;
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => fetchAnalytics(days),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (q.isError && q.error) toast.error((q.error as Error).message);
  }, [q.isError, q.error]);

  const d = q.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Agrégations serveur — période ajustable"
        actions={
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList className="h-9">
              <TabsTrigger value="7" className="text-xs">
                7j
              </TabsTrigger>
              <TabsTrigger value="30" className="text-xs">
                30j
              </TabsTrigger>
              <TabsTrigger value="90" className="text-xs">
                90j
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {q.isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Revenus</div>
              <div className="text-xl font-bold">{fmtCurrency(d?.revenue ?? 0)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Commandes</div>
              <div className="text-xl font-bold">{d?.orderCount ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Nouveaux utilisateurs</div>
              <div className="text-xl font-bold">{d?.newUsers ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">ARPU (acheteurs)</div>
              <div className="text-xl font-bold">{fmtCurrency(d?.arpu ?? 0)}</div>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-sm">Commandes par statut</CardTitle>
          </CardHeader>
          <CardContent className="h-64 min-w-0">
            {q.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={d?.ordersByStatus || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={32} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-sm">Volume commandes (8 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent className="h-64 min-w-0">
            {q.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={d?.ordersLast8d || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Avis — moyenne {d?.avgReviewRating ?? '—'} ({d?.reviewCount ?? 0} avis)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Données issues de la table <code className="text-xs">reviews</code> sur la période.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stock faible (top 15)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1 max-h-48 overflow-y-auto">
          {(d?.topProductsByStockRisk || []).map((p) => (
            <div key={p.name} className="flex justify-between border-b border-border py-1">
              <span className="truncate pr-2">{p.name}</span>
              <span className="tabular-nums shrink-0">{p.quantity ?? 0}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
