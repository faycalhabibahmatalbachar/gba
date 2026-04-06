import { supabase } from '@/lib/supabase/client';

export type UserWithStats = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_online?: boolean | null;
  last_seen_at?: string | null;
  is_suspended?: boolean | null;
  avatar_url?: string | null;
  unread_count: number;
  conversation_count: number;
  last_message_at?: string | null;
};

export async function fetchUsersWithMessageStats(): Promise<UserWithStats[]> {
  // Fetch profiles with conversation stats
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, role, is_online, last_seen_at, is_suspended, avatar_url')
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) throw error;

  const userIds = (profiles || []).map((p: any) => p.id);
  if (!userIds.length) return [];

  // Fetch conversation stats per user
  const { data: convStats } = await supabase
    .from('conversations')
    .select('user_id, id, unread_count, last_message_at')
    .in('user_id', userIds);

  const statsMap: Record<string, { unread: number; count: number; lastAt: string | null }> = {};
  for (const c of (convStats || []) as any[]) {
    if (!statsMap[c.user_id]) statsMap[c.user_id] = { unread: 0, count: 0, lastAt: null };
    statsMap[c.user_id].unread += c.unread_count || 0;
    statsMap[c.user_id].count += 1;
    if (!statsMap[c.user_id].lastAt || c.last_message_at > statsMap[c.user_id].lastAt!) {
      statsMap[c.user_id].lastAt = c.last_message_at;
    }
  }

  return ((profiles || []) as any[]).map((p) => ({
    ...p,
    unread_count: statsMap[p.id]?.unread || 0,
    conversation_count: statsMap[p.id]?.count || 0,
    last_message_at: statsMap[p.id]?.lastAt || null,
  }));
}

export type ConversationRow = {
  id: string;
  user_id: string;
  status?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  tags?: string[] | null;
  created_at: string;
};

export async function fetchUserConversations(userId: string): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_id, status, last_message, last_message_at, unread_count, tags, created_at')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []) as ConversationRow[];
}

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id?: string | null;
  content: string;
  is_admin?: boolean | null;
  is_internal_note?: boolean | null;
  image_url?: string | null;
  read_at?: string | null;
  created_at: string;
};

export async function fetchConversationMessages(convId: string, limit = 100): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, is_admin, is_internal_note, image_url, read_at, created_at')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as MessageRow[];
}

export async function sendMessage(convId: string, senderId: string, content: string, isAdminNote = false): Promise<void> {
  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: convId,
    sender_id: senderId,
    content,
    is_admin: true,
    is_internal_note: isAdminNote,
  });
  if (msgErr) throw msgErr;

  if (!isAdminNote) {
    await supabase.from('conversations').update({
      last_message: content,
      last_message_at: new Date().toISOString(),
    }).eq('id', convId);
  }
}

export async function markConversationRead(convId: string): Promise<void> {
  await supabase.from('conversations').update({ unread_count: 0 }).eq('id', convId);
  await supabase.from('messages').update({ read_at: new Date().toISOString() })
    .eq('conversation_id', convId)
    .is('read_at', null)
    .eq('is_admin', false);
}

export async function updateConversationStatus(convId: string, status: 'open' | 'resolved' | 'pending' | 'urgent'): Promise<void> {
  const { error } = await supabase.from('conversations').update({ status }).eq('id', convId);
  if (error) throw error;
}

export async function createConversation(userId: string, adminId: string, initialMessage: string): Promise<ConversationRow> {
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ user_id: userId, status: 'open', last_message: initialMessage, last_message_at: new Date().toISOString() })
    .select('id, user_id, status, last_message, last_message_at, unread_count, tags, created_at')
    .single();
  if (convErr) throw convErr;
  await sendMessage(conv.id, adminId, initialMessage, false);
  return conv as ConversationRow;
}

export type MessagesKpis = {
  openConversations: number;
  unresolvedOldCount: number;
  totalUnread: number;
  onlineUsers: number;
};

export async function fetchMessagesKpis(): Promise<MessagesKpis> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [openRes, oldRes, unreadRes, onlineRes] = await Promise.all([
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'open').lt('last_message_at', oneHourAgo),
    supabase.from('conversations').select('unread_count').gt('unread_count', 0),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
  ]);
  const totalUnread = ((unreadRes.data || []) as any[]).reduce((s, r) => s + (r.unread_count || 0), 0);
  return {
    openConversations: openRes.count ?? 0,
    unresolvedOldCount: oldRes.count ?? 0,
    totalUnread,
    onlineUsers: onlineRes.count ?? 0,
  };
}
