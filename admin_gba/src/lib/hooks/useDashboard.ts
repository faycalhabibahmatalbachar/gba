'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { subDays, subHours, startOfDay, format } from 'date-fns';

export type PeriodKey = '24h' | '7d' | '30d';

function getPeriodRange(period: PeriodKey) {
  const now = new Date();
  if (period === '24h') return { dateFrom: subHours(now, 24).toISOString(), dateTo: now.toISOString() };
  if (period === '30d') return { dateFrom: subDays(now, 30).toISOString(), dateTo: now.toISOString() };
  return { dateFrom: subDays(now, 7).toISOString(), dateTo: now.toISOString() };
}

function getPrevPeriodRange(period: PeriodKey) {
  const now = new Date();
  if (period === '24h') return { dateFrom: subHours(now, 48).toISOString(), dateTo: subHours(now, 24).toISOString() };
  if (period === '30d') return { dateFrom: subDays(now, 60).toISOString(), dateTo: subDays(now, 30).toISOString() };
  return { dateFrom: subDays(now, 14).toISOString(), dateTo: subDays(now, 7).toISOString() };
}

export async function fetchDashboardData(period: PeriodKey) {
  const { dateFrom, dateTo } = getPeriodRange(period);
  const prev = getPrevPeriodRange(period);

  const [ordersRes, prevOrdersRes, productsRes, recentRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total_amount, created_at')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo),
    supabase
      .from('orders')
      .select('id, status, total_amount')
      .gte('created_at', prev.dateFrom)
      .lte('created_at', prev.dateTo),
    supabase
      .from('products')
      .select('id, quantity', { count: 'exact' }),
    supabase
      .from('orders')
      .select('id, order_number, created_at, status, total_amount, customer_name')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const orders = (ordersRes.data || []) as any[];
  const prevOrders = (prevOrdersRes.data || []) as any[];
  const products = (productsRes.data || []) as any[];
  const recentOrders = (recentRes.data || []) as any[];

  const totalOrders = orders.length;
  const prevTotalOrders = prevOrders.length;
  const revenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const pending = orders.filter(o => o.status === 'pending').length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const cancelled = orders.filter(o => o.status === 'cancelled').length;
  const inProgress = orders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status || '')).length;
  const totalProducts = productsRes.count ?? products.length;
  const outOfStock = products.filter(p => (p.quantity ?? 0) <= 0).length;
  const stockoutRate = totalProducts > 0 ? Math.round((outOfStock / totalProducts) * 100) : 0;

  const trendOrders = prevTotalOrders > 0 ? Math.round(((totalOrders - prevTotalOrders) / prevTotalOrders) * 100) : 0;
  const trendRevenue = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;

  // Build revenue series grouped by day
  const buckets: Record<string, number> = {};
  const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;
  for (let i = days; i >= 0; i--) {
    const key = format(subDays(new Date(), i), 'MM/dd');
    buckets[key] = 0;
  }
  orders.forEach(o => {
    const key = format(new Date(o.created_at), 'MM/dd');
    if (key in buckets) buckets[key] += (o.total_amount || 0);
  });
  const revenueSeries = Object.entries(buckets).map(([date, revenue]) => ({ date, revenue }));

  // Build top products from order_items if available (fallback: empty)
  let topProducts: { name: string; sales: number }[] = [];
  try {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, quantity')
      .limit(200);
    if (items && items.length > 0) {
      const agg: Record<string, number> = {};
      (items as any[]).forEach(item => {
        const name = item.product_name || 'Inconnu';
        agg[name] = (agg[name] || 0) + (item.quantity || 1);
      });
      topProducts = Object.entries(agg)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, sales]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, sales }));
    }
  } catch {
    // order_items table may not exist
  }

  return {
    kpis: { totalOrders, pending, inProgress, delivered, cancelled, revenue, stockoutRate, outOfStockCount: outOfStock, totalProducts },
    trends: { orders: trendOrders, revenue: trendRevenue },
    recentOrders,
    revenueSeries,
    topProducts,
  };
}

export function useDashboard(period: PeriodKey) {
  return useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => fetchDashboardData(period),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
