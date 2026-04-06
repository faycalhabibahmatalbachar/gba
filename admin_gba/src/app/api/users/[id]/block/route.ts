import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: { action?: string; reason?: string; duration_hours?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'block' && action !== 'unblock') {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const start = Date.now();

  if (action === 'block') {
    const reason = (body.reason || 'Blocage administratif').slice(0, 500);
    const hours = body.duration_hours;
    const banDuration =
      hours != null && hours > 0 ? `${Math.min(hours, 876000)}h` : '876000h';

    const { error: banErr } = await sb.auth.admin.updateUserById(id, { ban_duration: banDuration });
    if (banErr) {
      return NextResponse.json({ error: banErr.message }, { status: 400 });
    }

    const { data: after, error: pe } = await sb
      .from('profiles')
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by: auth.userId,
        suspension_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (pe) return NextResponse.json({ error: pe.message }, { status: 400 });

    const { error: rpcE } = await sb.rpc('admin_revoke_user_refresh_tokens', { p_user_id: id });
    if (rpcE) console.warn('[block] admin_revoke_user_refresh_tokens:', rpcE.message);

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'status_change',
      entityType: 'user',
      entityId: id,
      description: `Blocage: ${reason}`,
      metadata: { duration_hours: hours },
    }).catch(() => null);

    return NextResponse.json({
      data: after,
      message: 'Compte bloqué',
      durationMs: Date.now() - start,
    });
  }

  const { error: unbanErr } = await sb.auth.admin.updateUserById(id, { ban_duration: '0' });
  if (unbanErr) {
    return NextResponse.json({ error: unbanErr.message }, { status: 400 });
  }

  const { data: after, error: ue } = await sb
    .from('profiles')
    .update({
      is_suspended: false,
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
    })
    .eq('id', id)
    .select()
    .single();

  if (ue) return NextResponse.json({ error: ue.message }, { status: 400 });

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'status_change',
    entityType: 'user',
    entityId: id,
    description: 'Déblocage compte',
  }).catch(() => null);

  return NextResponse.json({
    data: after,
    message: 'Compte débloqué',
    durationMs: Date.now() - start,
  });
}
