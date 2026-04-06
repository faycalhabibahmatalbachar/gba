'use client';

import type { ReactNode } from 'react';
import CountUp from 'react-countup';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface KPICardProps {
  label: string;
  value: number;
  formatValue?: (n: number) => string;
  delta?: number;
  deltaLabel?: string;
  icon: ReactNode;
  iconColor?: string;
  iconBg?: string;
  sparklineData?: number[];
  loading?: boolean;
  className?: string;
}

export function KPICard({
  label,
  value,
  formatValue,
  delta,
  deltaLabel,
  icon,
  iconColor = 'var(--brand)',
  iconBg = 'color-mix(in srgb, var(--brand) 12%, transparent)',
  sparklineData,
  loading,
  className,
}: KPICardProps) {
  const up = delta !== undefined && delta > 0;
  const down = delta !== undefined && delta < 0;
  const format = (n: number) => (formatValue ? formatValue(n) : new Intl.NumberFormat('fr-FR').format(n));

  if (loading) {
    return (
      <div className={cn('bg-card rounded-xl border border-border p-4 animate-pulse', className)}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const chartPoints =
    sparklineData?.map((y, i) => ({ i, y })) ??
    [0, 1, 0.5, 1.2, 0.8, 1.5, 1.1].map((y, i) => ({ i, y }));

  return (
    <div className={cn('bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: iconBg, color: iconColor }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold text-foreground font-heading leading-tight mt-0.5 tabular-nums">
              <CountUp end={value} duration={0.55} decimals={0} formattingFn={format} preserveValue />
            </p>
          </div>
        </div>
        {delta !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
              up && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              down && 'bg-red-500/10 text-red-600 dark:text-red-400',
              !up && !down && 'bg-muted text-muted-foreground',
            )}
          >
            {up && <TrendingUp className="h-3 w-3" />}
            {down && <TrendingDown className="h-3 w-3" />}
            <span>{deltaLabel ?? `${delta > 0 ? '+' : ''}${delta}%`}</span>
          </div>
        )}
      </div>
      <div className="mt-3 h-10 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartPoints} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <Line type="monotone" dataKey="y" stroke="var(--brand)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
