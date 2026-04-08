import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const PAGE = 40;

function decodeCursor(s: string | null): { c: string; i: string } | null {
  if (!s) return null;
  try {
    const j = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { c?: string; i?: string };
    if (j.c && j.i) return { c: j.c, i: j.i };
  } catch {
    /* ignore */
  }
  return null;
}

const postSchema = z
  .object({
    user_id: z.string().uuid().optional().nullable(),
    name: z.string().min(1).max(200),
    phone: z.string().max(50).optional().nullable(),
    vehicle_type: z.string().max(80).optional().nullable(),
    vehicle_plate: z.string().max(40).optional().nullable(),
    vehicle_color: z.string().max(80).optional().nullable(),
    documents: z.unknown().optional(),
    /** Crée un compte Supabase Auth (e-mail + mot de passe) et lie user_id — sans user_id existant */
    invite_email: z.string().email().optional().nullable(),
    invite_password: z.string().min(8).max(128).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasInvite = Boolean(data.invite_email?.trim()) || Boolean(data.invite_password);
    if (!hasInvite) return;
    if (!data.invite_email?.trim() || !data.invite_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invite_email et invite_password (8+ caractères) sont requis ensemble',
      });
    }
    if (data.user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Retirez user_id si vous créez un compte avec invite_email',
      });
    }
  });

