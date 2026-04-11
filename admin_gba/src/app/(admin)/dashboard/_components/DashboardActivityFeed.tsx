'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtCurrencyXof, initials, relativeTimeFr } from './dashboard-utils';
import { cn } from '@/lib/utils';

type Props = {
  orders: Record<string, unknown>[];
  signups: Record<string, unknown>[];
  loading: boolean;
};

async function fetchActivityPulse() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('driver_locations')
    .select('driver_id', { count: 'exact', head: true })
    .gte('captured_at', tenMinAgo);
  return count ?? 0;
}

export function DashboardActivityFeed({ orders, signups, loading }: Props) {
  const router = useRouter();
  const pulse = useQuery({
    queryKey: ['dash-activity-pulse'],
    queryFn: fetchActivityPulse,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const orderRows = orders.slice(0, 10);
  const signupRows = signups.slice(0, 5);

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
        </div>
        <span className="text-[11px] text-muted-foreground">Livreurs GPS ~10 min : {pulse.data ?? '—'}</span>
      </div>

      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Dernières commandes</h2>
        <p className="text-xs text-muted-foreground">Les plus récentes en premier</p>
      </div>
      <ul className="max-h-[280px] divide-y divide-border overflow-y-auto">
        {loading && !orders.length
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="px-4 py-3">
                <Skeleton className="h-10 w-full" />
              </li>
            ))
          : orderRows.map((raw) => {
              const o = raw as {
                id: string;
                order_number?: string | null;
                created_at?: string;
                status?: string | null;
                total_amount?: number | null;
                customer_name?: string | null;
              };
              return (
              <li key={o.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => router.push(`/orders?focus=${o.id}`)}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
                  >
                    {initials(o.customer_name, undefined)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-foreground">{o.customer_name || '—'}</div>
                    <div className="text-[11px] text-[#9B9BAA]">
                      {o.created_at ? relativeTimeFr(o.created_at) : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums">
                      {fmtCurrencyXof(Number(o.total_amount || 0))}
                    </div>
                    <StatusBadge status={String(o.status || 'pending')} size="sm" />
                  </div>
                </button>
              </li>
            );
            })}
        {!loading && orderRows.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune commande</li>
        ) : null}
      </ul>

      <div className="my-1 h-px bg-border" />

      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold">Inscriptions aujourd&apos;hui</h2>
      </div>
      <ul className="max-h-[200px] flex-1 divide-y divide-border overflow-y-auto">
        {signupRows.length === 0 && !loading ? (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune inscription aujourd&apos;hui</li>
        ) : (
          signupRows.map((raw) => {
            const p = raw as {
              id: string;
              created_at?: string;
              email?: string | null;
              first_name?: string | null;
              last_name?: string | null;
              role?: string | null;
            };
            const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '—';
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                  {initials(name, p.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.email}</div>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    p.role === 'admin' || p.role === 'superadmin'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {p.role || 'client'}
                </span>
                <span className="text-[11px] text-[#9B9BAA]">
                  {p.created_at ? relativeTimeFr(p.created_at) : ''}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
