import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { loadAdminPermissionMatrix } from '@/app/api/_lib/admin-permission';

export const dynamic = 'force-dynamic';

const matrixSchema = z.record(z.string(), z.record(z.string(), z.boolean()));

const pageAccessSchema = z.record(z.string(), z.boolean()).optional();

const patchBodySchema = z.object({
  matrix: matrixSchema.optional(),
  page_access: pageAccessSchema,
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: profile } = await sb.from('profiles').select('role').eq('id', id).maybeSingle();
    const r = String(profile?.role || '').toLowerCase();
    if (!['admin', 'superadmin', 'super_admin'].includes(r)) {
      return NextResponse.json({ error: 'Profil admin requis' }, { status: 400 });
    }

    const matrix = await loadAdminPermissionMatrix(id);
    const { data: pageRow } = await sb
      .from('settings')
      .select('value')
      .eq('key', `admin_page_access_${id}`)
      .maybeSingle();
    const page_access =
      pageRow?.value && typeof pageRow.value === 'object' && !Array.isArray(pageRow.value)
        ? (pageRow.value as Record<string, boolean>)
        : {};

    return NextResponse.json({ matrix, page_access });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sup = await requireSuperAdmin();
  if (!sup.ok) return sup.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const beforeMatrix = await loadAdminPermissionMatrix(id);

    if (parsed.data.matrix) {
      const { error } = await sb.from('settings').upsert(
        {
          key: `admin_permissions_${id}`,
          value: parsed.data.matrix as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
          updated_by: sup.userId,
        },
        { onConflict: 'key' },
      );
      if (error) throw error;
    }

    if (parsed.data.page_access) {
      const { error } = await sb.from('settings').upsert(
        {
          key: `admin_page_access_${id}`,
          value: parsed.data.page_access as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
          updated_by: sup.userId,
        },
        { onConflict: 'key' },
      );
      if (error) throw error;
    }

    const role = await fetchActorRole(sup.userId);
    await writeAuditLog({
      actorUserId: sup.userId,
      actorEmail: sup.email,
      actorRole: role,
      actionType: 'permission_change',
      entityType: 'permission',
      entityId: id,
      changes: {
        before: { matrix: beforeMatrix },
        after: { matrix: parsed.data.matrix, page_access: parsed.data.page_access },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
