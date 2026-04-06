import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconColor?: string;
  iconBg?: string;
  trend?: number; // percentage change, positive = up
  trendLabel?: string;
  /** Mini graphique optionnel (ex. sparkline Recharts) */
  sparkline?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label, value, icon, iconColor, iconBg,
  trend, trendLabel, sparkline, loading, className,
}: KpiCardProps) {
  const trendUp = trend !== undefined && trend > 0;
  const trendDown = trend !== undefined && trend < 0;

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
            <p className="text-xl font-bold text-foreground font-heading leading-tight mt-0.5">{value}</p>
          </div>
        </div>

        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
            trendUp && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            trendDown && 'bg-red-500/10 text-red-600 dark:text-red-400',
            !trendUp && !trendDown && 'bg-muted text-muted-foreground',
          )}>
            {trendUp && <TrendingUp className="h-3 w-3" />}
            {trendDown && <TrendingDown className="h-3 w-3" />}
            <span>{trendLabel || `${trend > 0 ? '+' : ''}${trend}%`}</span>
          </div>
        )}
      </div>
      {sparkline && <div className="mt-3 h-10 w-full min-w-0 opacity-90">{sparkline}</div>}
    </div>
  );
}

/** Alias export (spec naming). */
export const KPICard = KpiCard;
