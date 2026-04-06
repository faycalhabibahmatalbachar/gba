import { NextResponse } from 'next/server';
import { subDays, startOfDay } from 'date-fns';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days') || 30)));
  const from = subDays(new Date(), days).toISOString();

  try {
    const [ordersRes, profilesRes, productsRes, reviewsRes] = await Promise.all([
      sb.from('orders').select('id, total_amount, status, created_at, user_id').gte('created_at', from).limit(12000),
      sb.from('profiles').select('id, created_at, role').gte('created_at', from).limit(5000),
      sb.from('products').select('id, name, price, quantity, reviews_count, rating').limit(2000),
      sb.from('reviews').select('id, rating, created_at').gte('created_at', from).limit(5000),
    ]);

    const orders = (ordersRes.data || []) as {
      total_amount: number | null;
      status: string | null;
      created_at: string;
      user_id: string | null;
    }[];
    const revenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const byStatus: Record<string, number> = {};
    for (const o of orders) {
      const k = o.status || 'unknown';
      byStatus[k] = (byStatus[k] || 0) + 1;
    }

    const newUsers = (profilesRes.data || []).length;
    const userIds = new Set(orders.map((o) => o.user_id).filter(Boolean));
    const arpu = userIds.size > 0 ? revenue / userIds.size : 0;

    const reviews = (reviewsRes.data || []) as { rating: number }[];
    const avgReview =
      reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    const day0 = startOfDay(new Date());
    const retentionBuckets = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => {
      const dayStart = subDays(day0, d);
      const dayEnd = subDays(day0, d - 1);
      const cnt = orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      return { label: `J-${d}`, orders: cnt };
    });

    return NextResponse.json({
      periodDays: days,
      revenue,
      orderCount: orders.length,
      newUsers,
      activeBuyers: userIds.size,
      arpu: Math.round(arpu),
      ordersByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      avgReviewRating: Math.round(avgReview * 100) / 100,
      reviewCount: reviews.length,
      topProductsByStockRisk: ((productsRes.data || []) as { name: string; quantity: number | null }[])
        .filter((p) => (p.quantity ?? 0) < 10)
        .slice(0, 15),
      ordersLast8d: retentionBuckets,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
