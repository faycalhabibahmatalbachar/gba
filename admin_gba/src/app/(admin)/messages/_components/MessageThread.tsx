'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import {
  Check,
  CheckCheck,
  Copy,
  Download,
  FileIcon,
  FileText,
  ImageIcon,
  MessageSquare,
  Mic,
  Paperclip,
  Reply,
  Send,
  Square,
  Star,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { AvatarWithInitials } from '@/components/ui/custom/AvatarWithInitials';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useMessagesContext } from './MessagesContext';
import type { ChatMessage } from './types';
import { TemplatesPicker } from './TemplatesPicker';

const EMOJIS = ['😀', '😁', '👍', '🙏', '❤️', '🔥', '✅', '📦', '🚚', '💬', '🎉', '⚠️'];

function mapRowToChatMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    sender_id: row.sender_id as string,
    body: (row.message as string) || '',
    is_read: row.is_read as boolean,
    created_at: row.created_at as string,
    image_url: (row.image_url as string) || null,
    attachments: row.attachments,
    message_type: (row.message_type as string) || 'text',
    reply_to_id: (row.reply_to_id as string) || null,
    metadata: row.metadata as Record<string, unknown> | null,
    deleted_at: (row.deleted_at as string) || null,
  };
}

function micErrorMessage(err: unknown): string {
  const d = err as { name?: string; message?: string };
  if (d?.name === 'NotAllowedError' || d?.name === 'PermissionDeniedError') {
    return 'Micro refusé : autorisez le micro dans les paramètres du navigateur pour ce site.';
  }
  if (d?.name === 'NotFoundError' || d?.name === 'DevicesNotFoundError') {
    return 'Aucun micro détecté sur cet appareil.';
  }
  if (d?.name === 'NotReadableError' || d?.name === 'TrackStartError') {
    return 'Micro déjà utilisé par une autre application.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext && !/^localhost$|^127\./i.test(window.location.hostname)) {
    return 'HTTPS requis : ouvrez l’admin en https:// pour utiliser le micro.';
  }
  return d?.message || 'Micro indisponible';
}

function QuotedMessage({ body }: { body: string }) {
  return (
    <div className="mb-1 rounded border-l-2 border-brand/50 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
      {body.slice(0, 200)}
    </div>
  );
}

function AudioPlayer({ src }: { src: string }) {
  const ref = React.useRef<HTMLAudioElement>(null);
  const [prog, setProg] = React.useState(0);
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1">
      <audio ref={ref} src={src} onTimeUpdate={() => {
        const a = ref.current;
        if (!a?.duration) return;
        setProg((a.currentTime / a.duration) * 100);
      }} />
      <input
        type="range"
        min={0}
        max={100}
        value={prog}
        readOnly
        className="h-1 w-full accent-brand"
      />
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void ref.current?.play()}>
        Lecture
      </Button>
    </div>
  );
}

