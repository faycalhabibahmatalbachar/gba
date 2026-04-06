import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { countEligibleUsers, type PushFilters } from '@/app/api/admin/push/_lib/segment-users';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { pushFiltersSchema } from '@/app/api/notifications/_lib/push-filters-schema';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  filters: pushFiltersSchema.optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const now = new Date().toISOString();
  const upd: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) upd.name = parsed.data.name;
  if (parsed.data.description !== undefined) upd.description = parsed.data.description;
  if (parsed.data.filters !== undefined) {
    const f = parsed.data.filters as PushFilters;
    upd.filters = f;
    try {
      upd.estimated_devices = await countEligibleUsers(sb, f);
      upd.last_estimated_at = now;
    } catch {
      /* ignore recount failure */
    }
  }

  if (Object.keys(upd).length === 0) {
    return NextResponse.json({ data: { ok: true } });
  }

  try {
    const { error } = await sb.from('notification_segments').update(upd).eq('id', id);
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'update',
      entityType: 'notification',
      entityId: id,
      description: 'Mise à jour segment notification',
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { error } = await sb.from('notification_segments').delete().eq('id', id);
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'delete',
      entityType: 'notification',
      entityId: id,
      description: 'Suppression segment notification',
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
