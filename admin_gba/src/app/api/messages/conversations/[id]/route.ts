import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
export const dynamic = 'force-dynamic';

const MSG_PAGE = 50;

function decodeMsgCursor(s: string | null): { t: string; i: string } | null {
  if (!s) return null;
  try {
    const j = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { t?: string; i?: string };
    if (j.t && j.i) return { t: j.t, i: j.i };
  } catch {
    /* ignore */
  }
  return null;
}

function encodeMsgCursor(t: string, i: string): string {
  return Buffer.from(JSON.stringify({ t, i }), 'utf8').toString('base64url');
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { searchParams } = new URL(req.url);
  const older = decodeMsgCursor(searchParams.get('cursor'));

  try {
    const { data: conv, error: ce } = await sb
      .from('chat_conversations')
      .select('id, user_id, status, created_at, updated_at, title, metadata, type')
      .eq('id', id)
      .maybeSingle();
    if (ce) throw ce;
    if (!conv) return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });

    let profile: Record<string, unknown> | null = null;
    if (conv.user_id) {
      const { data: p } = await sb
        .from('profiles')
        .select('id, first_name, last_name, email, role, is_online, last_seen_at, avatar_url, phone')
        .eq('id', conv.user_id)
        .maybeSingle();
      profile = p;
    }

    let mq = sb
      .from('chat_messages')
      .select(
        'id, conversation_id, sender_id, message, is_read, created_at, image_url, attachments, message_type, edited_at, deleted_at, reply_to_id, metadata',
      )
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MSG_PAGE + 1);

    if (older) {
      mq = mq.or(`created_at.lt.${older.t},and(created_at.eq.${older.t},id.lt.${older.i})`);
    }

    const { data: rawMsgs, error: me } = await mq;
    if (me) throw me;

    let msgs = rawMsgs || [];
    const hasMore = msgs.length > MSG_PAGE;
    if (hasMore) msgs = msgs.slice(0, MSG_PAGE);
    const chronological = [...msgs].reverse();
    const first = msgs[msgs.length - 1] as { created_at?: string; id?: string } | undefined;
    const next_cursor_older =
      hasMore && first?.created_at && first?.id ? encodeMsgCursor(first.created_at, first.id) : null;

    const { count: msgCount } = await sb
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', id)
      .is('deleted_at', null);

    const { data: firstRow } = await sb
      .from('chat_messages')
      .select('created_at')
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const mapped = chronological.map((m: Record<string, unknown>) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      body: (m.message as string) || '',
      is_read: m.is_read,
      created_at: m.created_at,
      image_url: m.image_url,
      attachments: m.attachments,
      message_type: m.message_type || 'text',
      reply_to_id: m.reply_to_id,
      metadata: m.metadata,
    }));

    return NextResponse.json({
      conversation: conv,
      participant: profile,
      messages: mapped,
      next_cursor_older,
      stats: {
        message_count: msgCount ?? 0,
        first_message_at: firstRow?.created_at ?? null,
        avg_response_time: '—',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

const patchSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: z.string().max(40).optional(),
  admin_notes: z.string().max(10000).optional(),
  tags: z.array(z.string()).max(50).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
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
    const { data: cur } = await sb
      .from('chat_conversations')
      .select('id, metadata, status')
      .eq('id', id)
      .maybeSingle();
    if (!cur) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const meta = { ...((cur.metadata as Record<string, unknown>) || {}) };
    if (parsed.data.admin_notes !== undefined) meta.admin_notes = parsed.data.admin_notes;
    if (parsed.data.tags !== undefined) meta.tags = parsed.data.tags;
    if (parsed.data.metadata) Object.assign(meta, parsed.data.metadata);

    const upd: Record<string, unknown> = { updated_at: new Date().toISOString(), metadata: meta };
    if (parsed.data.status !== undefined) upd.status = parsed.data.status;

    const { error } = await sb.from('chat_conversations').update(upd).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
