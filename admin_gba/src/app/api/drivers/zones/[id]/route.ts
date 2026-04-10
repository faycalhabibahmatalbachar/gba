import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const geoJsonSchema = z.object({
  type: z.string(),
}).passthrough();

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.string().max(32).optional(),
  geojson: geoJsonSchema.optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('drivers', 'update');
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

  const upd: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.geojson) upd.geojson = parsed.data.geojson as Record<string, unknown>;
  Object.keys(upd).forEach((k) => upd[k] === undefined && delete upd[k]);

  try {
    const { error } = await sb.from('delivery_zones').update(upd).eq('id', id);
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'update',
      entityType: 'delivery',
      entityId: id,
      description: 'Mise à jour zone livraison',
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('drivers', 'delete');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { error } = await sb.from('delivery_zones').delete().eq('id', id);
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'delete',
      entityType: 'delivery',
      entityId: id,
      description: 'Suppression zone livraison',
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
