'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardApi } from '@/lib/hooks/useDashboardApi';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { DashboardHeader } from './_components/DashboardHeader';
import { DashboardAlerts, type DashboardAlertItem } from './_components/DashboardAlerts';
import { DashboardKPICards } from './_components/DashboardKPICards';
import { DashboardQuickActions } from './_components/DashboardQuickActions';
import { DashboardCharts } from './_components/DashboardCharts';
import { DashboardActivityFeed } from './_components/DashboardActivityFeed';
import { DashboardBigData } from './_components/DashboardBigData';

async function fetchDashboardAlerts() {
  const r = await fetch('/api/dashboard/alerts', { credentials: 'include' });
  if (!r.ok) return { pending_stale_count: 0, chat_unread_conversations: 0 };
  return r.json() as Promise<{ pending_stale_count?: number; chat_unread_conversations?: number }>;
}

async function fetchLiveDrivers() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('driver_locations')
    .select('driver_id', { count: 'exact', head: true })
    .gte('captured_at', tenMinAgo);
  if (error) return null;
  return count ?? 0;
}

export default function DashboardPage() {
  const [chartDays, setChartDays] = useState<7 | 30 | 90>(30);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data, isLoading, error, refetch, isFetching, isError, dataUpdatedAt } = useDashboardApi(chartDays);

  useEffect(() => {
    if (data?.updatedAt) setLastUpdated(new Date(data.updatedAt));
    else if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [data?.updatedAt, dataUpdatedAt]);

  useEffect(() => {
    if (isError && error) toast.error((error as Error).message);
  }, [isError, error]);

  const alertsApi = useQuery({
    queryKey: ['dash-alerts-extra'],
    queryFn: fetchDashboardAlerts,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const liveDrivers = useQuery({
    queryKey: ['dash-live-drivers'],
    queryFn: fetchLiveDrivers,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const mergedAlerts: DashboardAlertItem[] = useMemo(() => {
    const a = data?.alerts;
    const out: DashboardAlertItem[] = [];
    const ext = alertsApi.data;
    const stalePending = Math.max(ext?.pending_stale_count ?? 0, a?.pendingOver2h ?? 0);
    if (stalePending > 0) {
      out.push({
        id: 'pending-stale',
        type: 'warning',
        message: `${stalePending} commande(s) en attente depuis plus de 2h`,
        link: '/orders',
      });
    }
    if ((ext?.chat_unread_conversations ?? 0) > 0) {
      out.push({
        id: 'chat',
        type: 'info',
        message: `${ext!.chat_unread_conversations} conversation(s) avec messages non lus`,
        link: '/messages',
      });
    }
    if (a && a.criticalStockCount > 0) {
      out.push({
        id: 'stock',
        type: 'error',
        message: `${a.criticalStockCount} produit(s) en stock critique`,
        link: '/inventory',
      });
    }
    if (a && a.oneStarReviews > 0) {
      out.push({
        id: 'rev1',
        type: 'warning',
        message: `${a.oneStarReviews} avis 1★ à modérer`,
        link: '/reviews',
      });
    }
    if (a && (a.failedPaymentsToday ?? 0) > 0) {
      out.push({
        id: 'pay-fail',
        type: 'error',
        message: `${a.failedPaymentsToday} paiement(s) échoué(s) aujourd'hui`,
        link: '/orders',
      });
    }
    return out;
  }, [data?.alerts, alertsApi.data]);

  const visibleAlerts = mergedAlerts.filter((x) => !dismissed.includes(x.id));

  function exportPdf() {
    window.print();
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <DashboardHeader
        chartDays={chartDays}
        onChartDaysChange={setChartDays}
        onRefresh={() => void refetch()}
        isFetching={isFetching}
        lastUpdated={lastUpdated}
        onExportPdf={exportPdf}
      />

      <div className="print:hidden">
        <DashboardAlerts items={visibleAlerts} onDismiss={(id) => setDismissed((p) => [...p, id])} />
      </div>

      <DashboardKPICards
        data={data}
        loading={isLoading}
        activeDrivers={liveDrivers.data ?? null}
      />

      <div className="print:hidden">
        <DashboardQuickActions stockAlert={(data?.alerts.criticalStockCount ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 print:block">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <DashboardCharts data={data} loading={isLoading} chartDays={chartDays} onRetry={() => void refetch()} />
        </div>
        <div className="min-w-0 lg:col-span-1">
          <DashboardActivityFeed
            orders={data?.activity.recentOrders ?? []}
            signups={data?.activity.newSignups ?? []}
            loading={isLoading}
          />
        </div>
      </div>

      <div className="print:hidden">
        <DashboardBigData data={data} />
      </div>
    </div>
  );
}
