import { NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { ordersHeatMatrixFromWindow } from '@/app/api/reports/_lib/build-overview';

export const dynamic = 'force-dynamic';

const TYPES = new Set(['orders', 'users', 'products', 'drivers', 'messages']);

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { type } = await ctx.params;
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: 'Type inconnu' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('date_from')?.trim() || subDays(new Date(), 30).toISOString();
  const dateTo = searchParams.get('date_to')?.trim() || new Date().toISOString();

  try {
    if (type === 'orders') {
      const { data: orders, error } = await sb
        .from('orders')
        .select('id, order_number, created_at, status, total_amount, payment_method, customer_name')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = (orders || []) as {
        total_amount: number | null;
        status: string | null;
        payment_method: string | null;
        created_at: string;
      }[];
      const revenue = rows.reduce((s, o) => s + Number(o.total_amount || 0), 0);
      const byStatus: Record<string, number> = {};
      const byPay: Record<string, number> = {};
      for (const o of rows) {
        const st = o.status || '—';
        byStatus[st] = (byStatus[st] || 0) + 1;
        const pm = o.payment_method || '—';
        byPay[pm] = (byPay[pm] || 0) + 1;
      }
      const byDay: Record<string, { revenue: number; n: number }> = {};
      for (const o of rows) {
        const d = format(new Date(o.created_at), 'yyyy-MM-dd');
        if (!byDay[d]) byDay[d] = { revenue: 0, n: 0 };
        byDay[d].revenue += Number(o.total_amount || 0);
        byDay[d].n += 1;
      }
      const { matrix, max } = ordersHeatMatrixFromWindow(rows);
      return NextResponse.json({
        type,
        date_from: dateFrom,
        date_to: dateTo,
        kpis: {
          count: rows.length,
          revenue,
          avg_basket: rows.length ? revenue / rows.length : 0,
          cancel_rate:
            rows.length > 0 ? ((byStatus.cancelled || 0) + (byStatus.canceled || 0)) / rows.length : 0,
        },
        charts: {
          revenue_by_day: Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, v]) => ({ day, revenue: v.revenue, orders: v.n })),
          by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
          payment_donut: Object.entries(byPay).map(([method, count]) => ({ method, count })),
          heatmap: { matrix, max, hours: Array.from({ length: 24 }, (_, i) => i) },
        },
        rows: orders,
      });
    }

    if (type === 'users') {
      const { data: profiles, error } = await sb
        .from('profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .order('created_at', { ascending: false })
        .limit(4000);
      if (error) throw error;
      const list = profiles || [];
      const byRole: Record<string, number> = {};
      for (const p of list as { role?: string | null }[]) {
        const r = p.role || '—';
        byRole[r] = (byRole[r] || 0) + 1;
      }
      return NextResponse.json({
        type,
        charts: {
          by_role_top: Object.entries(byRole)
            .map(([role, count]) => ({ role, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        },
        rows: list,
      });
    }

    if (type === 'products') {
      const { data: products, error } = await sb
        .from('products')
        .select('id, name, quantity, price, sku, category_id')
        .limit(3000);
      if (error) throw error;
      return NextResponse.json({ type, rows: products || [] });
    }

    if (type === 'drivers') {
      const { data: drivers, error } = await sb
        .from('drivers')
        .select('id, user_id, vehicle_type, is_online, is_available, total_deliveries, rating_avg')
        .limit(500);
      if (error) throw error;
      return NextResponse.json({ type, rows: drivers || [] });
    }

    if (type === 'messages') {
      const { data: msgs, error } = await sb
        .from('chat_messages')
        .select('id, created_at, message_type, is_read')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .limit(8000);
      if (error) throw error;
      const list = (msgs || []) as { created_at: string; message_type?: string | null }[];
      const byDay: Record<string, number> = {};
      const byType: Record<string, number> = {};
      for (const m of list) {
        const d = format(new Date(m.created_at), 'yyyy-MM-dd');
        byDay[d] = (byDay[d] || 0) + 1;
        const t = m.message_type || 'text';
        byType[t] = (byType[t] || 0) + 1;
      }
      const unread = await sb
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      return NextResponse.json({
        type,
        charts: {
          volume_by_day: Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count })),
          by_type: Object.entries(byType).map(([message_type, count]) => ({ message_type, count })),
        },
        kpis: { unread_pending: unread.count ?? 0 },
      });
    }
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }

  return NextResponse.json({ error: 'Type non géré' }, { status: 400 });
}
