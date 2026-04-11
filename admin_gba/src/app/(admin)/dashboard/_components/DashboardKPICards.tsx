'use client';

import { motion } from 'framer-motion';
import type { DashboardApiPayload } from '@/lib/hooks/useDashboardApi';
import { MiniSparkline } from './MiniSparkline';
import { deltaPct, fmtCurrencyXof } from './dashboard-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Truck } from 'lucide-react';

type Props = {
  data: DashboardApiPayload | undefined;
  loading: boolean;
  activeDrivers: number | null;
};

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const d = deltaPct(cur, prev);
  const up = d > 0;
  const down = d < 0;
  return (
    <span
      className={cn(
        'font-mono text-[11px] font-medium tabular-nums',
        up && 'text-emerald-600 dark:text-emerald-400',
        down && 'text-red-600 dark:text-red-400',
        !up && !down && 'text-muted-foreground',
      )}
    >
      {up ? '↑' : down ? '↓' : '→'} {d > 0 ? '+' : ''}
      {d}% vs veille
    </span>
  );
}

export function DashboardKPICards({ data, loading, activeDrivers }: Props) {
  const kt = data?.kpisToday;
  const y = data?.yesterdayKpis;
  const sp = data?.sparklines;

  const basket7d =
    sp?.revenue7d.map((r, i) => {
      const o = sp.orders7d[i] || 0;
      return o > 0 ? r / o : 0;
    }) ?? [];

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      key: 'rev',
      label: 'CHIFFRE D\'AFFAIRES',
      value: kt ? fmtCurrencyXof(kt.revenue) : '—',
      delta: y && kt ? <Delta cur={kt.revenue} prev={y.revenue} /> : null,
      spark: sp?.revenue7d,
    },
    {
      key: 'ord',
      label: 'COMMANDES',
      value: kt ? String(kt.orders) : '—',
      delta: y && kt ? <Delta cur={kt.orders} prev={y.orders} /> : null,
      spark: sp?.orders7d,
    },
    {
      key: 'basket',
      label: 'PANIER MOYEN',
      value: kt ? fmtCurrencyXof(kt.avgBasket) : '—',
      delta:
        y && kt && data?.weekAvgBasket ? (
          <span
            className={cn(
              'font-mono text-[11px] font-medium tabular-nums',
              deltaPct(kt.avgBasket, data.weekAvgBasket) >= 0 ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {deltaPct(kt.avgBasket, data.weekAvgBasket) >= 0 ? '↑' : '↓'}{' '}
            {deltaPct(kt.avgBasket, data.weekAvgBasket)}% vs moy. 7j
          </span>
        ) : null,
      spark: basket7d.length ? basket7d : sp?.revenue7d,
    },
    {
      key: 'nu',
      label: 'NOUVEAUX UTILISATEURS',
      value: kt ? String(kt.newUsers) : '—',
      delta: y && kt ? <Delta cur={kt.newUsers} prev={y.newUsers} /> : null,
      spark: sp?.newUsers7d,
    },
    {
      key: 'del',
      label: 'TAUX LIVRAISON RÉUSSIE',
      value: kt ? `${Math.round(kt.deliverySuccessRate)}%` : '—',
      delta: <span className="text-[11px] text-muted-foreground">Période : aujourd&apos;hui</span>,
      spark: undefined,
    },
    {
      key: 'drv',
      label: 'LIVREURS ACTIFS',
      value: activeDrivers != null ? String(activeDrivers) : '—',
      delta: <span className="text-[11px] text-muted-foreground">Temps réel (~10 min)</span>,
      spark: undefined,
      icon: <Truck className="h-4 w-4 text-primary" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.06 }}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#9B9BAA] dark:text-muted-foreground">
            {c.label}
          </p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="font-mono text-[28px] font-bold tabular-nums leading-none text-[#0A0A0F] dark:text-foreground">
              {c.value}
            </p>
            {c.spark ? <MiniSparkline data={c.spark} /> : c.icon ? <div className="pb-1 opacity-80">{c.icon}</div> : null}
          </div>
          <div className="mt-2 min-h-[16px]">{c.delta}</div>
        </motion.div>
      ))}
    </div>
  );
}