function splitDriverDisplayName(name: string): { first: string | null; last: string | null } {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) return { first: null, last: null };
  const parts = n.split(' ');
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

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
  const cursor = decodeCursor(searchParams.get('cursor'));
  const q = searchParams.get('q')?.trim() || '';
  const availableOnly = searchParams.get('available') === 'true';
  const simpleLimit = searchParams.get('limit');

  if (availableOnly && simpleLimit) {
    const lim = Math.min(100, Math.max(1, parseInt(simpleLimit, 10) || 50));
    const { data: drows, error: derr } = await sb
      .from('drivers')
      .select(
        'id, user_id, vehicle_type, vehicle_plate, rating_avg, is_online, is_available, current_lat, current_lng, last_location_at',
      )
      .eq('is_available', true)
      .eq('is_online', true)
      .order('rating_avg', { ascending: false })
      .limit(lim);
    if (derr) {
      return NextResponse.json({ drivers: [], total: 0, error: derr.message }, { status: 500 });
    }
    const uids = (drows || []).map((d) => (d as { user_id?: string }).user_id).filter(Boolean) as string[];
    let pmap: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {};
    if (uids.length) {
      const { data: profs } = await sb
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', uids);
      for (const p of profs || []) {
        const r = p as Record<string, unknown>;
        pmap[String(r.id)] = {
          first_name: (r.first_name as string) ?? null,
          last_name: (r.last_name as string) ?? null,
          avatar_url: (r.avatar_url as string) ?? null,
        };
      }
    }
    const drivers = (drows || []).map((d) => {
      const row = d as Record<string, unknown>;
      const uid = row.user_id as string | undefined;
      const pr = uid ? pmap[uid] : undefined;
      const name = pr
        ? `${pr.first_name ?? ''} ${pr.last_name ?? ''}`.trim() || 'Sans nom'
        : 'Sans nom';
      return {
        id: row.id,
        name,
        avatar_url: pr?.avatar_url ?? null,
        vehicle_type: row.vehicle_type,
        vehicle_plate: row.vehicle_plate,
        rating_avg: row.rating_avg,
        is_online: row.is_online,
        is_available: row.is_available,
      };
    });
    return NextResponse.json({ drivers, total: drivers.length });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const isoDay = dayStart.toISOString();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const isoMonth = monthStart.toISOString();

  try {
    const searchMode = Boolean(q);

    let query = sb
      .from('drivers')
      .select(
        'id, user_id, name, phone, is_active, is_online, is_available, vehicle_type, vehicle_plate, vehicle_color, current_lat, current_lng, last_location_at, rating_avg, total_deliveries, total_earnings, documents, created_at, updated_at',
        searchMode ? undefined : { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (searchMode) {
      query = query.limit(300);
    } else {
      query = query.limit(PAGE + 1);
      if (cursor) {
        query = query.or(`created_at.lt.${cursor.c},and(created_at.eq.${cursor.c},id.lt.${cursor.i})`);
      }
    }

    const { data: rows, error, count } = await query;
    if (error) throw error;

    let list = rows || [];
    const hasMore = !searchMode && list.length > PAGE;
    if (hasMore) list = list.slice(0, PAGE);

    const userIds = list.map((d) => d.user_id).filter(Boolean) as string[];

    let profMap: Record<
      string,
      {
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        phone: string | null;
        avatar_url: string | null;
        city: string | null;
        country: string | null;
      }
    > = {};

    if (userIds.length) {
      const { data: profs, error: pe } = await sb
        .from('profiles')
        .select('id, email, first_name, last_name, full_name, phone, avatar_url, city, country')
        .in('id', userIds);
      if (pe) throw pe;
      for (const p of profs || []) {
        const r = p as Record<string, unknown>;
        profMap[String(r.id)] = {
          email: (r.email as string) ?? null,
          first_name: (r.first_name as string) ?? null,
          last_name: (r.last_name as string) ?? null,
          full_name: (r.full_name as string) ?? null,
          phone: (r.phone as string) ?? null,
          avatar_url: (r.avatar_url as string) ?? null,
          city: (r.city as string) ?? null,
          country: (r.country as string) ?? null,
        };
      }
    }

    const driverIds = list.map((d) => d.id);

    const { data: ordersRows } = driverIds.length
      ? await sb
          .from('orders')
          .select('driver_id, status, created_at, total_amount')
          .in('driver_id', driverIds)
          .gte('created_at', isoMonth)
      : { data: [] as Record<string, unknown>[] };

    const todayOrders: Record<string, number> = {};
    const delivered30: Record<string, number> = {};
    const total30: Record<string, number> = {};
    const spentMonth: Record<string, number> = {};

    for (const o of ordersRows || []) {
      const did = (o as { driver_id: string | null }).driver_id;
      if (!did) continue;
      const st = String((o as { status: string }).status || '');
      const ca = (o as { created_at: string }).created_at;
      const amt = Number((o as { total_amount: number | null }).total_amount || 0);

      if (ca >= isoDay) todayOrders[did] = (todayOrders[did] || 0) + 1;
      total30[did] = (total30[did] || 0) + 1;
      if (st === 'delivered' || st === 'completed') {
        delivered30[did] = (delivered30[did] || 0) + 1;
      }
      spentMonth[did] = (spentMonth[did] || 0) + amt;
    }
    const { data: locRows } = driverIds.length
      ? await sb
          .from('driver_locations')
          .select('driver_id, lat, lng, created_at, captured_at, recorded_at')
          .in('driver_id', driverIds)
          .order('captured_at', { ascending: false })
          .limit(500)
      : { data: [] as Record<string, unknown>[] };

    const latestLoc: Record<string, { lat: number; lng: number; at: string }> = {};
    for (const L of locRows || []) {
      const did = String((L as { driver_id: string }).driver_id);
      if (latestLoc[did]) continue;
      const lat = Number((L as { lat: number | null }).lat);
      const lng = Number((L as { lng: number | null }).lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const at =
        (L as { recorded_at?: string }).recorded_at ||
        (L as { captured_at?: string }).captured_at ||
        (L as { created_at: string }).created_at;
      latestLoc[did] = { lat, lng, at };
    }

    const enriched = list.map((d) => {
      const uid = d.user_id as string | null;
      const pk = String(d.id);
      const p = uid ? profMap[uid] : undefined;
      const display =
        p?.full_name?.trim() ||
        [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
        (d.name as string) ||
        '—';
      const del30 = delivered30[pk] || 0;
      const tot30 = total30[pk] || 0;
      const completionPct = tot30 > 0 ? Math.round((del30 / tot30) * 100) : 0;
      const curLat = d.current_lat as number | null | undefined;
      const curLng = d.current_lng as number | null | undefined;
      const lastAt = (d.last_location_at as string | null | undefined) || undefined;
      const fallbackGps =
        Number.isFinite(Number(curLat)) && Number.isFinite(Number(curLng))
          ? { lat: Number(curLat), lng: Number(curLng), at: lastAt || new Date().toISOString() }
          : null;
      return {
        ...d,
        profile: p
          ? { ...p, display_name: display }
          : { display_name: (d.name as string) || '—', email: null, phone: d.phone, avatar_url: null, city: null, country: null },
        stats: {
          orders_today: todayOrders[pk] || 0,
          completion_pct_30d: completionPct,
          revenue_month_approx: Math.round(spentMonth[pk] || 0),
        },
        last_gps: latestLoc[pk] || fallbackGps,
      };
    });

    if (searchMode) {
      const qq = q.toLowerCase();
      const filtered = enriched.filter((row) => {
        const nm = String(row.profile?.display_name || '').toLowerCase();
        const em = String(row.profile?.email || '').toLowerCase();
        const ph = String(row.profile?.phone || row.phone || '').toLowerCase();
        const pl = String(row.vehicle_plate || '').toLowerCase();
        return nm.includes(qq) || em.includes(qq) || ph.includes(qq) || pl.includes(qq);
      });
      return NextResponse.json({
        drivers: filtered,
        nextCursor: null,
        total: filtered.length,
        filtered: true,
      });
    }

    const last = list[list.length - 1] as { created_at?: string; id?: string } | undefined;
    const nextCursor =
      hasMore && last?.created_at && last?.id
        ? Buffer.from(JSON.stringify({ c: last.created_at, i: last.id }), 'utf8').toString('base64url')
        : null;

    return NextResponse.json({
      drivers: enriched,
      nextCursor,
      total: count ?? enriched.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    let uid: string | null | undefined = parsed.data.user_id;

    const inviteEmail = parsed.data.invite_email?.trim().toLowerCase();
    const invitePassword = parsed.data.invite_password;
    if (inviteEmail && invitePassword) {
      const { data: authData, error: authErr } = await sb.auth.admin.createUser({
        email: inviteEmail,
        password: invitePassword,
        email_confirm: true,
        user_metadata: { full_name: parsed.data.name },
      });
      if (authErr) {
        const msg = authErr.message || 'Création du compte impossible';
        const st = msg.toLowerCase().includes('already') ? 409 : 400;
        return NextResponse.json({ error: msg }, { status: st });
      }
      const newId = authData.user?.id;
      if (!newId) {
        return NextResponse.json({ error: 'Compte créé mais UUID manquant' }, { status: 500 });
      }
      uid = newId;
      const nm = splitDriverDisplayName(parsed.data.name);
      const { error: profErr } = await sb.from('profiles').upsert(
        {
          id: newId,
          email: inviteEmail,
          first_name: nm.first,
          last_name: nm.last,
          role: 'driver',
        },
        { onConflict: 'id' },
      );
      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 500 });
      }
    }

    if (uid) {
      const { data: existing } = await sb.from('drivers').select('id').eq('user_id', uid).maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'Ce compte est déjà enregistré comme livreur' }, { status: 409 });
      }
    }

    const insert: Record<string, unknown> = {
      user_id: uid ?? null,
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      vehicle_type: parsed.data.vehicle_type ?? null,
      vehicle_plate: parsed.data.vehicle_plate ?? null,
      vehicle_color: parsed.data.vehicle_color ?? null,
      is_active: true,
    };
    if (parsed.data.documents !== undefined) insert.documents = parsed.data.documents;

    const { data: created, error } = await sb.from('drivers').insert(insert).select('id, user_id').single();
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'driver',
      entityId: created?.id,
      entityName: String(insert.name),
      changes: { after: created as Record<string, unknown> },
      description: uid ? 'Création livreur (compte lié)' : 'Création livreur (fiche autonome)',
    });

    if (uid) {
      await sb.from('profiles').update({ role: 'driver' }).eq('id', uid);
    }

    return NextResponse.json({ driver: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
