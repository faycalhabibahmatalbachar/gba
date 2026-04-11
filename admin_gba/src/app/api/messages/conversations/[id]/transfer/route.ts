import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  new_participant_id: z.string().uuid(),
});

/** Réassigne la conversation directe à un autre profil (user_id). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
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
    const { data: cur, error: le } = await sb
      .from('chat_conversations')
      .select('id, user_id, metadata, type')
      .eq('id', id)
      .maybeSingle();
    if (le) throw le;
    if (!cur) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const prev = cur.user_id as string | null;
    const meta = { ...((cur.metadata as Record<string, unknown>) || {}) };
    const hist = Array.isArray(meta.transfer_history) ? [...(meta.transfer_history as unknown[])] : [];
    hist.push({
      at: new Date().toISOString(),
      from_user_id: prev,
      to_user_id: parsed.data.new_participant_id,
      by_admin_id: auth.userId,
    });
    meta.transfer_history = hist.slice(-20);

    const { error } = await sb
      .from('chat_conversations')
      .update({
        user_id: parsed.data.new_participant_id,
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'assign',
      entityType: 'conversation',
      entityId: id,
      entityName: 'transfer',
      changes: { before: { user_id: prev }, after: { user_id: parsed.data.new_participant_id } },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
