import { NextResponse } from 'next/server';
import { subDays, startOfDay, format, getHours } from 'date-fns';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { computeExtendedBigData } from '@/app/api/dashboard/_lib/business-intel';

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

function stackBucket(status: string | null | undefined): 'pending' | 'confirmed' | 'delivered' | 'cancelled' {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  if (['cancelled', 'refunded', 'returned'].includes(s)) return 'cancelled';
  if (['delivered', 'completed'].includes(s)) return 'delivered';
  if (['pending', 'payment_pending'].includes(s)) return 'pending';
  return 'confirmed';
}

function statusFrLabel(raw: string | null | undefined): string {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const labels: Record<string, string> = {
    pending: 'En attente',
    payment_pending: 'Paiement en attente',
    paid: 'Payee',
    confirmed: 'Confirmee',
    processing: 'En preparation',
    packed: 'Emballee',
    ready_to_ship: 'Prete a expedier',
    shipped: 'Expediee',
    out_for_delivery: 'En livraison',
    delivered: 'Livree',
    completed: 'Terminee',
    cancelled: 'Annulee',
    refunded: 'Remboursee',
    returned: 'Retournee',
    failed: 'Echec',
  };
  return labels[k] || (raw ? `Statut: ${raw}` : 'Inconnu');
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
  const yesterday0 = startOfDay(subDays(now, 1)).toISOString();
  const spark7Start = startOfDay(subDays(now, 7)).toISOString();
  const windowStartDate = startOfDay(subDays(now, chartDays - 1));
  const windowStart = windowStartDate.toISOString();
  const monthStart = startOfDay(subDays(now, 30)).toISOString();

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
      yesterdayOrdersRes,
      newUsersYesterdayRes,
      spark7OrdersRes,
      profiles7dRes,
      reviewsRatingsRes,
    ] = await Promise.all([
      sb
        .from('orders')
        .select('id, total_amount, created_at, status')
        .gte('created_at', today0),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today0),
      sb
        .from('profiles')
        .select('id, created_at, email, first_name, last_name, role')
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
      sb
        .from('orders')
        .select('id, total_amount, created_at, status')
        .gte('created_at', yesterday0)
        .lt('created_at', today0),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', yesterday0).lt('created_at', today0),
      sb.from('orders').select('created_at, total_amount, status').gte('created_at', spark7Start).limit(12000),
      sb.from('profiles').select('created_at').gte('created_at', spark7Start).limit(8000),
      sb.from('reviews').select('rating').limit(4000),
    ]);

    let failedPaymentsToday = 0;
    try {
      const fp = await sb
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', today0);
      if (!fp.error) failedPaymentsToday = fp.count ?? 0;
    } catch {
      failedPaymentsToday = 0;
    }

    const todayOrders = (todayOrdersRes.data || []) as OrderRow[];
    const ordersWindow = (orders30Res.data || []) as OrderRow[];
    const items = (orderItemsRes.data || []) as { product_id?: string; product_name?: string; quantity?: number }[];
    const yesterdayOrders = (yesterdayOrdersRes.data || []) as OrderRow[];
    const sparkOrders = (spark7OrdersRes.data || []) as OrderRow[];
    const profiles7d = (profiles7dRes.data || []) as { created_at: string }[];
    const reviewRows = (reviewsRatingsRes.data || []) as { rating: number | null }[];

    const todayRevenue = sum(todayOrders.map((o) => Number(o.total_amount || 0)));
    const todayCount = todayOrders.length;
    const avgBasketToday = todayCount > 0 ? todayRevenue / todayCount : 0;
    const newUsersToday = newUsersCountRes.count ?? 0;

    const delivToday = todayOrders.filter((o) => ['delivered', 'completed'].includes(String(o.status || '').toLowerCase())).length;
    const cancelToday = todayOrders.filter((o) => ['cancelled', 'refunded'].includes(String(o.status || '').toLowerCase())).length;
    const terminalToday = delivToday + cancelToday;
    const deliverySuccessRate = terminalToday > 0 ? Math.round((100 * delivToday) / terminalToday) : todayCount === 0 ? 100 : 100;

    const yRev = sum(yesterdayOrders.map((o) => Number(o.total_amount || 0)));
    const yCount = yesterdayOrders.length;
    const yAvgBasket = yCount > 0 ? yRev / yCount : 0;
    const newUsersYesterday = newUsersYesterdayRes.count ?? 0;

    const sparkDayKeys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      sparkDayKeys.push(format(subDays(now, i), 'yyyy-MM-dd'));
    }
    const revenue7d: number[] = sparkDayKeys.map(() => 0);
    const orders7d: number[] = sparkDayKeys.map(() => 0);
    const newUsers7d: number[] = sparkDayKeys.map(() => 0);
    const dayIndex = (iso: string) => sparkDayKeys.indexOf(format(new Date(iso), 'yyyy-MM-dd'));

    for (const o of sparkOrders) {
      const idx = dayIndex(o.created_at);
      if (idx < 0) continue;
      revenue7d[idx] += Number(o.total_amount || 0);
      orders7d[idx] += 1;
    }
    for (const p of profiles7d) {
      const idx = dayIndex(p.created_at);
      if (idx >= 0) newUsers7d[idx] += 1;
    }

    let weekAvgBasket = 0;
    const dailyAvgs: number[] = [];
    for (let i = 0; i < 7; i++) {
      const o = orders7d[i];
      const r = revenue7d[i];
      if (o > 0) dailyAvgs.push(r / o);
    }
    weekAvgBasket = dailyAvgs.length ? sum(dailyAvgs) / dailyAvgs.length : avgBasketToday;

    const revenueByDay: Record<string, number> = {};
    for (let i = chartDays - 1; i >= 0; i--) {
      revenueByDay[format(subDays(now, i), 'yyyy-MM-dd')] = 0;
    }
    const statusCounts: Record<string, number> = {};
    const heatHours: number[] = Array(24).fill(0);
    const geo: Record<string, number> = {};

    const stackedByDay: Record<string, { pending: number; confirmed: number; delivered: number; cancelled: number }> = {};
    for (let i = chartDays - 1; i >= 0; i--) {
      const dk = format(subDays(now, i), 'yyyy-MM-dd');
      stackedByDay[dk] = { pending: 0, confirmed: 0, delivered: 0, cancelled: 0 };
    }

    for (const o of ordersWindow) {
      const day = format(new Date(o.created_at), 'yyyy-MM-dd');
      if (day in revenueByDay) revenueByDay[day] += Number(o.total_amount || 0);
      const st = o.status || 'unknown';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      heatHours[getHours(new Date(o.created_at))]++;
      const c = o.shipping_country || '—';
      geo[c] = (geo[c] || 0) + 1;
      if (stackedByDay[day]) {
        const b = stackBucket(o.status);
        stackedByDay[day][b] += 1;
      }
    }

    const ordersStackedDaily = Object.entries(stackedByDay).map(([dateKey, v]) => ({
      date: format(new Date(dateKey + 'T12:00:00'), 'dd/MM'),
      dateKey,
      ...v,
    }));

    const revenueSeries = Object.entries(revenueByDay).map(([date, revenue]) => ({
      date: format(new Date(date + 'T12:00:00'), 'dd/MM'),
      revenue,
    }));

    const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      statusLabel: statusFrLabel(status),
      count,
    }));

    const heatmapData = heatHours.map((count, hour) => ({ hour: `${hour}h`, count }));

    const productAgg: Record<string, { name: string; qty: number; product_id: string | null }> = {};
    for (const it of items) {
      const key = it.product_id || it.product_name || 'unknown';
      const name = it.product_name || key;
      if (!productAgg[key]) productAgg[key] = { name, qty: 0, product_id: it.product_id || null };
      productAgg[key].qty += Number(it.quantity || 1);
    }
    const topProducts = Object.values(productAgg)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((p) => ({
        id: p.product_id,
        name: p.name.length > 28 ? p.name.slice(0, 26) + '…' : p.name,
        fullName: p.name,
        sales: p.qty,
      }));

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
      { name: 'Créées', value: totalO },
      { name: 'Confirmées', value: inProg + delivered + cancelled },
      { name: 'Expédiées / cours', value: inProg },
      { name: 'Livrées', value: delivered },
    ];

    const geoSales = Object.entries(geo)
      .map(([country, orders]) => ({ country, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 12);

    const geoTop5 = geoSales.slice(0, 5);

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

    const reviewRatingsNum = reviewRows.map((r) => Number(r.rating)).filter((n) => !Number.isNaN(n));
    const reviewAvg =
      reviewRatingsNum.length > 0 ? Math.round((sum(reviewRatingsNum) / reviewRatingsNum.length) * 10) / 10 : 0;

    let bigDataPayload: Awaited<ReturnType<typeof computeExtendedBigData>>;
    try {
      bigDataPayload = await computeExtendedBigData(sb, now, monthStart, {
        baseAvgLtv: Math.round(avgLtv),
        baseRepeat: repeatRate,
        baseReviewAvg: reviewAvg,
      });
    } catch (be) {
      console.error('[api/dashboard] business-intel', be);
      bigDataPayload = {
        avgLtv: Math.round(avgLtv),
        repeatPurchaseRate: Math.round(repeatRate * 1000) / 1000,
        reviewAvg,
        reviewCount: 0,
        ltvDeltaPct: null,
        repeatDeltaPts: null,
        reviewDeltaPts: null,
        cohortRetentionRows: [],
        ordersUsedInCohortSample: 0,
        topDriversMonth: [],
        topProductsMonth: [],
      };
    }

    const topProductsWeek =
      bigDataPayload.topProductsMonth.length > 0
        ? bigDataPayload.topProductsMonth.map((p) => ({
            id: p.id,
            name: p.name,
            fullName: p.fullName,
            sales: p.sales,
            revenue: p.revenue,
            imageUrl: p.imageUrl,
          }))
        : topProducts.slice(0, 3).map((p) => ({
            id: p.id,
            name: p.name,
            fullName: p.fullName,
            sales: p.sales,
            revenue: 0,
            imageUrl: null as string | null,
          }));

    const recentOrdersRes = await sb
      .from('orders')
      .select('id, order_number, created_at, status, total_amount, customer_name')
      .order('created_at', { ascending: false })
      .limit(12);

    const criticalStock = (productsStockRes.data || []) as { id: string; name: string; quantity: number | null; sku?: string }[];

    const pyStart = startOfDay(subDays(now, chartDays - 1 + 365));
    const pyEnd = startOfDay(subDays(now, 365));
    let revenuePrevYearSeries: { date: string; revenue: number }[] = [];
    try {
      const prevRes = await sb
        .from('orders')
        .select('created_at, total_amount')
        .gte('created_at', pyStart.toISOString())
        .lte('created_at', pyEnd.toISOString())
        .limit(8000);
      const byPyDay: Record<string, number> = {};
      for (let i = chartDays - 1; i >= 0; i--) {
        byPyDay[format(subDays(now, i + 365), 'yyyy-MM-dd')] = 0;
      }
      for (const o of (prevRes.data || []) as { created_at: string; total_amount: number | null }[]) {
        const d = format(new Date(o.created_at), 'yyyy-MM-dd');
        if (d in byPyDay) byPyDay[d] = (byPyDay[d] || 0) + Number(o.total_amount || 0);
      }
      revenuePrevYearSeries = [];
      for (let i = chartDays - 1; i >= 0; i--) {
        const dateKey = format(subDays(now, i), 'yyyy-MM-dd');
        const pyKey = format(subDays(now, i + 365), 'yyyy-MM-dd');
        revenuePrevYearSeries.push({
          date: format(new Date(dateKey + 'T12:00:00'), 'dd/MM'),
          revenue: byPyDay[pyKey] ?? 0,
        });
      }
    } catch {
      revenuePrevYearSeries = revenueSeries.map((r) => ({ ...r, revenue: 0 }));
    }
    if (revenuePrevYearSeries.length === 0) {
      revenuePrevYearSeries = revenueSeries.map((r) => ({ ...r, revenue: 0 }));
    }

    return NextResponse.json({
      chartDays,
      updatedAt: now.toISOString(),
      kpisToday: {
        orders: todayCount,
        revenue: todayRevenue,
        newUsers: newUsersToday,
        avgBasket: avgBasketToday,
        deliverySuccessRate,
      },
      yesterdayKpis: {
        orders: yCount,
        revenue: yRev,
        newUsers: newUsersYesterday,
        avgBasket: yAvgBasket,
      },
      weekAvgBasket,
      sparklines: {
        revenue7d,
        orders7d,
        newUsers7d,
      },
      windowSummary: { orders: totalO, revenue: windowRevenue },
      windowMeta: {
        start: windowStartDate.toISOString(),
        end: now.toISOString(),
        sampledOrders: totalO,
      },
      revenueSeries,
      revenuePrevYearSeries: revenuePrevYearSeries.slice(0, revenueSeries.length),
      ordersByStatus,
      ordersStackedDaily,
      orderHourHeatmap: heatmapData,
      topProducts,
      topProductsWeek,
      funnel,
      geoSales,
      geoTop5,
      bigData: bigDataPayload,
      activity: {
        recentOrders: recentOrdersRes.data || [],
        newSignups: newProfilesListRes.data || [],
      },
      alerts: {
        criticalStockCount: criticalStock.length,
        criticalStockSample: criticalStock.slice(0, 8),
        pendingOver2h: pendingOldRes.count ?? 0,
        oneStarReviews: badReviewsRes.count ?? 0,
        failedPaymentsToday,
      },
    });
  } catch (e) {
    console.error('[api/dashboard]', e);
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
