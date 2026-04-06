import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { loadUserSessionRows } from '@/app/api/users/_lib/user-sessions';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const rows = await loadUserSessionRows(sb, id);
  return NextResponse.json({ data: rows, meta: { total: rows.length } });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    await sb.from('user_sessions').delete().eq('user_id', id);
  } catch {
    /* table absente */
  }

  const { error: rpcErr } = await sb.rpc('admin_revoke_user_refresh_tokens', { p_user_id: id });
  if (rpcErr) {
    console.warn('[sessions] admin_revoke_user_refresh_tokens:', rpcErr.message);
    /* La migration SQL peut ne pas être appliquée : on continue (user_sessions nettoyée si existante). */
  }

  try {
    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'permission_change',
      entityType: 'user',
      entityId: id,
      description: 'Déconnexion forcée (sessions révoquées)',
      metadata: { scope: 'global_sign_out' },
    });
  } catch {
    /* optional */
  }

  return NextResponse.json({ ok: true });
}
