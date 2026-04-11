import {
  addMonths,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CohortRetentionRow = {
  cohortLabel: string;
  cohortKey: string;
  size: number;
  m1: number | null;
  m2: number | null;
  m3: number | null;
};

function validOrderStatus(status: string | null | undefined): boolean {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  return !['cancelled', 'refunded', 'returned'].includes(s);
}

/** Première commande (min dans l’échantillon) + mois d’activité. L’échantillon doit idéalement être trié du plus ancien au plus récent pour se rapprocher de la vraie cohorte. */
export function buildCohortData(
  orders: { user_id: string | null; created_at: string; status: string | null }[],
  now: Date,
): {
  rows: CohortRetentionRow[];
  ordersSampled: number;
} {
  const valid = orders.filter((o) => o.user_id && validOrderStatus(o.status));
  const userFirstIso = new Map<string, string>();
  const userMonths = new Map<string, Set<string>>();

  for (const o of valid) {
    const uid = o.user_id as string;
    const d = new Date(o.created_at);
    const mk = format(startOfMonth(d), 'yyyy-MM');
    if (!userMonths.has(uid)) userMonths.set(uid, new Set());
    userMonths.get(uid)!.add(mk);
    const prev = userFirstIso.get(uid);
    if (!prev || o.created_at < prev) userFirstIso.set(uid, o.created_at);
  }

  const userFirstMonth = new Map<string, string>();
  for (const [uid, firstIso] of userFirstIso) {
    userFirstMonth.set(uid, format(startOfMonth(new Date(firstIso)), 'yyyy-MM'));
  }

  const cohortKeys = [
    format(subMonths(startOfMonth(now), 3), 'yyyy-MM'),
    format(subMonths(startOfMonth(now), 2), 'yyyy-MM'),
  ];

  const rows: CohortRetentionRow[] = [];

  for (const ck of cohortKeys) {
    const cohortUsers = new Set<string>();
    for (const [uid, fm] of userFirstMonth) {
      if (fm === ck) cohortUsers.add(uid);
    }

    const m1k = format(addMonths(parseISO(`${ck}-01T12:00:00`), 1), 'yyyy-MM');
    const m2k = format(addMonths(parseISO(`${ck}-01T12:00:00`), 2), 'yyyy-MM');
    const m3k = format(addMonths(parseISO(`${ck}-01T12:00:00`), 3), 'yyyy-MM');

    const pct = (uids: Set<string>, targetKey: string): number | null => {
      if (uids.size === 0) return null;
      const t0 = startOfMonth(parseISO(`${targetKey}-01T12:00:00`));
      if (t0 > now) return null;
      let hit = 0;
      for (const u of uids) {
        if (userMonths.get(u)?.has(targetKey)) hit++;
      }
      return Math.round((1000 * hit) / uids.size) / 10;
    };

    const label = format(parseISO(`${ck}-01T12:00:00`), 'MMM yyyy', { locale: fr });
    rows.push({
      cohortLabel: label.charAt(0).toUpperCase() + label.slice(1),
      cohortKey: ck,
      size: cohortUsers.size,
      m1: pct(cohortUsers, m1k),
      m2: pct(cohortUsers, m2k),
      m3: pct(cohortUsers, m3k),
    });
  }

  return { rows, ordersSampled: valid.length };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** LTV moyenne = revenu livré cumulé par acheteur actif sur la fenêtre, moyenné sur ces acheteurs. */
export async function computeLtvForActiveBuyers(
  sb: SupabaseClient,
  activeUserIds: Set<string>,
): Promise<number> {
  const ids = [...activeUserIds];
  if (ids.length === 0) return 0;
  const spend: Record<string, number> = {};
  for (const part of chunk(ids, 120)) {
    const { data, error } = await sb
      .from('orders')
      .select('user_id, total_amount')
      .eq('status', 'delivered')
      .in('user_id', part);
    if (error) continue;
    for (const r of data || []) {
      const u = (r as { user_id: string }).user_id;
      spend[u] = (spend[u] || 0) + Number((r as { total_amount: number | null }).total_amount || 0);
    }
  }
  const vals = ids.map((id) => spend[id] || 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function splitActiveBuyers(
  deliveredRows: { user_id: string; created_at: string }[],
  currStart: Date,
  prevStart: Date,
): { current: Set<string>; previous: Set<string> } {
  const current = new Set<string>();
  const previous = new Set<string>();
  const tCurr = currStart.getTime();
  const tPrev = prevStart.getTime();
  for (const r of deliveredRows) {
    const t = new Date(r.created_at).getTime();
    if (t >= tCurr) current.add(r.user_id);
    else if (t >= tPrev && t < tCurr) previous.add(r.user_id);
  }
  return { current, previous };
}

/** Taux de réachat : parmi les acheteurs uniques de la fenêtre, % ayant au moins 2 commandes (tous statuts valides sauf annulé). */
export function repeatPurchaseRateInWindow(
  orders: { user_id: string | null; created_at: string; status: string | null }[],
  windowStart: Date,
  windowEnd: Date,
): number {
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  const counts: Record<string, number> = {};
  for (const o of orders) {
    if (!o.user_id || !validOrderStatus(o.status)) continue;
    const t = new Date(o.created_at).getTime();
    if (t < ws || t > we) continue;
    counts[o.user_id] = (counts[o.user_id] || 0) + 1;
  }
  const buyers = Object.keys(counts);
  if (buyers.length === 0) return 0;
  const repeaters = buyers.filter((u) => counts[u] >= 2).length;
  return repeaters / buyers.length;
}

export function reviewStatsInWindows(
  rows: { rating: number | null; created_at: string }[],
  currStart: Date,
  prevStart: Date,
): { currAvg: number; prevAvg: number } {
  const tCurr = currStart.getTime();
  const tPrev = prevStart.getTime();
  const curr: number[] = [];
  const prev: number[] = [];
  for (const r of rows) {
    const n = Number(r.rating);
    if (Number.isNaN(n)) continue;
    const t = new Date(r.created_at).getTime();
    if (t >= tCurr) curr.push(n);
    else if (t >= tPrev && t < tCurr) prev.push(n);
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return { currAvg: Math.round(avg(curr) * 10) / 10, prevAvg: Math.round(avg(prev) * 10) / 10 };
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export type TopProductMonth = {
  id: string;
  name: string;
  fullName: string;
  sales: number;
  revenue: number;
  imageUrl: string | null;
};

export type TopDriverMonth = {
  id: string;
  name: string;
  deliveries: number;
  earningsMonth: number;
  ratingAvg: number | null;
  avatarUrl: string | null;
};

export type ExtendedBigData = {
  avgLtv: number;
  repeatPurchaseRate: number;
  reviewAvg: number;
  reviewCount: number;
  ltvDeltaPct: number | null;
  repeatDeltaPts: number | null;
  reviewDeltaPts: number | null;
  cohortRetentionRows: CohortRetentionRow[];
  ordersUsedInCohortSample: number;
  topDriversMonth: TopDriverMonth[];
  topProductsMonth: TopProductMonth[];
};

export async function computeExtendedBigData(
  sb: SupabaseClient,
  now: Date,
  monthStartIso: string,
  base: { baseAvgLtv: number; baseRepeat: number; baseReviewAvg: number },
): Promise<ExtendedBigData> {
  const currWindowStartDate = startOfDay(subDays(now, 30));
  const prevWindowStartDate = startOfDay(subDays(now, 60));

  const [
    cohortAscRes,
    cohortDescRes,
    orders60Res,
    delivered60Res,
    reviews60Res,
    reviewCountRes,
    ratingsSampleRes,
    deliveries30Res,
  ] = await Promise.all([
    sb
      .from('orders')
      .select('user_id, created_at, status')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20000),
    sb
      .from('orders')
      .select('user_id, created_at, status')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12000),
    sb
      .from('orders')
      .select('user_id, created_at, status')
      .not('user_id', 'is', null)
      .gte('created_at', prevWindowStartDate.toISOString())
      .limit(15000),
    sb
      .from('orders')
      .select('user_id, created_at')
      .eq('status', 'delivered')
      .not('user_id', 'is', null)
      .gte('created_at', prevWindowStartDate.toISOString())
      .limit(15000),
    sb
      .from('reviews')
      .select('rating, created_at')
      .gte('created_at', prevWindowStartDate.toISOString())
      .limit(15000),
    sb.from('reviews').select('*', { count: 'exact', head: true }),
    sb.from('reviews').select('rating').limit(12000),
    sb.from('deliveries').select('driver_id, driver_earnings').gte('created_at', monthStartIso).limit(8000),
  ]);

  const cohortMerged = [
    ...((cohortAscRes.data || []) as { user_id: string | null; created_at: string; status: string | null }[]),
    ...((cohortDescRes.data || []) as { user_id: string | null; created_at: string; status: string | null }[]),
  ];
  const { rows: cohortRetentionRows, ordersSampled: cohortOrdersSampled } = buildCohortData(cohortMerged, now);

  const drows = (delivered60Res.data || []) as { user_id: string; created_at: string }[];
  const { current: actC, previous: actP } = splitActiveBuyers(drows, currWindowStartDate, prevWindowStartDate);

  let avgLtvCurr = await computeLtvForActiveBuyers(sb, actC);
  let avgLtvPrev = await computeLtvForActiveBuyers(sb, actP);
  if (actC.size === 0) avgLtvCurr = base.baseAvgLtv;
  if (actP.size === 0) avgLtvPrev = base.baseAvgLtv;

  const ltvDeltaPct =
    avgLtvPrev > 0 && actP.size > 0 ? Math.round(((avgLtvCurr - avgLtvPrev) / avgLtvPrev) * 1000) / 10 : null;

  const o60 = (orders60Res.data || []) as { user_id: string | null; created_at: string; status: string | null }[];
  const repeatCurr = repeatPurchaseRateInWindow(o60, currWindowStartDate, now);
  const repeatPrev = repeatPurchaseRateInWindow(
    o60,
    prevWindowStartDate,
    new Date(currWindowStartDate.getTime() - 1),
  );
  const repeatDeltaPts =
    o60.length > 0 ? Math.round((repeatCurr - repeatPrev) * 1000) / 10 : null;

  const rev60 = (reviews60Res.data || []) as { rating: number | null; created_at: string }[];
  const { currAvg: revCurr, prevAvg: revPrev } = reviewStatsInWindows(rev60, currWindowStartDate, prevWindowStartDate);
  const reviewDeltaPts =
    rev60.length > 0 ? Math.round((revCurr - revPrev) * 10) / 10 : null;

  const ratingsSample = (ratingsSampleRes.data || []) as { rating: number | null }[];
  const ratingsNum = ratingsSample.map((r) => Number(r.rating)).filter((n) => !Number.isNaN(n));
  const reviewAvgGlobal =
    ratingsNum.length > 0 ? Math.round((sum(ratingsNum) / ratingsNum.length) * 10) / 10 : base.baseReviewAvg;
  const reviewCount = reviewCountRes.count ?? 0;

  const dels = (deliveries30Res.data || []) as { driver_id: string | null; driver_earnings: number | null }[];
  const byDriver: Record<string, { c: number; earn: number }> = {};
  for (const r of dels) {
    const id = r.driver_id;
    if (!id) continue;
    if (!byDriver[id]) byDriver[id] = { c: 0, earn: 0 };
    byDriver[id].c += 1;
    byDriver[id].earn += Number(r.driver_earnings || 0);
  }
  const qualified = Object.entries(byDriver)
    .filter(([, v]) => v.c >= 5)
    .sort((a, b) => b[1].c - a[1].c || b[1].earn - a[1].earn)
    .slice(0, 3);

  let topDriversMonth: TopDriverMonth[] = [];
  if (qualified.length) {
    const dIds = qualified.map(([id]) => id);
    const { data: drows2 } = await sb
      .from('drivers')
      .select('id, name, rating_avg, user_id')
      .in('id', dIds);
    const dm = new Map<string, { name: string; rating_avg: number | null; user_id: string | null }>();
    for (const r of drows2 || []) {
      const row = r as {
        id: string;
        name: string | null;
        rating_avg: number | null;
        user_id: string | null;
      };
      dm.set(row.id, {
        name: (row.name || '').trim() || row.id.slice(0, 8),
        rating_avg: row.rating_avg,
        user_id: row.user_id,
      });
    }
    const uids = [...new Set(qualified.map(([id]) => dm.get(id)?.user_id).filter(Boolean))] as string[];
    const pmap: Record<string, { avatar_url: string | null }> = {};
    if (uids.length) {
      for (const part of chunk(uids, 120)) {
        const { data: profs } = await sb.from('profiles').select('id, avatar_url').in('id', part);
        for (const p of profs || []) {
          const row = p as { id: string; avatar_url: string | null };
          pmap[row.id] = { avatar_url: row.avatar_url };
        }
      }
    }
    topDriversMonth = qualified.map(([id, v]) => {
      const dr = dm.get(id);
      const uid = dr?.user_id || '';
      return {
        id,
        name: dr?.name || id.slice(0, 8),
        deliveries: v.c,
        earningsMonth: Math.round(v.earn),
        ratingAvg: dr?.rating_avg ?? null,
        avatarUrl: uid ? pmap[uid]?.avatar_url ?? null : null,
      };
    });
  }

  let topProductsMonth: TopProductMonth[] = [];
  const { data: ordIdsRows } = await sb.from('orders').select('id').gte('created_at', monthStartIso).limit(7000);
  const orderIds = (ordIdsRows || []).map((o) => (o as { id: string }).id);
  const prodAgg = new Map<string, { qty: number; rev: number }>();
  for (const part of chunk(orderIds, 400)) {
    const { data: oi } = await sb
      .from('order_items')
      .select('product_id, quantity, total_price')
      .in('order_id', part);
    for (const row of oi || []) {
      const pid = (row as { product_id: string | null }).product_id;
      if (!pid) continue;
      const q = Number((row as { quantity: number | null }).quantity || 1);
      const tp = Number((row as { total_price: number | null }).total_price || 0);
      const cur = prodAgg.get(pid) || { qty: 0, rev: 0 };
      cur.qty += q;
      cur.rev += tp;
      prodAgg.set(pid, cur);
    }
  }
  const topPids = [...prodAgg.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 3);
  if (topPids.length) {
    const pids = topPids.map(([id]) => id);
    const { data: prows } = await sb.from('products').select('id, name, main_image').in('id', pids);
    const pm = new Map<string, { name: string; main_image: string | null }>();
    for (const r of prows || []) {
      const row = r as { id: string; name: string; main_image: string | null };
      pm.set(row.id, { name: row.name, main_image: row.main_image });
    }
    topProductsMonth = topPids.map(([pid, v]) => {
      const meta = pm.get(pid);
      const name = meta?.name || pid;
      return {
        id: pid,
        name: name.length > 22 ? name.slice(0, 20) + '…' : name,
        fullName: name,
        sales: v.qty,
        revenue: Math.round(v.rev),
        imageUrl: meta?.main_image ?? null,
      };
    });
  }

  return {
    avgLtv: Math.round(avgLtvCurr),
    repeatPurchaseRate: Math.round(repeatCurr * 1000) / 1000,
    reviewAvg: reviewAvgGlobal,
    reviewCount,
    ltvDeltaPct,
    repeatDeltaPts,
    reviewDeltaPts,
    cohortRetentionRows,
    ordersUsedInCohortSample: cohortOrdersSampled,
    topDriversMonth,
    topProductsMonth,
  };
}
