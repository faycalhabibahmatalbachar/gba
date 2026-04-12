import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  session_ttl_days: z.number().int().min(1).max(365).optional(),
  /** ISO 8601 ou null pour lever une expiration planifiée */
  account_expires_at: z.string().min(4).optional().nullable(),
  internal_note: z.string().max(2000).optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const keys = Object.keys(parsed.data).filter((k) => parsed.data[k as keyof typeof parsed.data] !== undefined);
  const onlyNote =
    keys.length === 1 && keys[0] === 'internal_note';
  const auth = onlyNote ? await requireAdmin() : await requireSuperAdmin();
  if (!auth.ok) return auth.response;

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

    const key = `admin_session_config_${id}`;
    const { data: curRow } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
    const cur =
      curRow?.value && typeof curRow.value === 'object' && !Array.isArray(curRow.value)
        ? (curRow.value as Record<string, unknown>)
        : {};
    const next = { ...cur, ...parsed.data };

    const { error } = await sb.from('settings').upsert(
      {
        key,
        value: next as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
      },
      { onConflict: 'key' },
    );
    if (error) throw error;

    const actorRole = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: actorRole,
      actionType: 'update',
      entityType: 'setting',
      entityId: key,
      changes: { before: cur, after: next },
      description: 'Configuration session / expiration compte admin',
    });

    return NextResponse.json({ ok: true, config: next });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

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

    const { data } = await sb.from('settings').select('value').eq('key', `admin_session_config_${id}`).maybeSingle();
    const config =
      data?.value && typeof data.value === 'object' && !Array.isArray(data.value)
        ? (data.value as Record<string, unknown>)
        : {};
    return NextResponse.json({ config });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
