import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

/** Marque comme lus les messages entrants (non envoyés par l’admin) dans la conversation. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { error } = await sb
    .from('chat_messages')
    .update({ is_read: true })
    .eq('conversation_id', id)
    .neq('sender_id', auth.userId)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'update',
    entityType: 'conversation',
    entityId: id,
    entityName: 'mark_read',
    description: 'Marquer tous les messages comme lus',
  });

  return NextResponse.json({ ok: true });
}
