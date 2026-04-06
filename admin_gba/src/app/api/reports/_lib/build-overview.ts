import { format, getHours, startOfDay, startOfMonth, startOfYear, subDays } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

export type OverviewPayload = {
  generated_at: string;
  kpis: {
    revenue_today: number;
    revenue_month: number;
    revenue_year: number;
    orders_today: number;
    orders_pending: number;
    orders_in_progress: number;
    new_users_today: number;
    active_users_30d: number;
  };
  charts: {
    revenue_and_orders_30d: { day: string; revenue: number; orders: number }[];
    active_users_by_day_30d: { day: string; active: number }[];
    revenue_by_category: { category: string; revenue: number }[];
    signups_retention_hint: { day: string; signups: number }[];
  };
  live: {
    recent_orders: Record<string, unknown>[];
    recent_unread_messages: Record<string, unknown>[];
    alerts: { id: string; label: string; severity: string; count: number }[];
    drivers_online: number;
  };
};

const IN_PROGRESS = [
  'confirmed',
  'processing',
  'preparing',
  'ready',
  'shipped',
  'out_for_delivery',
  'in_transit',
  'picked_up',
];

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export async function buildReportsOverview(sb: SupabaseClient): Promise<OverviewPayload> {
  const now = new Date();
  const t0 = startOfDay(now).toISOString();
  const m0 = startOfMonth(now).toISOString();
  const y0 = startOfYear(now).toISOString();
  const d30 = subDays(now, 30).toISOString();

  const [
    ordersToday,
    ordersMonth,
    ordersYear,
    orders30,
    pendingHead,
    profilesToday,
    profiles30,
    recentOrders,
    msgUnread,
    driversLive,
    orderItems,
    alertsCritRes,
    alertsWarnRes,
  ] = await Promise.all([
    sb.from('orders').select('id, total_amount, status, created_at').gte('created_at', t0).limit(5000),
    sb.from('orders').select('total_amount').gte('created_at', m0).limit(20000),
    sb.from('orders').select('total_amount').gte('created_at', y0).limit(50000),
    sb.from('orders').select('id, total_amount, status, created_at, user_id').gte('created_at', d30).limit(12000),
    sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', t0),
    sb.from('profiles').select('id, created_at').gte('created_at', d30).limit(8000),
    sb
      .from('orders')
      .select('id, order_number, created_at, status, total_amount, customer_name')
      .order('created_at', { ascending: false })
      .limit(10),
    sb
      .from('chat_messages')
      .select('id, conversation_id, message, created_at, sender_id')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    sb.from('driver_locations').select('driver_id').limit(5000),
    sb.from('order_items').select('product_name, total_price, quantity').limit(8000),
    sb.from('system_alerts').select('id', { count: 'exact', head: true }).eq('is_resolved', false).eq('level', 'critical'),
    sb.from('system_alerts').select('id', { count: 'exact', head: true }).eq('is_resolved', false).eq('level', 'warning'),
  ]);

  const critCount = alertsCritRes.error ? 0 : alertsCritRes.count ?? 0;
  const warnCount = alertsWarnRes.error ? 0 : alertsWarnRes.count ?? 0;

  const ot = (ordersToday.data || []) as { total_amount: number | null; status: string | null }[];
  const om = (ordersMonth.data || []) as { total_amount: number | null }[];
  const oy = (ordersYear.data || []) as { total_amount: number | null }[];
  const w = (orders30.data || []) as {
    total_amount: number | null;
    status: string | null;
    created_at: string;
    user_id: string | null;
  }[];

  const revenueToday = sum(ot.map((o) => Number(o.total_amount || 0)));
  const revenueMonth = sum(om.map((o) => Number(o.total_amount || 0)));
  const revenueYear = sum(oy.map((o) => Number(o.total_amount || 0)));

  const inProg = w.filter((o) => IN_PROGRESS.includes(String(o.status || ''))).length;

  const byDayRev: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 29; i >= 0; i--) {
    byDayRev[format(subDays(now, i), 'yyyy-MM-dd')] = { revenue: 0, orders: 0 };
  }
  for (const o of w) {
    const day = format(new Date(o.created_at), 'yyyy-MM-dd');
    if (!byDayRev[day]) continue;
    byDayRev[day].revenue += Number(o.total_amount || 0);
    byDayRev[day].orders += 1;
  }

  const signupsByDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    signupsByDay[format(subDays(now, i), 'yyyy-MM-dd')] = 0;
  }
  const profRows = (profiles30.data || []) as { created_at: string }[];
  for (const p of profRows) {
    const day = format(new Date(p.created_at), 'yyyy-MM-dd');
    if (day in signupsByDay) signupsByDay[day] += 1;
  }

  const userDays = new Set<string>();
  for (const o of w) {
    if (o.user_id) userDays.add(`${o.user_id}|${format(new Date(o.created_at), 'yyyy-MM-dd')}`);
  }
  const activeByDay: Record<string, Set<string>> = {};
  for (const key of userDays) {
    const [uid, day] = key.split('|');
    if (!activeByDay[day]) activeByDay[day] = new Set();
    activeByDay[day].add(uid);
  }

  const items = (orderItems.data || []) as {
    product_name?: string;
    total_price?: number;
    quantity?: number;
  }[];
  const catRev: Record<string, number> = {};
  for (const it of items) {
    const name = (it.product_name || 'Produit').trim();
    const c = name.length > 24 ? `${name.slice(0, 22)}…` : name;
    catRev[c] = (catRev[c] || 0) + Number(it.total_price ?? 0) * Number(it.quantity ?? 1);
  }
  const revenue_by_category = Object.entries(catRev)
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const driversRows = (driversLive.data || []) as { driver_id?: string }[];
  const uniqueDrivers = new Set(driversRows.map((r) => r.driver_id).filter(Boolean));

  return {
    generated_at: now.toISOString(),
    kpis: {
      revenue_today: revenueToday,
      revenue_month: revenueMonth,
      revenue_year: revenueYear,
      orders_today: ot.length,
      orders_pending: pendingHead.count ?? 0,
      orders_in_progress: inProg,
      new_users_today: profilesToday.count ?? 0,
      active_users_30d: new Set(w.map((x) => x.user_id).filter(Boolean)).size,
    },
    charts: {
      revenue_and_orders_30d: Object.entries(byDayRev).map(([day, v]) => ({
        day: format(new Date(day + 'T12:00:00'), 'dd/MM'),
        revenue: v.revenue,
        orders: v.orders,
      })),
      active_users_by_day_30d: Object.keys(signupsByDay).map((day) => ({
        day: format(new Date(day + 'T12:00:00'), 'dd/MM'),
        active: activeByDay[day]?.size ?? 0,
      })),
      revenue_by_category,
      signups_retention_hint: Object.entries(signupsByDay).map(([day, signups]) => ({
        day: format(new Date(day + 'T12:00:00'), 'dd/MM'),
        signups,
      })),
    },
    live: {
      recent_orders: (recentOrders.data || []) as Record<string, unknown>[],
      recent_unread_messages: (msgUnread.data || []) as Record<string, unknown>[],
      alerts: [
        {
          id: 'crit',
          label: 'Alertes critiques ouvertes',
          severity: 'critical',
          count: critCount,
        },
        {
          id: 'warn',
          label: 'Alertes warning ouvertes',
          severity: 'warning',
          count: warnCount,
        },
      ],
      drivers_online: uniqueDrivers.size,
    },
  };
}

/** Matrice 7×24 pour heatmap commandes (réutilisable par l’onglet Commandes). */
export function ordersHeatMatrixFromWindow(
  orders: { created_at: string }[],
): { matrix: number[][]; max: number } {
  const heatDayHour: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of orders) {
    const dt = new Date(o.created_at);
    heatDayHour[dt.getDay()][getHours(dt)] += 1;
  }
  let max = 0;
  for (const row of heatDayHour) for (const v of row) if (v > max) max = v;
  return { matrix: heatDayHour, max: max || 1 };
}
