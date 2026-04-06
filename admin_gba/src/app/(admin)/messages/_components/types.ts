export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean | null;
  created_at: string;
  image_url?: string | null;
  attachments?: unknown;
  message_type: string;
  reply_to_id?: string | null;
  metadata?: Record<string, unknown> | null;
  deleted_at?: string | null;
};

export type ConversationListItem = {
  id: string;
  user_id: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_role: string | null;
  is_online: boolean;
  last_seen_at: string | null;
  avatar_url: string | null;
  last_message_excerpt: string;
  last_message_at: string | null;
  unread_count: number;
  type: string;
  metadata: Record<string, unknown>;
};

export type MessagesPanel = 'list' | 'thread' | 'detail';
