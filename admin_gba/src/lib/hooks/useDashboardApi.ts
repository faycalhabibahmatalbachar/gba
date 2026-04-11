'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export type DashboardApiPayload = {
  chartDays: number;
  updatedAt: string;
  kpisToday: {
    orders: number;
    revenue: number;
    newUsers: number;
    avgBasket: number;
    deliverySuccessRate: number;
  };
  yesterdayKpis: {
    orders: number;
    revenue: number;
    newUsers: number;
    avgBasket: number;
  };
  weekAvgBasket: number;
  sparklines: {
    revenue7d: number[];
    orders7d: number[];
    newUsers7d: number[];
  };
  windowSummary?: { orders: number; revenue: number };
  windowMeta?: { start: string; end: string; sampledOrders: number };
  revenueSeries: { date: string; revenue: number }[];
  revenuePrevYearSeries: { date: string; revenue: number }[];
  ordersByStatus: { status: string; statusLabel?: string; count: number }[];
  ordersStackedDaily: {
    date: string;
    dateKey: string;
    pending: number;
    confirmed: number;
    delivered: number;
    cancelled: number;
  }[];
  orderHourHeatmap: { hour: string; count: number }[];
  topProducts: { id?: string | null; name: string; fullName?: string; sales: number }[];
  topProductsWeek: {
    id?: string | null;
    name: string;
    fullName?: string;
    sales: number;
    revenue?: number;
    imageUrl?: string | null;
  }[];
  funnel: { name: string; value: number }[];
  geoSales: { country: string; orders: number }[];
  geoTop5: { country: string; orders: number }[];
  bigData: {
    avgLtv: number;
    repeatPurchaseRate: number;
    reviewAvg: number;
    reviewCount: number;
    ltvDeltaPct: number | null;
    repeatDeltaPts: number | null;
    reviewDeltaPts: number | null;
    cohortRetentionRows: {
      cohortLabel: string;
      cohortKey: string;
      size: number;
      m1: number | null;
      m2: number | null;
      m3: number | null;
    }[];
    ordersUsedInCohortSample: number;
    topDriversMonth: {
      id: string;
      name: string;
      deliveries: number;
      earningsMonth: number;
      ratingAvg: number | null;
      avatarUrl: string | null;
    }[];
    topProductsMonth: {
      id: string;
      name: string;
      fullName: string;
      sales: number;
      revenue: number;
      imageUrl: string | null;
    }[];
  };
  activity: {
    recentOrders: Record<string, unknown>[];
    newSignups: Record<string, unknown>[];
  };
  alerts: {
    criticalStockCount: number;
    criticalStockSample: Record<string, unknown>[];
    pendingOver2h: number;
    oneStarReviews: number;
    failedPaymentsToday: number;
  };
};

export function useDashboardApi(days: 7 | 30 | 90) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['dashboard-api', days],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard?days=${days}`, { credentials: 'include' });
      if (r.status === 503) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || 'Service role non configuré');
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      return r.json() as Promise<DashboardApiPayload>;
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 1,
  });

  useEffect(() => {
    const ch = supabase
      .channel('dash-api-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-api'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-api'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return q;
}
