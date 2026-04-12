import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    try {
      await sb.from('user_sessions').delete().eq('user_id', id);
    } catch {
      /* table absente */
    }

    const { error: rpcErr } = await sb.rpc('admin_revoke_user_refresh_tokens', { p_user_id: id });
    if (rpcErr) {
      console.warn('[admin revoke-sessions]', rpcErr.message);
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'permission_change',
      entityType: 'user',
      entityId: id,
      description: 'Révocation sessions (admin command center)',
      metadata: { scope: 'global_sign_out' },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