function parseAttachments(message: ChatMessage): { url: string; name?: string; type?: string; size?: number }[] {
  const raw = message.attachments;
  try {
    if (Array.isArray(raw)) return raw as { url: string; name?: string; type?: string; size?: number }[];
    if (typeof raw === 'string' && raw.trim()) {
      const j = JSON.parse(raw) as unknown;
      return Array.isArray(j) ? (j as { url: string; name?: string; type?: string; size?: number }[]) : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url);
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function renderMessageContent(
  message: ChatMessage,
  onImageClick: (url: string) => void,
): React.ReactNode {
  if (message.deleted_at) {
    return <span className="italic text-muted-foreground text-sm">Message supprimé</span>;
  }

  const attachments = parseAttachments(message);
  const t = message.message_type || 'text';
  const body = message.body || '';

  const bodyNode =
    t === 'text' || !t ? (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    ) : (
      <p className="text-sm whitespace-pre-wrap">{body}</p>
    );

  if (t === 'text' && body.startsWith('http') && isImageUrl(body)) {
    return (
      <button type="button" className="relative block overflow-hidden rounded-lg" onClick={() => onImageClick(body)}>
        <Image src={body} alt="" width={240} height={200} className="max-h-[200px] w-auto object-cover" unoptimized />
      </button>
    );
  }

  if (t === 'image') {
    const url =
      message.image_url ||
      attachments[0]?.url ||
      (body.startsWith('http') ? body : '');
    if (!url) return <span className="text-xs text-muted-foreground">Image</span>;
    return (
      <button type="button" className="relative block overflow-hidden rounded-lg" onClick={() => onImageClick(url)}>
        <Image src={url} alt="" width={240} height={200} className="max-h-[200px] w-full object-cover" unoptimized />
      </button>
    );
  }
  if (t === 'file') {
    const att = attachments[0];
    return (
      <div className="flex items-center gap-2 text-sm">
        <FileIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{att?.name || 'Fichier'}</span>
        {att?.url ? (
          <a className="text-primary underline" href={att.url} download target="_blank" rel="noreferrer">
            Télécharger
          </a>
        ) : null}
      </div>
    );
  }
  if (t === 'audio') {
    const url = attachments[0]?.url || body;
    if (!url) return null;
    return (
      <div className="flex items-center gap-2 bg-muted rounded-lg p-2 max-w-[280px]">
        <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <audio controls src={url} className="h-8 flex-1 min-w-0" />
      </div>
    );
  }
  if (t === 'system') {
    return (
      <div className="rounded bg-amber-50 px-2 py-1 text-center text-xs italic text-muted-foreground dark:bg-amber-950/40">
        {message.body}
      </div>
    );
  }
  const attBlocks =
    attachments.length > 0 ? (
      <div className="space-y-2">
        {attachments.map((att, i) => {
          const url = att.url;
          const name = att.name || url.split('/').pop() || 'fichier';
          const ty = att.type || '';
          if (ty.startsWith('image/') || isImageUrl(url)) {
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                className="block rounded-lg overflow-hidden hover:opacity-90"
                onClick={() => onImageClick(url)}
              >
                <img src={url} alt={name} className="max-w-[240px] max-h-[200px] object-cover rounded-lg" />
              </button>
            );
          }
          if (ty.startsWith('audio/') || url.includes('.webm') || url.includes('.ogg')) {
            return (
              <div key={`${url}-${i}`} className="flex items-center gap-2 bg-muted rounded-lg p-2">
                <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <audio controls src={url} className="h-8 flex-1 min-w-0" />
              </div>
            );
          }
          if (ty.startsWith('video/')) {
            return (
              <video key={`${url}-${i}`} controls src={url} className="max-w-[240px] max-h-[180px] rounded-lg" />
            );
          }
          const isPdf = url.endsWith('.pdf') || ty === 'application/pdf';
          return (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-muted hover:bg-muted/80 rounded-lg p-2 transition"
            >
              {isPdf ? <FileText className="h-4 w-4 shrink-0" /> : <FileIcon className="h-4 w-4 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                {att.size != null && att.size > 0 ? (
                  <p className="text-xs text-muted-foreground">{formatBytes(att.size)}</p>
                ) : null}
              </div>
              <Download className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
          );
        })}
      </div>
    ) : null;

  if (t === 'location') {
    let lat = 0;
    let lng = 0;
    try {
      const j = JSON.parse(message.body || '{}') as { lat?: number; lng?: number };
      lat = j.lat ?? 0;
      lng = j.lng ?? 0;
    } catch {
      /* ignore */
    }
    return (
      <div className="space-y-2">
        <div className="w-[200px] h-[120px] rounded-lg overflow-hidden border border-border">
          <iframe
            title="carte"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`}
            className="w-full h-full border-0"
          />
        </div>
        <a
          className="text-xs text-primary underline"
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir dans Google Maps
        </a>
      </div>
    );
  }

  if (t === 'text' || !t) {
    return (
      <div className="space-y-2">
        {bodyNode}
        {attBlocks}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {body ? bodyNode : null}
      {attBlocks}
    </div>
  );
}

export function MessageThread({ adminUserId }: { adminUserId: string | null }) {
  const qc = useQueryClient();
  const { selectedConversationId, replyTo, setReplyTo } = useMessagesContext();
  const [older, setOlder] = React.useState<ChatMessage[]>([]);
  const [nextOlder, setNextOlder] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [pendingFiles, setPendingFiles] = React.useState<{ url: string; name: string; size: number; type: string }[]>([]);
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordSecs, setRecordSecs] = React.useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const recordTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const imgRef = React.useRef<HTMLInputElement>(null);
  const uploadFileRef = React.useRef<(file: File) => Promise<void>>(async () => {});

  const uploadFile = React.useCallback(async (file: File) => {
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/messages/upload', { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok) {
      toast.error(j.error || 'Upload échoué');
      return;
    }
    setPendingFiles((p) => [...p, { url: j.url, name: j.name, size: j.size, type: j.type }]);
  }, []);

  const canUseMic = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hasMedia = Boolean(navigator.mediaDevices?.getUserMedia);
    const secure =
      window.isSecureContext || /^localhost$|^127\./i.test(window.location.hostname);
    return hasMedia && secure;
  }, []);

  React.useLayoutEffect(() => {
    uploadFileRef.current = uploadFile;
  }, [uploadFile]);

  const stopRecording = React.useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, []);

  const startRecording = React.useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Ce navigateur ne permet pas l’accès au micro.');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext && !/^localhost$|^127\./i.test(window.location.hostname)) {
      toast.error('HTTPS requis pour enregistrer un message vocal.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mime =
        typeof MediaRecorder !== 'undefined'
          ? preferred.find((m) => MediaRecorder.isTypeSupported(m)) || ''
          : '';
      let mr: MediaRecorder;
      try {
        mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch {
        try {
          mr = new MediaRecorder(stream);
        } catch {
          stream.getTracks().forEach((t) => t.stop());
          toast.error('Enregistrement audio non supporté sur ce navigateur.');
          return;
        }
      }
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      const outType = mr.mimeType || 'audio/webm';
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: outType });
        const ext = outType.includes('mp4') ? 'm4a' : outType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: outType });
        void uploadFileRef.current(file);
        setRecordSecs(0);
      };
      mr.start(200);
      setIsRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (e) {
      toast.error(micErrorMessage(e));
    }
  }, []);

  const cancelRecording = React.useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && isRecording) {
      mr.onstop = null;
      try {
        mr.stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      mr.stop();
    }
    setIsRecording(false);
    setRecordSecs(0);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, [isRecording]);

  const threadQ = useQuery({
    queryKey: ['msg-thread', selectedConversationId],
    enabled: !!selectedConversationId,
    queryFn: async () => {
      const res = await fetch(`/api/messages/conversations/${selectedConversationId}`);
      if (!res.ok) throw new Error('Chargement échoué');
      return res.json() as Promise<{
        messages: ChatMessage[];
        next_cursor_older: string | null;
        participant: Record<string, unknown> | null;
        conversation: Record<string, unknown>;
      }>;
    },
  });

  React.useEffect(() => {
    setOlder([]);
    if (threadQ.data?.next_cursor_older !== undefined) setNextOlder(threadQ.data.next_cursor_older);
  }, [selectedConversationId, threadQ.data?.next_cursor_older]);

  const participant = threadQ.data?.participant;
  const contactName =
    participant &&
    ([participant.first_name, participant.last_name].filter(Boolean).join(' ') ||
      (participant.email as string) ||
      'Contact');

  const messages = React.useMemo(
    () => [...older, ...(threadQ.data?.messages || [])],
    [older, threadQ.data?.messages],
  );

  const loadOlder = React.useCallback(async () => {
    if (!selectedConversationId || !nextOlder) return;
    const res = await fetch(`/api/messages/conversations/${selectedConversationId}?cursor=${encodeURIComponent(nextOlder)}`);
    if (!res.ok) return;
    const j = await res.json() as { messages: ChatMessage[]; next_cursor_older: string | null };
    setOlder((o) => [...j.messages, ...o]);
    setNextOlder(j.next_cursor_older);
  }, [selectedConversationId, nextOlder]);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 12,
  });

  React.useEffect(() => {
    if (!selectedConversationId) return;
    const ch = supabase
      .channel(`messages:${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const msg = mapRowToChatMessage(payload.new as Record<string, unknown>);
          qc.setQueryData(['msg-thread', selectedConversationId], (prev) => {
            if (typeof prev !== 'object' || prev === null || !('messages' in prev)) return prev;
            const p = prev as { messages: ChatMessage[]; next_cursor_older: string | null };
            const exists = p.messages.some((m) => m.id === msg.id);
            if (exists) return prev;
            return { ...prev, messages: [...p.messages, msg] };
          });
          void fetch(`/api/messages/${msg.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          });
          void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
          setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }, 80);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const msg = mapRowToChatMessage(payload.new as Record<string, unknown>);
          qc.setQueryData(['msg-thread', selectedConversationId], (prev) => {
            if (typeof prev !== 'object' || prev === null || !('messages' in prev)) return prev;
            const p = prev as { messages: ChatMessage[]; next_cursor_older: string | null };
            const idx = p.messages.findIndex((m) => m.id === msg.id);
            if (idx === -1) return { ...prev, messages: [...p.messages, msg] };
            const next = [...p.messages];
            next[idx] = msg;
            return { ...prev, messages: next };
          });
          void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [selectedConversationId, qc]);

  const sendMessage = async () => {
    if (!selectedConversationId || !adminUserId) return;
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;
    let message_type: ChatMessage['message_type'] = 'text';
    if (pendingFiles.some((f) => f.type.startsWith('image/'))) message_type = 'image';
    else if (pendingFiles.some((f) => f.type.startsWith('audio/'))) message_type = 'audio';
    else if (pendingFiles.length) message_type = 'file';

    const attachments = pendingFiles.map((f) => ({ url: f.url, name: f.name, size: f.size, type: f.type }));
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        conversation_id: selectedConversationId,
        body: text || (message_type === 'image' || message_type === 'audio' ? ' ' : ''),
        attachments,
        reply_to_id: replyTo?.id ?? null,
        message_type,
      }),
    });
    if (!res.ok) {
      toast.error('Envoi échoué');
      return;
    }
    setDraft('');
    setReplyTo(null);
    setPendingFiles([]);
    void threadQ.refetch();
    void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
    toast.success('Message envoyé');
  };

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Copié');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  if (!selectedConversationId) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-muted/10">
        <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="Sélectionnez une conversation" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col border-r border-border bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <AvatarWithInitials name={String(contactName || '?')} src={(participant?.avatar_url as string) || null} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{contactName}</p>
          <p className="text-xs text-muted-foreground">
            {(participant?.role as string) || '—'} ·{' '}
            {participant?.is_online ? 'En ligne' : 'Hors ligne'}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-2"
        onScroll={(e) => {
          const t = e.currentTarget;
          if (t.scrollTop < 40 && nextOlder) void loadOlder();
        }}
      >
        {threadQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : (
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const msg = messages[vi.index];
              const isAdmin = msg.sender_id === adminUserId;
              const quoted = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : undefined;
              return (
                <div
                  key={msg.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    'group absolute left-0 top-0 flex w-full gap-2 pb-3',
                    isAdmin && 'flex-row-reverse',
                  )}
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {!isAdmin ? (
                    <AvatarWithInitials name={String(contactName || '?')} className="size-8 shrink-0" />
                  ) : null}
                  <div className={cn('relative max-w-[70%]', isAdmin && 'items-end')}>
                    <div className="absolute -top-1 right-0 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setReplyTo(msg)}>
                        <Reply className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyText(msg.body)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          await fetch(`/api/messages/${msg.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ important: true }),
                          });
                          toast.success('Marqué important');
                        }}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        disabled={Boolean(msg.deleted_at)}
                        onClick={async () => {
                          const res = await fetch(`/api/messages/${msg.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ deleted: true }),
                          });
                          if (!res.ok) {
                            toast.error('Suppression échouée');
                            return;
                          }
                          const now = new Date().toISOString();
                          qc.setQueryData(['msg-thread', selectedConversationId], (prev) => {
                            if (typeof prev !== 'object' || prev === null || !('messages' in prev)) return prev;
                            const p = prev as { messages: ChatMessage[]; next_cursor_older: string | null };
                            return {
                              ...p,
                              messages: p.messages.map((m) =>
                                m.id === msg.id
                                  ? {
                                      ...m,
                                      deleted_at: now,
                                      body: "[Message supprimé par l'administrateur]",
                                      attachments: [],
                                      message_type: 'text',
                                      image_url: null,
                                    }
                                  : m,
                              ),
                            };
                          });
                          void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
                          toast.success('Supprimé');
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {quoted ? <QuotedMessage body={quoted.body} /> : null}
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2',
                        isAdmin ? 'rounded-tr-none bg-brand text-white' : 'rounded-tl-none bg-muted',
                      )}
                    >
                      {renderMessageContent(msg, setLightbox)}
                    </div>
                    <div className={cn('mt-1 flex gap-1', isAdmin ? 'justify-end' : '')}>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                      </span>
                      {isAdmin ? (
                        msg.is_read ? (
                          <CheckCheck className="h-3 w-3 text-white/90" />
                        ) : (
                          <Check className="h-3 w-3 text-white/70" />
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-background p-3">
        {replyTo ? (
          <div className="mb-2 flex items-center gap-2 rounded border-l-2 border-brand bg-brand/5 px-3 py-2">
            <Reply className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span className="truncate text-sm">{replyTo.body}</span>
            <Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7 shrink-0" onClick={() => setReplyTo(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
        {pendingFiles.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((f) => (
              <div key={f.url} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs">
                <span className="max-w-[100px] truncate">{f.name}</span>
                <button type="button" className="text-destructive" onClick={() => setPendingFiles((p) => p.filter((x) => x.url !== f.url))}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  🙂
                </Button>
              }
            />
            <PopoverContent className="w-56 p-2" align="start">
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="rounded p-1 text-lg hover:bg-muted"
                    onClick={() => setDraft((d) => d + e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <TemplatesPicker onSelect={(t) => setDraft((d) => d + t.body)} />
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
            e.target.value = '';
          }} />
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
            e.target.value = '';
          }} />
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => imgRef.current?.click()}>
            <ImageIcon className="h-4 w-4" />
          </Button>
          {isRecording ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1">
              <span className="text-xs tabular-nums text-destructive font-medium">
                {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, '0')}
              </span>
              <Button type="button" size="icon" variant="destructive" className="h-8 w-8 shrink-0" onClick={() => stopRecording()} title="Arrêter et joindre">
                <Square className="h-3 w-3" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => cancelRecording()}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              title={canUseMic ? 'Message vocal' : 'Micro indisponible (utilisez HTTPS ou pièce jointe audio)'}
              onClick={() => void startRecording()}
              disabled={!canUseMic}
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
          <Textarea
            placeholder="Écrire un message… (@mention)"
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v);
              setMentionOpen(v.endsWith('@') || v.includes('@'));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            className="min-h-[40px] max-h-[120px] flex-1 resize-none text-sm"
            rows={1}
          />
          <Button type="button" size="icon" className="h-9 w-9 shrink-0" disabled={!draft.trim() && pendingFiles.length === 0} onClick={() => void sendMessage()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {mentionOpen ? (
          <p className="mt-1 text-[10px] text-muted-foreground">Mention : recherche profils disponible dans une prochaine itération.</p>
        ) : null}
        {!canUseMic ? (
          <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
            Le micro est indisponible dans ce contexte. Utilisez HTTPS ou joignez un fichier audio via le bouton pièce jointe.
          </p>
        ) : null}
      </div>

      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-[90vw] border-0 bg-black p-0">
          {lightbox ? <Image src={lightbox} alt="" width={1200} height={800} className="max-h-[85vh] w-auto object-contain" unoptimized /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
