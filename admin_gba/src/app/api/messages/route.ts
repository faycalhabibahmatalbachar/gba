import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { emitAdminNotification } from '@/lib/email/notification-dispatcher';

export const dynamic = 'force-dynamic';

const attachmentSchema = z.object({
  url: z.string(),
  name: z.string().optional(),
  size: z.number().optional(),
  type: z.string().optional(),
});

const postSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().max(20000).optional().default(''),
  attachments: z.array(attachmentSchema).optional().default([]),
  reply_to_id: z.string().uuid().nullable().optional(),
  message_type: z.enum(['text', 'image', 'file', 'audio', 'system', 'location']).optional().default('text'),
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

  const parsed = postSchema.safeParse(body);
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
    const firstAtt = parsed.data.attachments[0];
    const row: Record<string, unknown> = {
      conversation_id: parsed.data.conversation_id,
      sender_id: auth.userId,
      message: parsed.data.body,
      is_read: true,
      message_type: parsed.data.message_type,
      attachments: parsed.data.attachments,
      reply_to_id: parsed.data.reply_to_id ?? null,
      image_url:
        parsed.data.message_type === 'image' && firstAtt?.url ? firstAtt.url : null,
    };

    const { data: ins, error } = await sb.from('chat_messages').insert(row).select('id').single();
    if (error) throw error;

    await sb
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', parsed.data.conversation_id);

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'message',
      entityId: ins?.id,
      entityName: 'chat_message',
      changes: { after: { conversation_id: parsed.data.conversation_id, message_type: parsed.data.message_type } },
      metadata: { conversation_id: parsed.data.conversation_id },
    });
    const preview =
      parsed.data.body.trim().slice(0, 400) ||
      (parsed.data.attachments.length ? '[Pièce jointe]' : '—');
    await emitAdminNotification({
      type: 'message_created',
      payload: {
        conversation_id: parsed.data.conversation_id,
        message_type: parsed.data.message_type,
        preview,
      },
      actorUserId: auth.userId,
      entityId: ins?.id || null,
      priority: 'normal',
    });

    return NextResponse.json({ message: ins });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
