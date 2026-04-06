import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
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
  const auth = await requireAdmin();
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

    const { data: locs } = await sb
      .from('driver_locations')
      .select('id, lat, lng, accuracy, accuracy_m, heading, speed_mps, created_at, captured_at, recorded_at, order_id')
      .eq('driver_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    const { data: recentOrders } = await sb
      .from('orders')
      .select('id, order_number, status, total_amount, created_at')
      .eq('driver_id', id)
      .order('created_at', { ascending: false })
      .limit(25);

    const now = new Date();
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
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
        orders_per_day: [] as { day: string; count: number }[],
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
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
      } else if (reason !== undefined) {
        await sb
          .from('profiles')
          .update({
            is_suspended: Boolean(reason && String(reason).length > 0),
            suspension_reason: reason ? String(reason) : null,
            suspended_at: reason ? new Date().toISOString() : null,
            suspended_by: reason ? auth.userId : null,
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
  const auth = await requireAdmin();
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
