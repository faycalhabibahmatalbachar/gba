import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

/** Clôture les sessions applicatives (user_sessions). Les refresh tokens Supabase Auth restent gérés côté hébergeur. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'UUID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const now = new Date().toISOString();

  try {
    const { error } = await sb
      .from('user_sessions')
      .update({ ended_at: now })
      .eq('user_id', id)
      .is('ended_at', null);

    if (error) {
      return NextResponse.json(
        {
          ok: true,
          closed: 0,
          note: 'Table user_sessions absente ou vide — aucune ligne fermée.',
        },
        { status: 200 },
      );
    }

    await writeAuditLog({
      actorUserId: auth.userId,
      actionType: 'permission_change',
      entityType: 'user',
      entityId: id,
      description: 'Révocation sessions applicatives (user_sessions)',
      status: 'success',
      metadata: { target_user_id: id },
    });

    return NextResponse.json({
      ok: true,
      note:
        'Sessions applicatives clôturées si présentes. Pour invalider immédiatement tous les refresh tokens Auth, utilisez le dashboard Supabase (Auth → Users → Sign out all sessions) ou une Edge Function avec l’API Admin dédiée à votre version.',
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
