import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import {
  loadNotificationCounts,
  loadOrderAggregatesForUsers,
  loadTokenCounts,
} from '@/app/api/users/_lib/user-metrics';

export const dynamic = 'force-dynamic';

const PAGE = 30;
const SCAN = 400;

function decodeCursor(s: string | null): { created_at: string; id: string } | null {
  if (!s) return null;
  try {
    const j = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { c?: string; i?: string };
    if (j.c && j.i) return { created_at: j.c, id: j.i };
  } catch {
    try {
      const j = JSON.parse(Buffer.from(s, 'base64').toString('utf8')) as { c?: string; i?: string };
      if (j.c && j.i) return { created_at: j.c, id: j.i };
    } catch {
      return null;
    }
  }
  return null;
}

function parseNum(s: string | null): number | undefined {
  if (s === null || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: Request) {
  const auth = await requireAdminPermission('users', 'read');
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = decodeCursor(searchParams.get('cursor'));
  const roleParam = searchParams.get('role') || 'all';
  const rolesMulti = roleParam.includes(',') ? roleParam.split(',').map((r) => r.trim()).filter(Boolean) : null;
  const suspended = searchParams.get('suspended');
  const status = searchParams.get('status');
  const q = searchParams.get('q')?.trim() || '';
  const city = searchParams.get('city')?.trim() || '';
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const countries = (searchParams.get('country') || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const ltvMin = parseNum(searchParams.get('ltv_min'));
  const ltvMax = parseNum(searchParams.get('ltv_max'));
  const ordersMin = parseNum(searchParams.get('orders_min'));
  const ordersMax = parseNum(searchParams.get('orders_max'));
  const hasDevice = searchParams.get('has_device');
  const inactiveDays = parseNum(searchParams.get('inactive_days'));

  const advanced =
    ltvMin !== undefined ||
    ltvMax !== undefined ||
    ordersMin !== undefined ||
    ordersMax !== undefined ||
    hasDevice === 'true' ||
    hasDevice === 'false' ||
    inactiveDays !== undefined ||
    countries.length > 0;

  try {
    const selectCols =
      'id, email, first_name, last_name, phone, role, city, country, is_available, avatar_url, is_suspended, suspended_at, suspended_by, suspension_reason, last_seen_at, is_online, created_at, loyalty_points';

    let query = sb
      .from('profiles')
      .select(selectCols, { count: advanced ? 'planned' : 'exact' })
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(advanced ? SCAN : PAGE + 1);

    if (rolesMulti && rolesMulti.length) {
      query = query.in('role', rolesMulti);
    } else if (roleParam !== 'all') {
      if (roleParam === 'client' || roleParam === 'user') {
        query = query.or('role.is.null,role.eq.client,role.eq.user');
      } else {
        query = query.eq('role', roleParam);
      }
    }

    if (suspended === 'true' || status === 'suspended') query = query.eq('is_suspended', true);
    if (suspended === 'false' || status === 'active') {
      query = query.or('is_suspended.is.null,is_suspended.eq.false');
    }
    if (status === 'inactive' && inactiveDays === undefined) {
      const t = new Date(Date.now() - 30 * 86400000).toISOString();
      query = query.or(`last_seen_at.is.null,last_seen_at.lt.${t}`);
    }

    if (city) query = query.ilike('city', `%${city}%`);
    if (countries.length === 1) query = query.ilike('country', `%${countries[0]}%`);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);
    if (inactiveDays !== undefined) {
      const cut = new Date(Date.now() - inactiveDays * 86400000).toISOString();
      query = query.or(`last_seen_at.is.null,last_seen_at.lt.${cut}`);
    }

    if (q) {
      const idLike = /^[0-9a-f-]{36}$/i.test(q) ? q : null;
      if (idLike) {
        query = query.eq('id', idLike);
      } else {
        query = query.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`);
      }
    }

    if (!advanced && cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    }

    const { data: rows, error, count } = await query;
    if (error) throw error;

    let list = (rows || []) as Record<string, unknown>[];
    const ids = list.map((r) => r.id as string).filter(Boolean);

    const { orderCount, spent } = await loadOrderAggregatesForUsers(sb, ids);
    const tokenCount = await loadTokenCounts(sb, ids);
    const notifCount = await loadNotificationCounts(sb, ids);

    let enriched: Array<Record<string, unknown>> = list.map((r) => {
      const id = r.id as string;
      const oc = orderCount[id] || 0;
      const sp = spent[id] || 0;
      const ltvScore = Math.min(100, Math.round(Math.log10(sp + 1) * 25));
      return {
        ...r,
        orders_count: oc,
        total_spent: sp,
        device_tokens_count: tokenCount[id] || 0,
        notifications_received_count: notifCount[id] || 0,
        ltv_score: ltvScore,
      };
    });

    if (countries.length > 1) {
      const set = new Set(countries.map((c) => c.toLowerCase()));
      enriched = enriched.filter((r) => set.has(String(r.country || '').toLowerCase()));
    }

    if (ltvMin !== undefined) enriched = enriched.filter((r) => Number(r.total_spent) >= ltvMin);
    if (ltvMax !== undefined) enriched = enriched.filter((r) => Number(r.total_spent) <= ltvMax);
    if (ordersMin !== undefined) enriched = enriched.filter((r) => Number(r.orders_count) >= ordersMin);
    if (ordersMax !== undefined) enriched = enriched.filter((r) => Number(r.orders_count) <= ordersMax);
    if (hasDevice === 'true') enriched = enriched.filter((r) => Number(r.device_tokens_count) > 0);
    if (hasDevice === 'false') enriched = enriched.filter((r) => Number(r.device_tokens_count) === 0);

    let hasMore = false;
    let nextCursor: string | null = null;

    if (advanced) {
      hasMore = enriched.length > PAGE;
      enriched = enriched.slice(0, PAGE);
      nextCursor = null;
    } else {
      hasMore = enriched.length > PAGE;
      if (hasMore) enriched = enriched.slice(0, PAGE);
      const last = enriched[enriched.length - 1] as { created_at?: string; id?: string } | undefined;
      nextCursor =
        hasMore && last?.created_at && last?.id
          ? Buffer.from(JSON.stringify({ c: last.created_at, i: last.id }), 'utf8').toString('base64url')
          : null;
    }

    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d0 = new Date(now);
    d0.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const twoWeekAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

    const [
      { count: totalUsers },
      { count: active30 },
      { count: newToday },
      { count: newWeek },
      { count: prevWeek },
      { data: roleRows },
      { data: signupRows },
      { data: countryRows },
    ] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', d30),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d0.toISOString()),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      sb.from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', twoWeekAgo)
        .lt('created_at', weekAgo),
      sb.from('profiles').select('role').limit(25000),
      sb.from('profiles').select('created_at').gte('created_at', d30).limit(8000),
      sb.from('profiles').select('country').not('country', 'is', null).limit(8000),
    ]);

    const roleBreak = { client: 0, driver: 0, admin: 0, superadmin: 0, other: 0 };
    for (const r of roleRows || []) {
      const role = String((r as { role: string | null }).role || 'user').toLowerCase();
      if (role === 'driver') roleBreak.driver += 1;
      else if (role === 'admin') roleBreak.admin += 1;
      else if (role === 'superadmin' || role === 'super_admin') roleBreak.superadmin += 1;
      else if (role === 'client' || role === 'user' || !role) roleBreak.client += 1;
      else roleBreak.other += 1;
    }

    const premiumLtv = enriched.filter((u) => Number(u.total_spent) >= 100000).length;

    const signupByDay: Record<string, number> = {};
    for (const r of signupRows || []) {
      const d = new Date((r as { created_at: string }).created_at);
      const key = d.toISOString().slice(0, 10);
      signupByDay[key] = (signupByDay[key] || 0) + 1;
    }
    const signupSeries = Object.keys(signupByDay)
      .sort()
      .map((k) => ({ date: k, count: signupByDay[k] }));

    const countryCount: Record<string, number> = {};
    for (const r of countryRows || []) {
      const c = String((r as { country: string | null }).country || '—').trim() || '—';
      countryCount[c] = (countryCount[c] || 0) + 1;
    }
    const topCountries = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    const spendBuckets = [
      { range: '0', count: 0 },
      { range: '1-10k', count: 0 },
      { range: '10k-50k', count: 0 },
      { range: '50k-100k', count: 0 },
      { range: '100k+', count: 0 },
    ];
    const { data: spendSample } = await sb.from('orders').select('user_id, total_amount').limit(12000);
    const userSpent: Record<string, number> = {};
    for (const o of spendSample || []) {
      const uid = (o as { user_id: string }).user_id;
      userSpent[uid] = (userSpent[uid] || 0) + Number((o as { total_amount: number | null }).total_amount || 0);
    }
    for (const v of Object.values(userSpent)) {
      if (v <= 0) spendBuckets[0].count += 1;
      else if (v < 10000) spendBuckets[1].count += 1;
      else if (v < 50000) spendBuckets[2].count += 1;
      else if (v < 100000) spendBuckets[3].count += 1;
      else spendBuckets[4].count += 1;
    }

    const premium_ltv_global = Object.values(userSpent).filter((v) => v >= 100000).length;

    function weekStartUtcMs(d: Date): number {
      const x = new Date(d);
      x.setUTCHours(0, 0, 0, 0);
      const day = x.getUTCDay();
      const diff = (day + 6) % 7;
      x.setUTCDate(x.getUTCDate() - diff);
      return x.getTime();
    }

    const { data: orderRows } = await sb
      .from('orders')
      .select('user_id, created_at')
      .not('user_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 98 * 86400000).toISOString())
      .limit(20000);

    const firstOrderTs = new Map<string, number>();
    const ordersByUserWeek = new Map<string, Set<number>>();
    for (const o of orderRows || []) {
      const uid = String((o as { user_id: string }).user_id);
      const t = new Date(String((o as { created_at: string }).created_at)).getTime();
      if (!Number.isFinite(t)) continue;
      const wk = weekStartUtcMs(new Date(t));
      if (!ordersByUserWeek.has(uid)) ordersByUserWeek.set(uid, new Set());
      ordersByUserWeek.get(uid)!.add(wk);
      const prev = firstOrderTs.get(uid);
      if (prev === undefined || t < prev) firstOrderTs.set(uid, t);
    }

    const cohortWeekStarts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      cohortWeekStarts.push(weekStartUtcMs(new Date(now.getTime() - i * 7 * 86400000)));
    }

    const cohort_row_labels = cohortWeekStarts.map((ws) => {
      const d = new Date(ws);
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    });
    const cohort_col_labels = ['S+0', 'S+1', 'S+2', 'S+3', 'S+4', 'S+5'];

    const cohortMatrix: number[][] = [];
    for (const cw of cohortWeekStarts) {
      const usersInCohort: string[] = [];
      for (const [uid, first] of firstOrderTs) {
        if (weekStartUtcMs(new Date(first)) === cw) usersInCohort.push(uid);
      }
      const row: number[] = [];
      const n = usersInCohort.length;
      const weekMs = 7 * 86400000;
      for (let j = 0; j < 6; j++) {
        if (n === 0) {
          row.push(0);
          continue;
        }
        const targetWeek = cw + j * weekMs;
        let c = 0;
        for (const uid of usersInCohort) {
          if (ordersByUserWeek.get(uid)?.has(targetWeek)) c += 1;
        }
        row.push(Math.min(100, Math.round((100 * c) / n)));
      }
      cohortMatrix.push(row);
    }

    const kpis = {
      total_users: totalUsers ?? 0,
      active_30d: active30 ?? 0,
      new_today: newToday ?? 0,
      premium_ltv_count: premium_ltv_global,
      role_breakdown: roleBreak,
      delta_new_users_week_pct:
        (newWeek || 0) > 0 && (prevWeek || 0) > 0
          ? Math.round((((newWeek || 0) - (prevWeek || 0)) / (prevWeek || 1)) * 100)
          : 0,
    };

    const bigdata_charts = {
      signup_series_30d: signupSeries,
      top_countries: topCountries,
      spend_histogram: spendBuckets,
      cohort_retention_matrix: cohortMatrix,
      cohort_row_labels,
      cohort_col_labels,
    };

    return NextResponse.json({
      data: enriched,
      nextCursor,
      totalApprox: advanced ? enriched.length : count,
      advanced_mode: advanced,
      kpis,
      bigdata_charts,
    });
  } catch (e) {
    console.error('[api/users]', e);
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

type CreateUserBody = {
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role?: string;
  password?: string;
  phone?: string;
  city?: string;
  country?: string;
  send_invite?: boolean;
  vehicle_type?: string;
  vehicle_plate?: string;
  vehicle_color?: string;
  vehicle_brand?: string;
  commission_rate?: number;
  zone_ids?: string[];
  /** Matrice section → action ; réservé superadmin, rôles admin / superadmin uniquement */
  admin_permissions?: Record<string, Record<string, boolean>>;
};

export async function POST(req: Request) {
  const auth = await requireAdminPermission('users', 'create');
  if (!auth.ok) return auth.response;

  let body: CreateUserBody;
  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const email = body.email?.trim();
  let first = body.first_name?.trim() || '';
  let last = body.last_name?.trim() || '';
  if (body.full_name?.trim()) {
    const parts = body.full_name.trim().split(/\s+/);
    first = first || parts[0] || 'User';
    last = last || parts.slice(1).join(' ') || '';
  }
  if (!first) first = 'User';

  const roleRaw = (body.role || 'client').toLowerCase();
  const role =
    roleRaw === 'super_admin' ? 'superadmin' : roleRaw === 'user' ? 'client' : roleRaw;

  if (!email) {
    return NextResponse.json({ error: 'Email requis' }, { status: 400 });
  }

  if (role === 'superadmin' || role === 'admin') {
    const { requireSuperAdmin } = await import('@/app/api/_lib/require-super-admin');
    const sup = await requireSuperAdmin();
    if (!sup.ok) return sup.response;
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const start = Date.now();
  const sendInvite = Boolean(body.send_invite) && !body.password;

  const { data: created, error: authErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: !sendInvite,
    password: body.password || undefined,
    user_metadata: {
      first_name: first,
      last_name: last,
      phone: body.phone ?? '',
    },
    app_metadata: { role },
  });

  if (authErr || !created.user) {
    return NextResponse.json({ error: authErr?.message || 'Création auth échouée' }, { status: 400 });
  }

  const userId = created.user.id;

  const { error: profErr } = await sb.from('profiles').upsert(
    {
      id: userId,
      email,
      first_name: first,
      last_name: last,
      phone: body.phone ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      role,
      is_suspended: false,
    },
    { onConflict: 'id' },
  );

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 400 });
  }

  if (role === 'driver') {
    const { data: dup } = await sb.from('drivers').select('id').eq('user_id', userId).maybeSingle();
    if (!dup) {
      const dname = `${first} ${last}`.trim() || 'Livreur';
      const { error: de } = await sb.from('drivers').insert({
        user_id: userId,
        name: dname,
        phone: body.phone ?? null,
        vehicle_type: body.vehicle_type ?? null,
        vehicle_plate: body.vehicle_plate ?? null,
        vehicle_color: body.vehicle_color ?? null,
        is_active: true,
      });
      if (de) {
        return NextResponse.json({ error: `Livreur: ${de.message}` }, { status: 400 });
      }
    }
  }

  const permKeys = body.admin_permissions ? Object.keys(body.admin_permissions) : [];
  if (permKeys.length > 0) {
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json({ error: 'admin_permissions réservé aux rôles admin / superadmin' }, { status: 422 });
    }
    const { requireSuperAdmin } = await import('@/app/api/_lib/require-super-admin');
    const sup = await requireSuperAdmin();
    if (!sup.ok) return sup.response;
    const { error: pe } = await sb.from('settings').upsert(
      {
        key: `admin_permissions_${userId}`,
        value: body.admin_permissions,
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
      },
      { onConflict: 'key' },
    );
    if (pe) {
      return NextResponse.json({ error: pe.message }, { status: 400 });
    }
  }

  if (sendInvite) {
    const { error: invErr } = await sb.auth.admin.inviteUserByEmail(email);
    if (invErr) {
      await sb.auth.admin.generateLink({ type: 'invite', email }).catch(() => null);
    }
  }

  const actorRole = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole,
    actionType: 'create',
    entityType: 'user',
    entityId: userId,
    description: `Création utilisateur (${role})`,
    changes: { after: { email, role } },
  }).catch(() => null);

  return NextResponse.json(
    { data: { id: userId, email }, durationMs: Date.now() - start },
    { status: 201 },
  );
}
