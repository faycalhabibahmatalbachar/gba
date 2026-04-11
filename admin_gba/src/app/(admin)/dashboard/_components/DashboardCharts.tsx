'use client';

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { DashboardApiPayload } from '@/lib/hooks/useDashboardApi';
import { fmtCurrencyXof } from './dashboard-utils';
import { cn } from '@/lib/utils';

const VIOLET = '#6C47FF';
const STACK = {
  pending: '#94A3B8',
  confirmed: '#8B5CF6',
  delivered: '#10B981',
  cancelled: '#F43F5E',
};

type Props = {
  data: DashboardApiPayload | undefined;
  loading: boolean;
  chartDays: 7 | 30 | 90;
  onRetry?: () => void;
};

export function DashboardCharts({ data, loading, chartDays, onRetry }: Props) {
  const rev = data?.revenueSeries ?? [];
  const prevY = data?.revenuePrevYearSeries ?? [];
  const merged = rev.map((r, i) => ({
    ...r,
    prev: prevY[i]?.revenue ?? 0,
  }));
  const stacked = data?.ordersStackedDaily ?? [];
  const geo = data?.geoTop5 ?? [];
  const funnel = data?.funnel ?? [];
  const updated = data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[320px] w-full rounded-xl" />
        <Skeleton className="h-[280px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0A0A0F] dark:text-foreground">Chiffre d&apos;affaires</h2>
            <p className="text-xs text-muted-foreground">
              {chartDays} derniers jours · Données mises à jour à {updated}
            </p>
          </div>
        </div>
        <div className="h-[260px] w-full bg-background">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="caFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={VIOLET} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={VIOLET} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-foreground/5" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground/40" />
              <YAxis hide />
              <RechartsTooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => fmtCurrencyXof(Number(v ?? 0))}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="CA"
                stroke={VIOLET}
                strokeWidth={2}
                fill="url(#caFill)"
                isAnimationActive
                animationDuration={600}
              />
              <Line
                type="monotone"
                dataKey="prev"
                name="N-1"
                stroke="#9CA3AF"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive
                animationDuration={600}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Commandes par statut</h2>
          <p className="text-xs text-muted-foreground">Barres empilées par jour</p>
        </div>
        <div className="h-[260px] w-full bg-background">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stacked} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-foreground/5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="currentColor" className="text-muted-foreground/40" />
              <YAxis hide />
              <RechartsTooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="pending" stackId="s" fill={STACK.pending} name="En attente" />
              <Bar dataKey="confirmed" stackId="s" fill={STACK.confirmed} name="En cours" />
              <Bar dataKey="delivered" stackId="s" fill={STACK.delivered} name="Livrées" />
              <Bar dataKey="cancelled" stackId="s" fill={STACK.cancelled} name="Annulées" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Répartition géographique</h2>
          <p className="text-xs text-muted-foreground">Top 5 zones (pays)</p>
        </div>
        <div className="h-[200px] w-full bg-background">
          {geo.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucune donnée sur cette période</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={geo} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-foreground/5" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="country" width={88} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <RechartsTooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="orders" fill={VIOLET} radius={[0, 4, 4, 0]} name="Commandes" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Entonnoir opérationnel</h2>
          <p className="text-xs text-muted-foreground">Période sélectionnée</p>
        </div>
        {funnel.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            Aucune donnée
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Réessayer
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-2">
            {funnel.map((step, i) => {
              const maxV = Math.max(...funnel.map((f) => f.value), 1);
              const next = funnel[i + 1];
              const rate =
                next && step.value > 0 ? Math.round((next.value / step.value) * 100) : null;
              return (
                <div key={step.name} className="flex flex-1 min-w-[72px] flex-col items-center gap-1">
                  <span className="font-mono text-sm font-bold tabular-nums text-foreground">{step.value}</span>
                  <div
                    className="w-full max-w-[100px] rounded-md bg-primary/80"
                    style={{ height: Math.max(12, (step.value / maxV) * 72) }}
                  />
                  <span className="text-center text-[10px] text-muted-foreground leading-tight">{step.name}</span>
                  {rate != null ? <span className="text-[9px] text-muted-foreground">{rate}% →</span> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
