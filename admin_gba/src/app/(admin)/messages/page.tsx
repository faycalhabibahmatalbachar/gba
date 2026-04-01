'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { Send, MessageCircle, RefreshCw, User } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

type Conversation = {
  id: string;
  user_id: string;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  user?: { full_name?: string | null; email?: string | null; first_name?: string | null; last_name?: string | null };
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_admin?: boolean | null;
  created_at: string;
};

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Hier';
    return format(d, 'dd/MM', { locale: fr });
  } catch { return ''; }
}

function getUserLabel(conv: Conversation) {
  const u = conv.user;
  if (!u) return 'Client';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || u.email || 'Client';
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, user_id, last_message, last_message_at, unread_count, profiles:user_id(full_name, email, first_name, last_name)')
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const convs: Conversation[] = (data || []).map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        unread_count: c.unread_count ?? 0,
        user: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
      }));
      setConversations(convs);
    } catch { /* silently fail */ }
    finally { setLoadingConvs(false); }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, is_admin, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      setMessages((data || []) as Message[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch { /* silently fail */ }
    finally { setLoadingMsgs(false); }
  }, []);

  // Initial load
  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime: new conversations + messages
  useEffect(() => {
    const ch = supabase
      .channel('admin-messages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => { loadConversations(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.conversation_id === activeConvId) {
          setMessages(prev => [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeConvId, loadConversations]);

  const selectConv = useCallback((convId: string) => {
    setActiveConvId(convId);
    setMessages([]);
    loadMessages(convId);
    chatInputRef.current?.focus();
  }, [loadMessages]);

  const sendMessage = async () => {
    if (!draft.trim() || !activeConvId || sending) return;
    const content = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConvId,
        sender_id: user?.id,
        content,
        is_admin: true,
      });
      if (error) throw error;
      await supabase.from('conversations').update({ last_message: content, last_message_at: new Date().toISOString(), unread_count: 0 }).eq('id', activeConvId);
    } catch (e: any) {
      setDraft(content);
    } finally { setSending(false); }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Messages"
        subtitle={`${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={loadConversations}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <div className="flex flex-1 gap-3 overflow-hidden mt-5">
        {/* Conversation list */}
        <Card className="w-72 shrink-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="p-3 space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="Aucune conversation" />
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConv(conv.id)}
                  className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-border/50 hover:bg-muted/20 ${activeConvId === conv.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <span className="text-xs font-bold text-primary">{getUserLabel(conv)[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">{getUserLabel(conv)}</span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(conv.last_message_at)}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message || 'Aucun message'}
                    </p>
                    {(conv.unread_count ?? 0) > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold mt-1">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat panel */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {!activeConvId ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={<MessageCircle className="h-8 w-8" />}
                title="Sélectionner une conversation"
                description="Cliquez sur une conversation pour voir les messages."
              />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{activeConv ? getUserLabel(activeConv) : '—'}</p>
                  <p className="text-xs text-muted-foreground">{activeConv?.user?.email}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState title="Aucun message" description="Les messages apparaîtront ici." />
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${msg.is_admin ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                        <p>{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${msg.is_admin ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {fmtTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 p-3 border-t border-border">
                <Input
                  ref={chatInputRef}
                  placeholder="Écrire un message..."
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  className="flex-1 h-9 text-sm"
                  disabled={sending}
                />
                <Button size="sm" className="h-9 w-9 p-0" onClick={sendMessage} disabled={!draft.trim() || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
