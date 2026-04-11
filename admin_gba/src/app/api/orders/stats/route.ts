import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import {
  applyListFilters,
  parseListFilterParams,
  type ListFilterParams,
} from '@/app/api/orders/_lib/order-list-filters';

export const dynamic = 'force-dynamic';

type StatsPayload = {
  totalOrders: number;
  revenue: number;
  avgBasket: number;
  pendingCount: number;
  deliveredCount: number;
  deliveryRate: number;
};

type Sb = ReturnType<typeof getServiceSupabase>;

async function headCount(
  sb: Sb,
  fp: ListFilterParams,
  useMeta: boolean,
  statusOverride?: 'pending' | 'delivered',
): Promise<number> {
  if (statusOverride && fp.status && fp.status !== 'all' && fp.status !== statusOverride) {
    return 0;
  }
  const params: ListFilterParams = { ...fp };
  if (statusOverride) params.status = statusOverride;

  const q = applyListFilters(sb.from('orders').select('id', { count: 'exact', head: true }), params, useMeta);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Somme total_amount sur toutes les lignes correspondant aux filtres (pagination interne). */
async function sumTotalAmount(sb: Sb, fp: ListFilterParams, useMeta: boolean): Promise<number> {
  const pageSize = 1000;
  let offset = 0;
  let sum = 0;
  for (let i = 0; i < 200; i++) {
    const base = sb.from('orders').select('total_amount');
    const filtered = applyListFilters(base, fp, useMeta);
    const { data, error } = await filtered.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { total_amount: number | null }[];
    if (rows.length === 0) break;
    for (const r of rows) sum += Number(r.total_amount || 0);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return sum;
}

async function computeStats(sb: Sb, filterParams: ListFilterParams, useMeta: boolean): Promise<StatsPayload> {
  const [totalOrders, pendingCount, deliveredCount, revenue] = await Promise.all([
    headCount(sb, filterParams, useMeta),
    headCount(sb, filterParams, useMeta, 'pending'),
    headCount(sb, filterParams, useMeta, 'delivered'),
    sumTotalAmount(sb, filterParams, useMeta),
  ]);

  const avgBasket = totalOrders ? revenue / totalOrders : 0;
  const deliveryRate = totalOrders ? (deliveredCount / totalOrders) * 100 : 0;

  return {
    totalOrders,
    revenue,
    avgBasket,
    pendingCount,
    deliveredCount,
    deliveryRate,
  };
}

export async function GET(req: Request) {
  const auth = await requireAdminPermission('orders', 'read');
  if (!auth.ok) return auth.response;

  let sb: Sb;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const url = new URL(req.url);
  const filterParams = parseListFilterParams(url);

  try {
    let stats = await computeStats(sb, filterParams, true);
    return NextResponse.json(stats);
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    // #region agent log
    fetch('http://127.0.0.1:7316/ingest/cbc4d87d-0063-4626-a2b8-cd3c21b6e6d2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '789a98' },
      body: JSON.stringify({
        sessionId: '789a98',
        location: 'api/orders/stats/route.ts:GET',
        message: 'stats compute error',
        data: {
          hypothesisId: 'H5',
          kind: filterParams.kind ?? 'all',
          useMetaFirst: true,
          errMsg: msg.slice(0, 500),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (/metadata|column orders\.metadata/i.test(msg)) {
      try {
        const stats = await computeStats(sb, filterParams, false);
        return NextResponse.json(stats);
      } catch (e2) {
        console.error('[/api/orders/stats]', e2);
        // #region agent log
        fetch('http://127.0.0.1:7316/ingest/cbc4d87d-0063-4626-a2b8-cd3c21b6e6d2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '789a98' },
          body: JSON.stringify({
            sessionId: '789a98',
            location: 'api/orders/stats/route.ts:GET',
            message: 'stats compute error after metadata fallback',
            data: {
              hypothesisId: 'H5',
              kind: filterParams.kind ?? 'all',
              errMsg: String((e2 as Error)?.message || e2).slice(0, 500),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        return NextResponse.json({ error: String((e2 as Error)?.message || e2) }, { status: 500 });
      }
    }
    console.error('[/api/orders/stats]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
