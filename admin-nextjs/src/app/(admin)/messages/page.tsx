'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { App, Avatar, Badge, Button, Card, Drawer, Empty, Grid, Input, Modal, Select, Space, Spin, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { ArrowLeftOutlined, ArrowsAltOutlined, BellOutlined, BellFilled, MessageOutlined, PaperClipOutlined, PlusOutlined, SearchOutlined, SendOutlined, UserOutlined, CarOutlined, TeamOutlined, AlertOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '@/components/ui/PageHeader';
import ConversationThread from '@/components/messaging/ConversationThread';

export default function MessagesPage() {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const adminIdRef = useRef<string | null>(null);
  const chRef = useRef<any>(null);
  const selRef = useRef<ConversationRow | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [convs, setConvs] = useState<ConversationRow[]>([]);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newDlgOpen, setNewDlgOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [fsOpen, setFsOpen] = useState(false);

  const [mobileListOpen, setMobileListOpen] = useState(false);

  // Typing indicator state
  const [typingUser, setTypingUser] = useState<{ id: string; name: string } | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Online presence state
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sound notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Conversation status & assignment
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [admins, setAdmins] = useState<{ id: string; email: string }[]>([]);

  // Quick replies
  const [quickReplies, setQuickReplies] = useState<{ id: string; title: string; content: string }[]>([]);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);

  const statusOptions = [
    { value: 'open', label: 'Ouvert', color: 'green' },
    { value: 'pending', label: 'En attente', color: 'orange' },
    { value: 'resolved', label: 'Résolu', color: 'blue' },
    { value: 'spam', label: 'Spam', color: 'red' },
  ];

  const isImageUrl = (t?: string | null) => {
    if (!t) return false;
    const lower = t.toLowerCase();
    return !!lower.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/) || lower.includes('/storage/v1/object/public/');
  };

  const fmtTime = (ts?: string | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return d.toDateString() === y.toDateString() ? 'Hier' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const getName = (p?: ProfileRow | null) => {
    if (!p) return 'Utilisateur';
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || '?';
  };

  // Load admins for assignment
  const loadAdmins = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'admin');
    setAdmins(data || []);
  }, []);

  // Load quick replies
  const loadQuickReplies = useCallback(async () => {
    const { data } = await supabase
      .from('chat_quick_replies')
      .select('id, title, content')
      .order('title');
    setQuickReplies(data || []);
  }, []);

  // Update conversation status
  const updateStatus = useCallback(async (convId: string, status: string) => {
    await supabase.from('chat_conversations').update({ status }).eq('id', convId);
    setConvs((prev) => prev.map((c) => (c.id === convId ? { ...c, status } : c)));
    if (selected?.id === convId) {
      setSelected((prev) => (prev ? { ...prev, status } : null));
    }
  }, [selected]);

  // Update conversation assignment
  const updateAssignedTo = useCallback(async (convId: string, assignedTo: string | null) => {
    await supabase.from('chat_conversations').update({ assigned_to: assignedTo }).eq('id', convId);
    setConvs((prev) => prev.map((c) => (c.id === convId ? { ...c, assigned_to: assignedTo } : c)));
    if (selected?.id === convId) {
      setSelected((prev) => (prev ? { ...prev, assigned_to: assignedTo } : null));
    }
  }, [selected]);

  const loadConvs = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const { data: convData, error } = await supabase
        .from('chat_conversations')
        .select('id, user_id, status, assigned_to, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((convData || []).map((c: any) => c.user_id).filter(Boolean))] as string[];
      const profileMap: Record<string, ProfileRow> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, is_blocked')
          .in('id', userIds);
        (profs || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }

      const seenUsers = new Set<string>();
      const deduped = (convData || []).filter((c: any) => {
        if (!c.user_id || seenUsers.has(c.user_id)) return false;
        seenUsers.add(c.user_id);
        return true;
      });

      const base = deduped.map((c: any) => ({ ...c, profile: profileMap[c.user_id] || null, assigned_to: c.assigned_to }));

      const ids = base.map((c: any) => c.id);
      const unreadMap: Record<string, number> = {};
      if (ids.length && adminIdRef.current) {
        const { data: ur } = await supabase
          .from('chat_messages')
          .select('conversation_id')
          .in('conversation_id', ids)
          .eq('is_read', false)
          .neq('sender_id', adminIdRef.current);
        (ur || []).forEach((r: any) => {
          unreadMap[r.conversation_id] = (unreadMap[r.conversation_id] || 0) + 1;
        });
      }

      const withMeta = await Promise.all(
        base.map(async (c: any) => {
          const { data: lm } = await supabase
            .from('chat_messages')
            .select('message,sender_id,created_at')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return { ...c, unread: unreadMap[c.id] || 0, lastMsg: lm || null } as ConversationRow;
        }),
      );
      setConvs(withMeta);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement conversations');
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const MSG_PAGE_SIZE = 50;

  const loadMsgs = useCallback(async (conv: ConversationRow) => {
    setLoadingMsgs(true);
    setHasMoreMsgs(false);
    try {
      let q = supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .range(0, MSG_PAGE_SIZE - 1);
      try {
        q = q.is('deleted_at', null);
      } catch {
        // Column may not exist yet
      }
      const { data, error } = await q;
      if (error) throw error;
      const ordered = (data || []).reverse() as MessageRow[];
      setMsgs(ordered);
      setHasMoreMsgs((data || []).length >= MSG_PAGE_SIZE);

      if (adminIdRef.current) {
        const ids = (data || []).filter((m: any) => !m.is_read && m.sender_id !== adminIdRef.current).map((m: any) => m.id);
        if (ids.length) {
          await supabase.from('chat_messages').update({ is_read: true }).in('id', ids);
          setConvs((p) => p.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c)));
        }
      }
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement messages');
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const loadMoreMsgs = useCallback(async () => {
    if (!selected?.id || !msgs.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldestTs = msgs[0]?.created_at;
      if (!oldestTs) return;
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selected.id)
        .lt('created_at', oldestTs)
        .order('created_at', { ascending: false })
        .limit(MSG_PAGE_SIZE);
      if (error) throw error;
      const older = (data || []).reverse() as MessageRow[];
      setMsgs((p) => [...older, ...p]);
      setHasMoreMsgs(older.length >= MSG_PAGE_SIZE);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement');
    } finally {
      setLoadingMore(false);
    }
  }, [selected?.id, msgs, loadingMore]);

  const deleteMessages = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    Modal.confirm({
      title: 'Supprimer les messages',
      content: `Supprimer ${ids.length} message(s) pour tout le monde ?`,
      okText: 'Supprimer',
      okType: 'danger',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          const { error } = await supabase.from('chat_messages').delete().in('id', ids);
          if (error) throw error;
          setMsgs((p) => p.filter((m) => !ids.includes(m.id)));
          setSelectedMsgIds(new Set());
          setEditMode(false);
          message.success('Message(s) supprimé(s)');
        } catch (e: any) {
          message.error(e?.message || 'Erreur suppression');
        }
      },
    });
  }, []);

  const toggleMsgSelection = useCallback((id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectConv = useCallback(
    async (conv: ConversationRow) => {
      setSelected(conv);
      selRef.current = conv;
      setMsgs([]);
      setEditMode(false);
      setSelectedMsgIds(new Set());
      if (isMobile) setMobileListOpen(false);
      await loadMsgs(conv);
    },
    [loadMsgs, isMobile],
  );

  const setupRT = useCallback(() => {
    chRef.current?.unsubscribe?.();
    chRef.current = supabase
      .channel('admin-messenger-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, ({ new: m }: any) => {
        if (!m) return;
        const s = selRef.current;
        if (s?.id === m.conversation_id) {
          setMsgs((p) => (p.some((x) => x.id === m.id) ? p : [...p, m]));
          if (m.sender_id !== adminIdRef.current) {
            supabase.from('chat_messages').update({ is_read: true }).eq('id', m.id).then(() => {});
            // Play notification sound for incoming messages
            if (soundEnabled && audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
          }
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }

        setConvs((p) =>
          p
            .map((c) =>
              c.id !== m.conversation_id
                ? c
                : {
                    ...c,
                    lastMsg: { message: m.message, sender_id: m.sender_id, created_at: m.created_at },
                    unread:
                      m.sender_id !== adminIdRef.current && s?.id !== m.conversation_id
                        ? (c.unread || 0) + 1
                        : c.unread,
                    updated_at: m.created_at,
                  },
            )
            .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)),
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversations' }, () => void loadConvs())
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        // Only show typing from the other user in current conversation
        const s = selRef.current;
        if (s && payload.conversationId === s.id && payload.userId !== adminIdRef.current) {
          setTypingUser({ id: payload.userId, name: payload.userName || 'Utilisateur' });
          // Auto-clear after 3s
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
        }
      })
      .on('broadcast', { event: 'presence' }, ({ payload }: any) => {
        // Update online users set
        if (payload.userId && payload.online) {
          setOnlineUsers((prev) => new Set(prev).add(payload.userId));
        } else if (payload.userId) {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(payload.userId);
            return next;
          });
        }
      })
      .subscribe();
  }, [loadConvs]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      adminIdRef.current = data.user?.id || null;
      void loadConvs();
      void loadAdmins();
      void loadQuickReplies();
      setupRT();
    });
    // Start presence heartbeat
    presenceIntervalRef.current = setInterval(() => {
      if (adminIdRef.current) {
        chRef.current?.send({
          type: 'broadcast',
          event: 'presence',
          payload: { userId: adminIdRef.current, online: true },
        });
      }
    }, 25000);

    return () => {
      chRef.current?.unsubscribe?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
      // Broadcast offline on unmount
      if (adminIdRef.current) {
        chRef.current?.send({
          type: 'broadcast',
          event: 'presence',
          payload: { userId: adminIdRef.current, online: false },
        });
      }
    };
  }, [loadConvs, setupRT, loadAdmins, loadQuickReplies]);

  const filteredConvs = useMemo(() => {
    let result = convs;
    // Filter by segment (Clients / Livreurs / Interne / Alertes)
    if (segmentFilter === 'clients') {
      result = result.filter((c) => (c.profile as any)?.role === 'client' || !(c.profile as any)?.role);
    } else if (segmentFilter === 'drivers') {
      result = result.filter((c) => (c.profile as any)?.role === 'driver');
    } else if (segmentFilter === 'internal') {
      result = result.filter((c) => (c.profile as any)?.role === 'admin');
    } else if (segmentFilter === 'alerts') {
      result = result.filter((c) => (c.unread || 0) > 0 || c.status === 'pending');
    }
    // Filter by status
    if (statusFilter === 'unread') {
      result = result.filter((c) => (c.unread || 0) > 0);
    } else if (statusFilter === 'assigned') {
      result = result.filter((c) => !!c.assigned_to);
    } else if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }
    // Filter by search
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter((c) => {
        const name = getName(c.profile).toLowerCase();
        const email = (c.profile?.email || '').toLowerCase();
        const last = (c.lastMsg?.message || '').toLowerCase();
        return name.includes(s) || email.includes(s) || last.includes(s);
      });
    }
    // Deduplicate by id to avoid "Encountered two children with the same key"
    const byId = new Map<string, (typeof result)[0]>();
    for (const c of result) byId.set(c.id, c);
    return Array.from(byId.values());
  }, [convs, search, statusFilter, segmentFilter]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (!selected?.id || !adminIdRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      chRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          conversationId: selected.id,
          userId: adminIdRef.current,
          userName: 'Admin',
        },
      });
      // Reset after 2s
      setTimeout(() => {
        isTypingRef.current = false;
      }, 2000);
    }
  }, [selected]);

  const sendText = useCallback(async () => {
    if (!selected?.id) return;
    const content = text.trim();
    if (!content) return;
    if (!adminIdRef.current) {
      message.error('Admin non authentifié');
      return;
    }

    // Clear typing indicator on send
    setTypingUser(null);
    isTypingRef.current = false;

    setSending(true);
    const tmpId = `tmp-${Date.now()}`;
    setMsgs((p) => [
      ...p,
      {
        id: tmpId,
        conversation_id: selected.id,
        sender_id: adminIdRef.current,
        message: content,
        is_read: false,
        created_at: new Date().toISOString(),
        _pending: true,
      } as any,
    ]);
    setText('');

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ conversation_id: selected.id, sender_id: adminIdRef.current, message: content, is_read: false })
        .select()
        .single();
      if (error) throw error;
      setMsgs((p) => p.map((m) => (m.id === tmpId ? (data as any) : m)));
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', selected.id);

      try {
        await supabase.functions.invoke('send-push-notification', {
          body: { type: 'chat_message', record: data },
        });
      } catch {}
    } catch (e: any) {
      message.error(e?.message || 'Erreur envoi');
      setMsgs((p) => p.filter((m) => m.id !== tmpId));
    } finally {
      setSending(false);
    }
  }, [selected, text]);

  const uploadImageAndSend = useCallback(
    async (file: File) => {
      if (!selected?.id) return;
      if (!adminIdRef.current) {
        message.error('Admin non authentifié');
        return;
      }
      setUploading(true);
      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${selected.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(path);
        const url = pub.publicUrl;

        const { data, error } = await supabase
          .from('chat_messages')
          .insert({ conversation_id: selected.id, sender_id: adminIdRef.current, message: url, is_read: false })
          .select()
          .single();
        if (error) throw error;
        await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', selected.id);
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: { type: 'chat_message', record: data },
          });
        } catch {}
      } catch (e: any) {
        message.error(e?.message || 'Upload échoué');
      } finally {
        setUploading(false);
      }
    },
    [selected],
  );

  const openNewConversation = useCallback(async (userId: string) => {
    try {
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id, user_id, status, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        setNewDlgOpen(false);
        await loadConvs();
        const target = convs.find((c) => c.id === existing.id);
        if (target) void selectConv(target);
        return;
      }

      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: userId, status: 'open', updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      setNewDlgOpen(false);
      await loadConvs();
      // Select after reload
      const createdId = (data as any)?.id;
      const created = createdId ? convs.find((c) => c.id === createdId) : null;
      if (created) void selectConv(created);
    } catch (e: any) {
      message.error(e?.message || 'Erreur création conversation');
    }
  }, [loadConvs, convs, selectConv]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      let q = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .neq('role', 'admin')
        .order('created_at', { ascending: false })
        .limit(200);
      if (userSearch.trim()) {
        const s = userSearch.trim();
        q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setUsers((data || []) as any);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement utilisateurs');
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch]);

  useEffect(() => {
    if (!newDlgOpen) return;
    void loadUsers();
  }, [newDlgOpen, loadUsers]);

  const uploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: async (file) => {
      await uploadImageAndSend(file as File);
      return false;
    },
  };

  const convPreview = (c: ConversationRow) => {
    const last = c.lastMsg?.message || '';
    if (!last) return '';
    return isImageUrl(last) ? '📷 Photo' : last;
  };

  const ChatBubble = useCallback(
    ({ m, wide }: { m: MessageRow; wide?: boolean }) => {
      const mine = !!adminIdRef.current && m.sender_id === adminIdRef.current;
      const img = isImageUrl(m.message);
      const isSelected = selectedMsgIds.has(m.id);

      const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (img && m.message) {
          const a = document.createElement('a');
          a.href = m.message;
          a.download = `message-${m.id.slice(0, 8)}.jpg`;
          a.target = '_blank';
          a.click();
        }
      };

      const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteMessages([m.id]);
      };

      return (
        <div
          className="group flex gap-2"
          style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}
        >
          {editMode && !mine && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleMsgSelection(m.id)}
              className="mt-3 shrink-0"
            />
          )}
          <div
            className="relative"
            style={{
              maxWidth: wide ? 760 : 520,
              padding: img ? 6 : 10,
              borderRadius: 14,
              background: mine ? 'var(--msg-bubble-mine, #d9fdd3)' : 'var(--msg-bubble-other, #ffffff)',
              border: 'none',
              boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
            }}
          >
            {img ? (
              <div style={{ width: wide ? 520 : 320, maxWidth: '100%', borderRadius: 10, overflow: 'hidden' }}>
                <Image
                  src={m.message}
                  alt="Image"
                  width={wide ? 1040 : 640}
                  height={wide ? 780 : 480}
                  sizes={wide ? '(max-width: 768px) 90vw, 520px' : '(max-width: 768px) 90vw, 320px'}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</div>
            )}
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div style={{ fontSize: 11, opacity: 0.6 }}>{fmtTime(m.created_at)}{mine && (m as any)?._pending ? ' • …' : ''}</div>
              <Space size={4} className="opacity-0 group-hover:opacity-100 transition-opacity">
                {img && (
                  <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleDownload} title="Télécharger" />
                )}
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={handleDelete} title="Supprimer" />
              </Space>
            </div>
          </div>
          {editMode && mine && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleMsgSelection(m.id)}
              className="mt-3 shrink-0"
            />
          )}
        </div>
      );
    },
    [selectedMsgIds, editMode, toggleMsgSelection, deleteMessages],
  );

  // Initialize audio element for notifications (load on first use to avoid ERR_CACHE in some browsers)
  useEffect(() => {
    try {
      const audio = new Audio('/sounds/notification.mp3?t=' + Date.now());
      audio.volume = 0.5;
      audioRef.current = audio;
    } catch {
      audioRef.current = null;
    }
  }, []);

  const segmentTabs = [
    { key: 'all', label: 'Tous', icon: <MessageOutlined /> },
    { key: 'clients', label: 'Clients', icon: <UserOutlined /> },
    { key: 'drivers', label: 'Livreurs', icon: <CarOutlined /> },
    { key: 'internal', label: 'Interne', icon: <TeamOutlined /> },
    { key: 'alerts', label: 'Alertes', icon: <AlertOutlined /> },
  ];

  const statusFilterOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'unread', label: 'Non lu' },
    { value: 'assigned', label: 'Assigné' },
    ...statusOptions,
  ];

  const kpis = useMemo(() => ({
    total: convs.length,
    unread: convs.reduce((s, c) => s + (c.unread || 0), 0),
    pending: convs.filter((c) => c.status === 'pending').length,
    assigned: convs.filter((c) => !!c.assigned_to).length,
  }), [convs]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messaging & Communication Command Center"
        subtitle="Centre de communication stratégique et opérationnel"
        extra={
          <Space>
            {isMobile ? (
              <Button onClick={() => setMobileListOpen(true)}>Conversations</Button>
            ) : null}
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setNewDlgOpen(true)}>Nouvelle conversation</Button>
          </Space>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card size="small" className="dashboard-card-glass">
          <div className="flex items-center gap-2">
            <MessageOutlined className="text-indigo-500" />
            <div>
              <div className="text-xs text-gray-500">Conversations</div>
              <div className="text-lg font-bold">{kpis.total}</div>
            </div>
          </div>
        </Card>
        <Card size="small" className="dashboard-card-glass">
          <div className="flex items-center gap-2">
            <BellFilled className="text-amber-500" />
            <div>
              <div className="text-xs text-gray-500">Non lus</div>
              <div className="text-lg font-bold text-amber-600">{kpis.unread}</div>
            </div>
          </div>
        </Card>
        <Card size="small" className="dashboard-card-glass">
          <div className="flex items-center gap-2">
            <AlertOutlined className="text-orange-500" />
            <div>
              <div className="text-xs text-gray-500">En attente</div>
              <div className="text-lg font-bold text-orange-600">{kpis.pending}</div>
            </div>
          </div>
        </Card>
        <Card size="small" className="dashboard-card-glass">
          <div className="flex items-center gap-2">
            <TeamOutlined className="text-emerald-500" />
            <div>
              <div className="text-xs text-gray-500">Assignés</div>
              <div className="text-lg font-bold text-emerald-600">{kpis.assigned}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3">
        {!isMobile ? (
          <Card styles={{ body: { padding: 12 } }} title="Conversations">
            <div className="flex flex-wrap gap-2 mb-3">
              {segmentTabs.map((tab) => (
                <Button
                  key={tab.key}
                  type={segmentFilter === tab.key ? 'primary' : 'default'}
                  size="small"
                  icon={tab.icon}
                  onClick={() => setSegmentFilter(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Input
                prefix={<SearchOutlined />}
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ flex: 1, minWidth: 140 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 130 }}
                size="small"
                options={statusFilterOptions}
              />
            </div>
            <div className="mt-3" />
            {loadingConvs ? (
              <div className="py-10 flex justify-center"><Spin /></div>
            ) : filteredConvs.length ? (
              <div style={{ maxHeight: 650, overflow: 'auto' }}>
                {filteredConvs.map((c) => {
                  const active = selected?.id === c.id;
                  const name = getName(c.profile);
                  return (
                    <div
                      key={c.id}
                      onClick={() => void selectConv(c)}
                      style={{
                        cursor: 'pointer',
                        padding: '10px 10px',
                        borderRadius: 12,
                        background: active ? 'rgba(0,128,105,0.10)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                          <Avatar size={42} src={c.profile?.avatar_url || undefined}>
                            {String(name || '?').slice(0, 1).toUpperCase()}
                          </Avatar>
                          {c.user_id && onlineUsers.has(c.user_id) && (
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: '#25D366',
                              border: '2px solid #fff',
                            }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <span style={{ fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {name}
                              </span>
                              {(c.profile as any)?.role === 'driver' && (
                                <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>Livreur</Tag>
                              )}
                              {(c.profile as any)?.role === 'client' && (
                                <Tag color="cyan" style={{ margin: 0, fontSize: 10 }}>Client</Tag>
                              )}
                              {c.status && c.status !== 'open' && (
                                <Tag color={statusOptions.find((o) => o.value === c.status)?.color} style={{ margin: 0, fontSize: 10 }}>
                                  {statusOptions.find((o) => o.value === c.status)?.label}
                                </Tag>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                              <span style={{ opacity: 0.55, fontSize: 12 }}>{fmtTime(c.lastMsg?.created_at)}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                            <div style={{ opacity: 0.70, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {convPreview(c)}
                            </div>
                            {c.unread ? <Badge count={c.unread} /> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty description="Aucune conversation" />
            )}
          </Card>
        ) : null}

        <Card styles={{ body: { padding: 0 } }}>
          {!selected ? (
            <div className="p-10">
              <Empty description={isMobile ? "Ouvre la liste des conversations" : "Sélectionne une conversation"} />
            </div>
          ) : (
            <div className="flex flex-col" style={{ height: isMobile ? 'calc(100vh - 220px)' : 650 }}>
              <div
                className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {isMobile ? (
                    <Button icon={<ArrowLeftOutlined />} onClick={() => setSelected(null)} />
                  ) : null}
                  <div style={{ position: 'relative' }}>
                    <Avatar size={40} src={selected.profile?.avatar_url || undefined}>
                      {String(getName(selected.profile) || '?').slice(0, 1).toUpperCase()}
                    </Avatar>
                    {selected.user_id && onlineUsers.has(selected.user_id) && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#25D366',
                        border: '2px solid #fff',
                      }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getName(selected.profile)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {typingUser ? `${typingUser.name} est en train d'écrire...` : (selected.profile?.email || '')}
                    </div>
                  </div>
                </div>
                <Space size={4}>
                  <Button
                    type={editMode ? 'primary' : 'default'}
                    size="small"
                    onClick={() => {
                      setEditMode(!editMode);
                      if (editMode) setSelectedMsgIds(new Set());
                    }}
                  >
                    {editMode ? 'Annuler' : 'Gérer'}
                  </Button>
                  <Select
                    value={selected.status || 'open'}
                    onChange={(val) => void updateStatus(selected.id, val)}
                    style={{ width: 110 }}
                    size="small"
                    options={statusOptions}
                  />
                  <Select
                    value={selected.assigned_to || null}
                    onChange={(val) => void updateAssignedTo(selected.id, val)}
                    style={{ width: 130 }}
                    size="small"
                    allowClear
                    placeholder="Assigner"
                    options={admins.map((a) => ({ value: a.id, label: a.email }))}
                  />
                  <Button
                    icon={soundEnabled ? <BellFilled /> : <BellOutlined />}
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    title={soundEnabled ? 'Désactiver les sons' : 'Activer les sons'}
                  />
                  <Button icon={<ArrowsAltOutlined />} onClick={() => setFsOpen(true)} />
                </Space>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                {editMode && selectedMsgIds.size > 0 && (
                  <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b flex items-center justify-between">
                    <span className="text-sm font-medium">{selectedMsgIds.size} sélectionné(s)</span>
                    <Button
                      type="primary"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => deleteMessages([...selectedMsgIds])}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
                <ConversationThread
                  msgs={msgs}
                  loading={loadingMsgs}
                  isImageUrl={isImageUrl}
                  fmtTime={fmtTime}
                  ChatBubble={ChatBubble}
                  onLoadMore={loadMoreMsgs}
                  hasMore={hasMoreMsgs}
                  loadingMore={loadingMore}
                  endRef={endRef}
                />
              </div>

              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                {/* Quick replies dropdown */}
                {quickReplies.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Réponse rapide..."
                      value={undefined}
                      onChange={(val) => {
                        const qr = quickReplies.find((r) => r.id === val);
                        if (qr) setText(qr.content);
                      }}
                      options={quickReplies.map((r) => ({ value: r.id, label: r.title }))}
                      allowClear
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Upload {...uploadProps}>
                    <Button icon={<PaperClipOutlined />} loading={uploading} />
                  </Upload>
                  <Input.TextArea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      sendTypingIndicator();
                    }}
                    placeholder="Message"
                    disabled={sending}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendText();
                      }
                    }}
                    style={{ borderRadius: 18, paddingTop: 10, paddingBottom: 10, resize: 'none' }}
                  />
                  <Button type="primary" icon={<SendOutlined />} onClick={() => void sendText()} loading={sending} />
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Drawer
        title="Conversations"
        open={isMobile && mobileListOpen}
        onClose={() => setMobileListOpen(false)}
        placement="left"
        size="default"
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {segmentTabs.map((tab) => (
            <Button
              key={tab.key}
              type={segmentFilter === tab.key ? 'primary' : 'default'}
              size="small"
              icon={tab.icon}
              onClick={() => setSegmentFilter(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <div className="mt-2 mb-2">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: '100%' }}
            size="small"
            options={statusFilterOptions}
          />
        </div>
        <div className="mt-3" />
        {loadingConvs ? (
          <div className="py-10 flex justify-center"><Spin /></div>
        ) : filteredConvs.length ? (
          <div className="space-y-1">
            {filteredConvs.map((c) => {
              const active = selected?.id === c.id;
              const name = getName(c.profile);
              return (
                <div
                  key={c.id}
                  onClick={() => void selectConv(c)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 10px',
                    borderRadius: 12,
                    background: active ? 'rgba(0,128,105,0.10)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar size={42} src={c.profile?.avatar_url || undefined}>
                      {String(name || '?').slice(0, 1).toUpperCase()}
                    </Avatar>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <span style={{ opacity: 0.55, fontSize: 12 }}>{fmtTime(c.lastMsg?.created_at)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <div style={{ opacity: 0.70, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {convPreview(c)}
                        </div>
                        {c.unread ? <Badge count={c.unread} /> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty description="Aucune conversation" />
        )}
      </Drawer>

      <Modal
        open={fsOpen}
        onCancel={() => setFsOpen(false)}
        footer={null}
        width="100vw"
        style={{ top: 0, paddingBottom: 0, maxWidth: '100vw' }}
        styles={{ body: { padding: 0 } }}
        destroyOnHidden
      >
        {!selected ? (
          <div className="p-10">
            <Empty description="Sélectionne une conversation" />
          </div>
        ) : (
          <div className="flex flex-col" style={{ height: '100vh' }}>
            <div className="px-4 py-3 border-b border-gray-100" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{getName(selected.profile)}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{selected.profile?.email || ''}</div>
              </div>
              <Button onClick={() => setFsOpen(false)}>Fermer</Button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <ConversationThread
                msgs={msgs}
                loading={loadingMsgs}
                isImageUrl={isImageUrl}
                fmtTime={fmtTime}
                ChatBubble={ChatBubble}
                onLoadMore={loadMoreMsgs}
                hasMore={hasMoreMsgs}
                loadingMore={loadingMore}
                endRef={endRef}
                wide
              />
            </div>

            <div className="px-4 py-3 border-t border-gray-100">
              <Space.Compact style={{ width: '100%' }}>
                <Upload {...uploadProps}>
                  <Button icon={<PaperClipOutlined />} loading={uploading} />
                </Upload>
                <Input.TextArea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Écrire un message..."
                  disabled={sending}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendText();
                    }
                  }}
                  style={{ resize: 'none' }}
                />
                <Button type="primary" icon={<SendOutlined />} onClick={() => void sendText()} loading={sending} />
              </Space.Compact>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={newDlgOpen}
        onCancel={() => setNewDlgOpen(false)}
        title="Nouvelle conversation"
        footer={null}
        width={720}
      >
        <Space vertical style={{ width: '100%' }} size={12}>
          <Input
            placeholder="Rechercher un utilisateur..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            allowClear
            onPressEnter={() => void loadUsers()}
          />
          <Button onClick={() => void loadUsers()} loading={usersLoading}>
            Rechercher
          </Button>
          {usersLoading ? (
            <div className="py-10 flex justify-center"><Spin /></div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getName(u)}</div>
                    <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email || ''}</div>
                  </div>
                  <Button type="link" onClick={() => void openNewConversation(u.id)}>Ouvrir</Button>
                </div>
              ))}
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
}

type ProfileRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_blocked?: boolean | null;
};

type ConversationRow = {
  id: string;
  user_id: string;
  status?: string | null;
  assigned_to?: string | null;
  updated_at: string;
  profile?: ProfileRow | null;
  unread?: number;
  lastMsg?: { message: string; sender_id: string; created_at: string } | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  _pending?: boolean;
};
