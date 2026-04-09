import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { decodeCursor, encodeCursor } from '@/app/api/messages/_lib/cursor';

export const dynamic = 'force-dynamic';

const PAGE = 30;

type ConvRow = {
  id: string;
  user_id: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  type: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  is_online: boolean | null;
  last_seen_at: string | null;
  avatar_url: string | null;
};

function contactName(p: ProfileRow | undefined): string {
  if (!p) return 'Contact';
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return n || p.email || 'Utilisateur';
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = decodeCursor(searchParams.get('cursor'));
  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const filter = (searchParams.get('filter') || 'all').trim();

  try {
    const probe = await sb.from('chat_conversations').select('id').limit(1);
    if (probe.error) throw probe.error;
    if (!probe.data?.length) {
      return NextResponse.json({ conversations: [], next_cursor: null });
    }

    let roleUserIds: string[] | null = null;
    if (filter === 'clients') {
      const { data: rp } = await sb.from('profiles').select('id').in('role', ['client', 'customer', 'user']);
      roleUserIds = (rp || []).map((r: { id: string }) => r.id);
    } else if (filter === 'drivers') {
      const { data: rp } = await sb.from('profiles').select('id').in('role', ['driver']);
      roleUserIds = (rp || []).map((r: { id: string }) => r.id);
    } else if (filter === 'admins') {
      const { data: rp } = await sb.from('profiles').select('id').in('role', ['admin', 'superadmin', 'super_admin']);
      roleUserIds = (rp || []).map((r: { id: string }) => r.id);
    }

    let unreadConvIds: string[] | null = null;
    if (filter === 'unread') {
      const { data: um } = await sb
        .from('chat_messages')
        .select('conversation_id')
        .eq('is_read', false)
        .is('deleted_at', null)
        .limit(2000);
      unreadConvIds = [...new Set((um || []).map((r: { conversation_id: string }) => r.conversation_id))];
      if (unreadConvIds.length === 0) {
        return NextResponse.json({ conversations: [], next_cursor: null });
      }
    }

    let q = sb
      .from('chat_conversations')
      .select('id, user_id, status, created_at, updated_at, title, metadata, type')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(PAGE + 1);

    if (filter === 'broadcast') {
      q = q.eq('type', 'broadcast');
    } else if (unreadConvIds !== null) {
      q = q.in('id', unreadConvIds);
    } else if (roleUserIds !== null) {
      if (roleUserIds.length === 0) {
        return NextResponse.json({ conversations: [], next_cursor: null });
      }
      q = q.in('user_id', roleUserIds);
    }

    if (cursor) {
      const { c, i } = cursor;
      q = q.or(`updated_at.lt.${c},and(updated_at.eq.${c},id.lt.${i})`);
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    let list = (rows || []) as ConvRow[];
    const hasMore = list.length > PAGE;
    if (hasMore) list = list.slice(0, PAGE);

    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
    let profiles: ProfileRow[] = [];
    if (userIds.length) {
      const { data: profs, error: pe } = await sb
        .from('profiles')
        .select('id, first_name, last_name, email, role, is_online, last_seen_at, avatar_url')
        .in('id', userIds);
      if (pe) throw pe;
      profiles = (profs || []) as ProfileRow[];
    }
    const profMap = new Map(profiles.map((p) => [p.id, p]));

    const convIds = list.map((c) => c.id);
    const unreadMap = new Map<string, number>();
    const lastMap = new Map<string, { excerpt: string; at: string }>();

    if (convIds.length) {
      const { data: msgs } = await sb
        .from('chat_messages')
        .select('id, conversation_id, message, created_at, is_read, sender_id, deleted_at')
        .in('conversation_id', convIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(800);

      const seenLast = new Set<string>();
      for (const m of msgs || []) {
        const cid = m.conversation_id as string;
        if (!seenLast.has(cid)) {
          seenLast.add(cid);
          const text = (m.message as string) || (m as { image_url?: string }).image_url || '';
          lastMap.set(cid, { excerpt: String(text).slice(0, 120), at: m.created_at as string });
        }
        if (m.is_read === false) {
          unreadMap.set(cid, (unreadMap.get(cid) || 0) + 1);
        }
      }
    }

    let enriched = list.map((row) => {
      const p = row.user_id ? profMap.get(row.user_id) : undefined;
      const last = lastMap.get(row.id);
      const unread = unreadMap.get(row.id) || 0;
      return {
        id: row.id,
        user_id: row.user_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        title: row.title,
        metadata: row.metadata || {},
        type: row.type || 'direct',
        contact_name: contactName(p),
        contact_email: p?.email ?? null,
        contact_role: p?.role ?? null,
        is_online: p?.is_online ?? false,
        last_seen_at: p?.last_seen_at ?? null,
        avatar_url: p?.avatar_url ?? null,
        last_message_excerpt: last?.excerpt ?? '',
        last_message_at: last?.at ?? row.updated_at,
        unread_count: unread,
      };
    });

    if (search) {
      enriched = enriched.filter(
        (e) =>
          e.contact_name.toLowerCase().includes(search) ||
          (e.contact_email || '').toLowerCase().includes(search) ||
          e.last_message_excerpt.toLowerCase().includes(search),
      );
    }

    const last = list[list.length - 1];
    const next_cursor =
      hasMore && last?.updated_at && last?.id ? encodeCursor(last.updated_at, last.id) : null;

    return NextResponse.json({ conversations: enriched, next_cursor: next_cursor });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

const postSchema = z.object({
  participant_id: z.string().uuid(),
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
    const uid = parsed.data.participant_id;
    const existing = await sb
      .from('chat_conversations')
      .select('id')
      .eq('user_id', uid)
      .eq('type', 'direct')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) {
      return NextResponse.json({ conversation: { id: existing.data.id }, reused: true });
    }

    const insert = {
      user_id: uid,
      title: null as string | null,
      type: 'direct',
      status: 'active',
      metadata: {} as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb.from('chat_conversations').insert(insert).select('id').single();
    if (error) throw error;
    return NextResponse.json({ conversation: data, reused: false });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
