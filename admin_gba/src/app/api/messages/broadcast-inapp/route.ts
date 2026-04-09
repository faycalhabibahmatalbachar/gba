import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    target: z.enum(['specific', 'segment', 'all']),
    user_ids: z.array(z.string().uuid()).optional().default([]),
    filters: z.record(z.string(), z.unknown()).optional().default({}),
    message: z.object({
      body: z.string().min(1).max(500),
      message_type: z.enum(['text', 'image', 'system']).default('text'),
      attachments: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    }),
    send_push: z.boolean().optional().default(false),
    push_title: z.string().optional(),
    push_body: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.target === 'specific' && data.user_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Au moins un UUID valide est requis pour le ciblage « utilisateurs spécifiques »',
        path: ['user_ids'],
      });
    }
  });

function zodErrorMessage(err: z.ZodError): string {
  const f = err.flatten();
  const formErrors = Array.isArray(f.formErrors) ? f.formErrors : [];
  const rawField = f.fieldErrors as Record<string, string[] | undefined> | undefined;
  const fieldErrors = rawField && typeof rawField === 'object' ? rawField : {};
  const parts = [
    ...formErrors.filter(Boolean),
    ...Object.entries(fieldErrors).flatMap(([k, msgs]) =>
      (Array.isArray(msgs) ? msgs : []).map((m) => `${k}: ${m}`),
    ),
  ];
  return parts.join(' · ') || 'Données invalides';
}

const BATCH = 50;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: zodErrorMessage(parsed.error), details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const sb = getServiceSupabase();
  const p = parsed.data;

  let recipientIds: string[] = [];
  if (p.target === 'specific') {
    recipientIds = p.user_ids;
  } else {
    let q = sb.from('profiles').select('id').eq('role', 'client');
    if (p.target === 'segment') {
      if (typeof p.filters.country === 'string' && p.filters.country) q = q.eq('country', p.filters.country);
      if (typeof p.filters.inactive_days === 'number') {
        const d = new Date(Date.now() - Number(p.filters.inactive_days) * 24 * 3600 * 1000).toISOString();
        q = q.lte('updated_at', d);
      }
    }
    const { data, error } = await q.limit(10000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    recipientIds = (data || []).map((x: { id: string }) => x.id);
  }

  const sentConvs: string[] = [];
  for (let i = 0; i < recipientIds.length; i += BATCH) {
    const batch = recipientIds.slice(i, i + BATCH);
    for (const uid of batch) {
      let conversationId: string | null = null;
      const existing = await sb.from('chat_conversations').select('id').eq('user_id', uid).eq('type', 'direct').order('updated_at', { ascending: false }).limit(1);
      conversationId = existing.data?.[0]?.id || null;
      if (!conversationId) {
        const created = await sb
          .from('chat_conversations')
          .insert({ user_id: uid, type: 'direct', status: 'active', created_by: auth.userId, is_broadcast: true, updated_at: new Date().toISOString() })
          .select('id')
          .single();
        conversationId = created.data?.id || null;
      }
      if (!conversationId) continue;
      const ins = await sb.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: auth.userId,
        message: p.message.body,
        message_type: p.message.message_type,
        attachments: p.message.attachments,
        is_read: false,
      });
      if (!ins.error) {
        sentConvs.push(conversationId);
        await sb.from('chat_conversations').update({ updated_at: new Date().toISOString(), is_broadcast: true, created_by: auth.userId }).eq('id', conversationId);
      }
    }
  }

  if (p.send_push && p.push_title && p.push_body && recipientIds.length) {
    await fetch(new URL('/api/admin/push/campaign', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: p.push_title, body: p.push_body, filters: { user_ids: recipientIds } }),
    }).catch(() => undefined);
  }

  const bl = await sb.from('broadcast_logs').insert({
    channel: 'in_app',
    target_filter: p.target === 'specific' ? { user_ids: recipientIds } : p.filters,
    message_body: p.message.body,
    message_type: p.message.message_type,
    sent_count: sentConvs.length,
    failed_count: Math.max(0, recipientIds.length - sentConvs.length),
    created_by: auth.userId,
    status: 'completed',
  });
  if (bl.error) {
    console.warn('[broadcast-inapp] broadcast_logs insert failed', bl.error.message);
  }

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'send_notification',
    entityType: 'message',
    description: 'Broadcast in-app',
    metadata: { channel: 'in_app', recipient_count: recipientIds.length, message_preview: p.message.body.slice(0, 50) },
  });

  return NextResponse.json({ success: true, sent_count: sentConvs.length, conversation_ids: sentConvs });
}
