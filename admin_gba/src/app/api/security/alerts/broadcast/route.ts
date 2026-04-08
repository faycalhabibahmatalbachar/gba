import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { emitAdminNotification } from '@/lib/email/notification-dispatcher';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  headline: z.string().min(3).max(180),
  message: z.string().min(3).max(5000),
  severity: z.enum(['low', 'normal', 'high']).default('normal'),
  media_urls: z.array(z.string().url()).max(8).optional().default([]),
  send_chat_broadcast: z.boolean().optional().default(true),
  filters: z
    .object({
      role: z.string().optional(),
      country: z.string().optional(),
    })
    .optional()
    .default({}),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const payload = parsed.data;
  const emailOut = await emitAdminNotification({
    type: 'security_alert',
    payload: {
      headline: payload.headline,
      detail: `${payload.message}${payload.media_urls.length ? `<br/><br/>Médias:<br/>${payload.media_urls.join('<br/>')}` : ''}`,
      meta: `actor=${auth.email || auth.userId}`,
    },
    actorUserId: auth.userId,
    entityId: `security_broadcast:${Date.now()}`,
    priority: payload.severity,
  });

  let chatCreated = 0;
  let recipientCount = 0;
  if (payload.send_chat_broadcast) {
    let sb: ReturnType<typeof getServiceSupabase>;
    try {
      sb = getServiceSupabase();
    } catch {
      return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
    }
    let pq = sb.from('profiles').select('id');
    if (payload.filters.role) pq = pq.eq('role', payload.filters.role);
    if (payload.filters.country) pq = pq.eq('country', payload.filters.country);
    const { data: profs, error } = await pq.limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const userIds = (profs || []).map((p: { id: string }) => p.id);
    recipientCount = userIds.length;
    const text = `${payload.headline}\n\n${payload.message}${payload.media_urls.length ? `\n\nMedia:\n${payload.media_urls.join('\n')}` : ''}`;
    for (const uid of userIds) {
      const { data: conv } = await sb
        .from('chat_conversations')
        .insert({
          user_id: uid,
          type: 'broadcast',
          status: 'active',
          title: `[SECURITY] ${payload.headline}`,
          metadata: { broadcast: true, category: 'security_alert', severity: payload.severity },
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (!conv?.id) continue;
      const { error: me } = await sb.from('chat_messages').insert({
        conversation_id: conv.id,
        sender_id: auth.userId,
        message: text,
        message_type: payload.media_urls.length ? 'file' : 'system',
        attachments: payload.media_urls.map((url) => ({ url })),
        is_read: false,
      });
      if (!me) chatCreated += 1;
    }
  }
  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'send_notification',
    entityType: 'notification',
    entityId: `security_broadcast:${Date.now()}`,
    entityName: payload.headline,
    metadata: {
      severity: payload.severity,
      recipient_count: recipientCount,
      chat_created: chatCreated,
      email_sent: emailOut.sent,
    },
  });

  return NextResponse.json({
    ok: true,
    email_sent: emailOut.sent,
    email_reason: emailOut.reason || null,
    chat_created: chatCreated,
    recipient_count: recipientCount,
  });
}
