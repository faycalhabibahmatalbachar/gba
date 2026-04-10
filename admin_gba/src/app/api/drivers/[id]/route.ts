import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  is_active: z.boolean().optional(),
  is_available: z.boolean().optional(),
  is_online: z.boolean().optional(),
  vehicle_type: z.string().max(80).optional().nullable(),
  vehicle_plate: z.string().max(40).optional().nullable(),
  vehicle_color: z.string().max(80).optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional().nullable(),
  documents: z.unknown().optional(),
  suspension_reason: z.string().max(2000).optional().nullable(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('drivers', 'read');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data: driver, error } = await sb
      .from('drivers')
      .select(
        'id, user_id, name, phone, is_active, is_online, is_available, vehicle_type, vehicle_plate, vehicle_color, current_lat, current_lng, last_location_at, rating_avg, total_deliveries, total_earnings, documents, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!driver) return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 });

    const uid = driver.user_id as string | null;
    let profile: Record<string, unknown> | null = null;
    if (uid) {
      const { data: p } = await sb
        .from('profiles')
        .select('id, email, first_name, last_name, full_name, phone, avatar_url, city, country, role, is_suspended')
        .eq('id', uid)
        .maybeSingle();
      profile = p;
    }

    /** driver_locations.driver_id et orders.driver_id = auth user id (profiles.id), pas drivers.id */
    const locDriverKey = uid ?? id;
    const { data: locs } = await sb
      .from('driver_locations')
      .select('id, lat, lng, accuracy, accuracy_m, heading, speed_mps, created_at, captured_at, recorded_at, order_id')
      .eq('driver_id', locDriverKey)
      .order('captured_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);

    const orderDriverKey = uid ?? id;
    const { data: recentOrders } = await sb
      .from('orders')
      .select('id, order_number, status, total_amount, created_at, updated_at')
      .eq('driver_id', orderDriverKey)
      .order('created_at', { ascending: false })
      .limit(100);

    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 6);
    sevenAgo.setHours(0, 0, 0, 0);
    const { data: weekOrders } = await sb
      .from('orders')
      .select('created_at')
      .eq('driver_id', orderDriverKey)
      .gte('created_at', sevenAgo.toISOString());

    const dayKeys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const countsByDay = new Map<string, number>();
    for (const k of dayKeys) countsByDay.set(k, 0);
    for (const row of weekOrders || []) {
      const r = row as { created_at?: string };
      if (!r.created_at) continue;
      const k = r.created_at.slice(0, 10);
      if (countsByDay.has(k)) countsByDay.set(k, (countsByDay.get(k) || 0) + 1);
    }
    const orders_per_day = dayKeys.map((day) => ({ day, count: countsByDay.get(day) || 0 }));

    const ratings: number[] = [];
    for (let i = 0; i < 3; i++) {
      const base = Number(driver.rating_avg) || 4.2;
      ratings.push(Math.min(5, Math.max(3, Math.round((base + (i - 1) * 0.15) * 10) / 10)));
    }

    return NextResponse.json({
      driver,
      profile,
      locations: locs || [],
      orders: recentOrders || [],
      chart: {
        rating_series: ratings,
        orders_per_day,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('drivers', 'update');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
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
    const { data: before } = await sb
      .from('drivers')
      .select(
        'id, user_id, name, phone, is_active, is_online, is_available, vehicle_type, vehicle_plate, vehicle_color, documents',
      )
      .eq('id', id)
      .maybeSingle();

    if (!before) return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 });

    const updates: Record<string, unknown> = { ...parsed.data };
    const reason = updates.suspension_reason;
    delete updates.suspension_reason;

    if (parsed.data.documents !== undefined) {
      updates.documents = parsed.data.documents;
    }

    const { data: after, error } = await sb.from('drivers').update(updates).eq('id', id).select().single();
    if (error) throw error;

    const uid = before.user_id as string | null;
    if (uid) {
      if (updates.is_active === true) {
        await sb
          .from('profiles')
          .update({
            is_suspended: false,
            suspension_reason: null,
            suspended_at: null,
            suspended_by: null,
          })
          .eq('id', uid);
      } else if (updates.is_active === false) {
        const r = reason != null && String(reason).trim().length > 0 ? String(reason).trim() : null;
        await sb
          .from('profiles')
          .update({
            is_suspended: true,
            suspension_reason: r || 'Suspension administrative',
            suspended_at: new Date().toISOString(),
            suspended_by: auth.userId,
          })
          .eq('id', uid);
      }
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'update',
      entityType: 'driver',
      entityId: id,
      changes: {
        before: before as Record<string, unknown>,
        after: (after || {}) as Record<string, unknown>,
      },
      description: 'Mise à jour livreur',
    });

    return NextResponse.json({ driver: after });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('drivers', 'delete');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data: before } = await sb.from('drivers').select('id, user_id, is_active').eq('id', id).maybeSingle();
    if (!before) return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 });

    const { data: after, error } = await sb.from('drivers').update({ is_active: false }).eq('id', id).select().single();
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'delete',
      entityType: 'driver',
      entityId: id,
      changes: { before: before as Record<string, unknown>, after: after as Record<string, unknown> },
      description: 'Désactivation livreur (soft)',
    });

    return NextResponse.json({ ok: true, driver: after });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
