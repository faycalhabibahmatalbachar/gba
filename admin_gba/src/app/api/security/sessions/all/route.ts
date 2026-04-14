import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { error } = await sb.from('user_sessions').update({ ended_at: now }).is('ended_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actionType: 'delete',
    entityType: 'profile',
    entityId: 'all_sessions',
    description: 'Révocation totale des sessions via /api/security/sessions/all',
    status: 'success',
  });

  return NextResponse.json({ ok: true });
}
