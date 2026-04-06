import { NextResponse } from 'next/server';
import { subDays, startOfDay, format, getHours } from 'date-fns';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  total_amount: number | null;
  status: string | null;
  created_at: string;
  user_id?: string | null;
  shipping_country?: string | null;
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY manquant — configurez la clé serveur pour les agrégations dashboard.' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const chartDays = Math.min(90, Math.max(7, Number(searchParams.get('days') || 30)));

  const now = new Date();
  const today0 = startOfDay(now).toISOString();
  const windowStart = subDays(now, chartDays).toISOString();
  const d90 = subDays(now, 90).toISOString();

  try {
    const [
      todayOrdersRes,
      newUsersCountRes,
      newProfilesListRes,
      orders30Res,
      orderItemsRes,
      productsStockRes,
      pendingOldRes,
      badReviewsRes,
      deliveredUsersRes,
      allOrdersUsersRes,
    ] = await Promise.all([
      sb
        .from('orders')
        .select('id, total_amount, created_at')
        .gte('created_at', today0),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today0),
      sb
        .from('profiles')
        .select('id, created_at, email, first_name, last_name')
        .gte('created_at', today0)
        .order('created_at', { ascending: false })
        .limit(12),
      sb
        .from('orders')
        .select('id, total_amount, status, created_at, user_id, shipping_country')
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false })
        .limit(8000),
      sb.from('order_items').select('product_id, product_name, quantity').limit(5000),
      sb.from('products').select('id, name, quantity, sku').lt('quantity', 5).limit(300),
      sb
        .from('orders')
        .select('id, order_number, created_at', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
      sb.from('reviews').select('id', { count: 'exact', head: true }).eq('rating', 1),
      sb.from('orders').select('user_id, total_amount').eq('status', 'delivered').not('user_id', 'is', null).limit(15000),
      sb.from('orders').select('user_id').not('user_id', 'is', null).limit(15000),
    ]);

    const todayOrders = (todayOrdersRes.data || []) as OrderRow[];
    const ordersWindow = (orders30Res.data || []) as OrderRow[];
    const items = (orderItemsRes.data || []) as { product_id?: string; product_name?: string; quantity?: number }[];

    const todayRevenue = sum(todayOrders.map((o) => Number(o.total_amount || 0)));
    const todayCount = todayOrders.length;
    const avgBasketToday = todayCount > 0 ? todayRevenue / todayCount : 0;
    const newUsersToday = newUsersCountRes.count ?? 0;

    const revenueByDay: Record<string, number> = {};
    for (let i = chartDays - 1; i >= 0; i--) {
      revenueByDay[format(subDays(now, i), 'yyyy-MM-dd')] = 0;
    }
    const statusCounts: Record<string, number> = {};
    const heatHours: number[] = Array(24).fill(0);
    const geo: Record<string, number> = {};

    for (const o of ordersWindow) {
      const day = format(new Date(o.created_at), 'yyyy-MM-dd');
      if (day in revenueByDay) revenueByDay[day] += Number(o.total_amount || 0);
      const st = o.status || 'unknown';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      heatHours[getHours(new Date(o.created_at))]++;
      const c = o.shipping_country || '—';
      geo[c] = (geo[c] || 0) + 1;
    }

    const revenueSeries = Object.entries(revenueByDay).map(([date, revenue]) => ({
      date: format(new Date(date + 'T12:00:00'), 'dd/MM'),
      revenue,
    }));

    const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    const heatmapData = heatHours.map((count, hour) => ({ hour: `${hour}h`, count }));

    const productAgg: Record<string, { name: string; qty: number }> = {};
    for (const it of items) {
      const key = it.product_id || it.product_name || 'unknown';
      const name = it.product_name || key;
      if (!productAgg[key]) productAgg[key] = { name, qty: 0 };
      productAgg[key].qty += Number(it.quantity || 1);
    }
    const topProducts = Object.values(productAgg)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((p) => ({ name: p.name.length > 28 ? p.name.slice(0, 26) + '…' : p.name, sales: p.qty }));

    const totalO = ordersWindow.length;
    const pending = ordersWindow.filter((o) => o.status === 'pending').length;
    const delivered = ordersWindow.filter((o) => o.status === 'delivered').length;
    const cancelled = ordersWindow.filter((o) => o.status === 'cancelled').length;
    const inProg = ordersWindow.filter((o) =>
      ['confirmed', 'processing', 'preparing', 'ready', 'shipped', 'out_for_delivery', 'in_transit', 'picked_up'].includes(
        String(o.status || ''),
      ),
    ).length;

    const windowRevenue = ordersWindow.reduce((s, o) => s + Number(o.total_amount || 0), 0);

    const funnel = [
      { name: 'Commandes', value: totalO },
      { name: 'Traitées', value: inProg + delivered + cancelled },
      { name: 'En cours', value: inProg },
      { name: 'Livrées', value: delivered },
    ];

    const geoSales = Object.entries(geo)
      .map(([country, orders]) => ({ country, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 12);

    const du = (deliveredUsersRes.data || []) as { user_id: string; total_amount: number | null }[];
    const spendByUser: Record<string, number> = {};
    for (const r of du) {
      spendByUser[r.user_id] = (spendByUser[r.user_id] || 0) + Number(r.total_amount || 0);
    }
    const ltvValues = Object.values(spendByUser);
    const avgLtv = ltvValues.length ? sum(ltvValues) / ltvValues.length : 0;

    const urows = (allOrdersUsersRes.data || []) as { user_id: string }[];
    const orderCountByUser: Record<string, number> = {};
    for (const r of urows) {
      orderCountByUser[r.user_id] = (orderCountByUser[r.user_id] || 0) + 1;
    }
    const buyers = Object.keys(orderCountByUser).length;
    const repeaters = Object.values(orderCountByUser).filter((c) => c >= 2).length;
    const repeatRate = buyers > 0 ? repeaters / buyers : 0;

    const recentOrdersRes = await sb
      .from('orders')
      .select('id, order_number, created_at, status, total_amount, customer_name')
      .order('created_at', { ascending: false })
      .limit(12);

    const criticalStock = (productsStockRes.data || []) as { id: string; name: string; quantity: number | null; sku?: string }[];

    return NextResponse.json({
      chartDays,
      kpisToday: {
        orders: todayCount,
        revenue: todayRevenue,
        newUsers: newUsersToday,
        avgBasket: avgBasketToday,
      },
      windowSummary: { orders: totalO, revenue: windowRevenue },
      revenueSeries,
      ordersByStatus,
      orderHourHeatmap: heatmapData,
      topProducts,
      funnel,
      geoSales,
      bigData: {
        avgLtv: Math.round(avgLtv),
        repeatPurchaseRate: Math.round(repeatRate * 1000) / 1000,
        cohortNote: 'Basé sur commandes échantillon (15k max) — affinage SQL possible.',
      },
      activity: {
        recentOrders: recentOrdersRes.data || [],
        newSignups: newProfilesListRes.data || [],
      },
      alerts: {
        criticalStockCount: criticalStock.length,
        criticalStockSample: criticalStock.slice(0, 8),
        pendingOver2h: pendingOldRes.count ?? 0,
        oneStarReviews: badReviewsRes.count ?? 0,
      },
    });
  } catch (e) {
    console.error('[api/dashboard]', e);
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
