import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * Alertes tableau de bord (service role) — évite les requêtes client vers des tables inexistantes (ex. conversations).
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const [pendingRes, msgProbe] = await Promise.all([
    sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', twoHoursAgo),
    sb.from('chat_messages').select('conversation_id').eq('is_read', false).limit(500),
  ]);

  let unreadConversations = 0;
  if (!msgProbe.error && msgProbe.data?.length) {
    const ids = new Set(
      (msgProbe.data as { conversation_id?: string }[]).map((r) => r.conversation_id).filter(Boolean) as string[],
    );
    unreadConversations = ids.size;
  }

  return NextResponse.json({
    pending_stale_count: pendingRes.count ?? 0,
    chat_unread_conversations: unreadConversations,
  });
}
