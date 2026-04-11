'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
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
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Reply,
  Search,
  Send,
  Square,
  Star,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AvatarWithInitials } from '@/components/ui/custom/AvatarWithInitials';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMessagesContext } from './MessagesContext';
import type { ChatMessage } from './types';
import { TemplatesPicker } from './TemplatesPicker';
import { msgCopy } from './messagesCopy';

const EMOJIS = ['😀', '😁', '👍', '🙏', '❤️', '🔥', '✅', '📦', '🚚', '💬', '🎉', '⚠️'];

function roleLabelFr(role: string | undefined): string {
  const r = String(role || 'user').toLowerCase();
  if (r === 'driver') return '🚗 Livreur';
  if (r === 'admin' || r === 'superadmin' || r === 'super_admin') return '⚙️ Admin';
  return '👤 Client';
}

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

function formatDaySeparatorLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM yyyy', { locale: fr });
}

type ThreadRow =
  | { kind: 'date'; label: string; key: string }
  | { kind: 'msg'; msg: ChatMessage; key: string };

function buildThreadRows(messages: ChatMessage[]): ThreadRow[] {
  const out: ThreadRow[] = [];
  let lastDay = '';
  for (const msg of messages) {
    const day = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (day !== lastDay) {
      lastDay = day;
      out.push({ kind: 'date', label: formatDaySeparatorLabel(msg.created_at), key: `sep-${day}` });
    }
    out.push({ kind: 'msg', msg, key: msg.id });
  }
  return out;
}

function injectOrderMarkdownLinks(s: string): string {
  return s.replace(
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/gi,
    (_, id: string) => `[Commande](${`/orders?focus=${encodeURIComponent(id)}`})`,
  );
}

function highlightPlain(body: string, q: string): React.ReactNode {
  const needle = q.trim();
  if (!needle) return body;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = body.split(new RegExp(`(${esc})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} className="rounded bg-amber-200/90 px-0.5 dark:bg-amber-900/60">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function renderMessageContent(
  message: ChatMessage,
  onImageClick: (url: string) => void,
  opts?: { highlightQuery?: string },
): React.ReactNode {
  if (message.deleted_at) {
    return <span className="italic text-muted-foreground text-sm">Message supprimé</span>;
  }

  const attachments = parseAttachments(message);
  const t = message.message_type || 'text';
  const body = message.body || '';
  const hl = opts?.highlightQuery?.trim();

  const mdLinkComponents: Partial<Components> = {
    a: ({ href, children, ...props }) =>
      href?.startsWith('/') ? (
        <Link href={href} className="text-primary underline underline-offset-2">
          {children}
        </Link>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline break-all"
          {...props}
        >
          {children}
        </a>
      ),
  };

  const bodyNode =
    hl && (t === 'text' || !t) ? (
      <div className="text-sm whitespace-pre-wrap break-words">{highlightPlain(body, hl)}</div>
    ) : t === 'text' || !t ? (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdLinkComponents}>
          {injectOrderMarkdownLinks(body)}
        </ReactMarkdown>
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
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const {
    selectedConversationId,
    replyTo,
    setReplyTo,
    showConversationList,
    setShowConversationList,
    showContactPanel,
    setShowContactPanel,
  } = useMessagesContext();
  const [threadSearchOpen, setThreadSearchOpen] = React.useState(false);
  const [threadSearch, setThreadSearch] = React.useState('');
  const [older, setOlder] = React.useState<ChatMessage[]>([]);
  const [nextOlder, setNextOlder] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [pendingFiles, setPendingFiles] = React.useState<{ url: string; name: string; size: number; type: string }[]>([]);
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = React.useState<Set<string>>(() => new Set());
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferBusy, setTransferBusy] = React.useState(false);
  const [pendingBelow, setPendingBelow] = React.useState(0);
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
    let toSend = file;
    if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
      try {
        toSend = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true });
      } catch {
        toSend = file;
      }
    }
    const fd = new FormData();
    fd.set('file', toSend);
    const res = await fetch('/api/messages/upload', { method: 'POST', body: fd });
    const j = (await res.json()) as { error?: string; url?: string; name?: string; size?: number; type?: string };
    if (!res.ok) {
      toast.error(typeof j.error === 'string' ? j.error : 'Upload échoué');
      return;
    }
    setPendingFiles((p) => [
      ...p,
      { url: j.url as string, name: j.name as string, size: j.size as number, type: j.type as string },
    ]);
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

  const displayMessages = React.useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      if ((m.body || '').toLowerCase().includes(q)) return true;
      try {
        return JSON.stringify(m.attachments || '').toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [messages, threadSearch]);

  const threadRows = React.useMemo(() => buildThreadRows(displayMessages), [displayMessages]);

  React.useEffect(() => {
    setSelectedMsgIds(new Set());
    setPendingBelow(0);
  }, [selectedConversationId]);

  const loadOlder = React.useCallback(async () => {
    if (!selectedConversationId || !nextOlder) return;
    const res = await fetch(`/api/messages/conversations/${selectedConversationId}?cursor=${encodeURIComponent(nextOlder)}`);
    if (!res.ok) return;
    const j = await res.json() as { messages: ChatMessage[]; next_cursor_older: string | null };
    setOlder((o) => [...j.messages, ...o]);
    setNextOlder(j.next_cursor_older);
  }, [selectedConversationId, nextOlder]);

  const virtualizer = useVirtualizer({
    count: threadRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (threadRows[i]?.kind === 'date' ? 36 : 92),
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
          const el = scrollRef.current;
          const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 140 : true;
          if (nearBottom) {
            setTimeout(() => {
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            }, 80);
          } else {
            setPendingBelow((n) => n + 1);
          }
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
      let msg = 'Envoi échoué';
      try {
        const j = (await res.json()) as { error?: unknown };
        if (typeof j.error === 'string') msg = j.error;
        else if (j.error && typeof j.error === 'object' && 'formErrors' in (j.error as object)) {
          const flat = j.error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
          const parts = [...(flat.formErrors || []).filter(Boolean)];
          for (const [k, v] of Object.entries(flat.fieldErrors || {})) {
            (v || []).forEach((m) => parts.push(`${k}: ${m}`));
          }
          if (parts.length) msg = parts.join(' · ');
        }
      } catch {
        /* ignore */
      }
      toast.error(msg);
      return;
    }
    setDraft('');
    setReplyTo(null);
    setPendingFiles([]);
    void threadQ.refetch();
    void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
    toast.success('Message envoyé');
  };

  const searchProfilesForTransfer = React.useCallback(async (q: string) => {
    if (q.length < 2) return [];
    const u = new URL('/api/users', window.location.origin);
    u.searchParams.set('q', q);
    const res = await fetch(u.toString());
    if (!res.ok) return [];
    const j = (await res.json()) as {
      data?: { id: string; email?: string; first_name?: string; last_name?: string; role?: string }[];
    };
    return j.data ?? [];
  }, []);

  const bulkDeleteSelected = React.useCallback(async () => {
    if (!selectedConversationId || selectedMsgIds.size === 0) return;
    const ids = [...selectedMsgIds];
    let failed = 0;
    for (const id of ids) {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: true }),
      });
      if (!res.ok) failed++;
    }
    if (failed) toast.error(`${failed} suppression(s) en échec`);
    else toast.success('Messages supprimés');
    setSelectedMsgIds(new Set());
    void threadQ.refetch();
    void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
  }, [selectedConversationId, selectedMsgIds, threadQ, qc]);

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
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 bg-muted/10 px-6 py-16">
        <MessageSquare className="h-20 w-20 text-muted-foreground/35" strokeWidth={1.25} />
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{msgCopy.selectConversationTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{msgCopy.selectConversationHint}</p>
        </div>
        <Button
          type="button"
          className="rounded-full px-6"
          onClick={() => {
            window.dispatchEvent(new Event('gba-messages-open-new-conv'));
          }}
        >
          {msgCopy.newConversation}
        </Button>
      </div>
    );
  }

  if (threadQ.isError) {
    const errRaw = threadQ.error;
    const errMsg =
      errRaw instanceof Error
        ? errRaw.message
        : typeof errRaw === 'string'
          ? errRaw
          : msgCopy.threadLoadError;
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 border-r border-border bg-background px-6 py-16">
        <p className="max-w-md text-center text-sm text-destructive">{errMsg}</p>
        <Button type="button" variant="outline" onClick={() => void threadQ.refetch()}>
          {msgCopy.retry}
        </Button>
      </div>
    );
  }

  const roleLine = roleLabelFr(participant?.role as string | undefined);
  const online = Boolean(participant?.is_online);
  const lastSeen = participant?.last_seen_at as string | undefined;
  const highlightQ = threadSearch.trim();

  return (
    <div className="flex min-w-0 flex-1 flex-col border-r border-border bg-background">
      <div className="shrink-0 border-b border-border px-2 py-2 md:px-3">
        <div className="flex items-start gap-2">
          {isDesktop ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn('h-9 w-9 shrink-0', showConversationList && 'text-primary')}
                    onClick={() => setShowConversationList(!showConversationList)}
                    aria-label={showConversationList ? 'Masquer les conversations' : 'Afficher les conversations'}
                  >
                    {showConversationList ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
                  </Button>
                }
              />
              <TooltipContent>{showConversationList ? 'Masquer les conversations' : 'Afficher les conversations'}</TooltipContent>
            </Tooltip>
          ) : null}

          <AvatarWithInitials
            name={String(contactName || '?')}
            src={(participant?.avatar_url as string) || null}
            className="relative size-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold leading-tight">{contactName}</p>
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
                title={online ? 'En ligne' : 'Hors ligne'}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {roleLine}
              {' · '}
              {online
                ? '🟢 En ligne'
                : lastSeen
                  ? `⚫ Hors ligne · vu ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: fr })}`
                  : '⚫ Hors ligne'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn('h-9 w-9', threadSearchOpen && 'text-primary')}
                    onClick={() => setThreadSearchOpen((v) => !v)}
                    aria-label="Rechercher dans la conversation"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>Rechercher dans la conversation</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={async () => {
                      if (!selectedConversationId) return;
                      const res = await fetch(`/api/messages/conversations/${selectedConversationId}/mark-read`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      if (!res.ok) {
                        toast.error('Impossible de tout marquer comme lu');
                        return;
                      }
                      void threadQ.refetch();
                      void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
                      toast.success('Messages marqués comme lus');
                    }}
                    aria-label="Tout marquer comme lu"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>Tout marquer comme lu</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-9 w-9')} type="button" aria-label="Plus d actions">
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={async () => {
                    if (!selectedConversationId) return;
                    const res = await fetch(`/api/messages/conversations/${selectedConversationId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ metadata: { archived: true } }),
                    });
                    if (!res.ok) {
                      toast.error('Archivage échoué');
                      return;
                    }
                    toast.success('Conversation archivée');
                    void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
                  }}
                >
                  Archiver
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (!selectedConversationId) return;
                    window.open(`/api/messages/conversations/${selectedConversationId}/export`, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Exporter PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTransferOpen(true)}>Transférer…</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => toast.message('Suppression conversation', { description: 'À configurer côté API.' })}
                >
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isDesktop ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn('h-9 w-9', showContactPanel && 'text-primary')}
                      onClick={() => setShowContactPanel(!showContactPanel)}
                      aria-label={showContactPanel ? 'Masquer la fiche contact' : 'Afficher la fiche contact'}
                    >
                      {showContactPanel ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
                    </Button>
                  }
                />
                <TooltipContent>{showContactPanel ? 'Masquer la fiche contact' : 'Afficher la fiche contact'}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {threadSearchOpen ? (
          <div className="mt-2 px-0.5">
            <Input
              placeholder="Rechercher dans les messages…"
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1">
        {pendingBelow > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
            <Button
              type="button"
              size="sm"
              className="pointer-events-auto shadow-md"
              onClick={() => {
                const el = scrollRef.current;
                if (el) {
                  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                  setPendingBelow(0);
                }
              }}
            >
              {pendingBelow} nouveaux messages
            </Button>
          </div>
        ) : null}
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-4 py-2"
          onScroll={(e) => {
            const t = e.currentTarget;
            if (t.scrollTop < 40 && nextOlder) void loadOlder();
            const nearBottom = t.scrollHeight - t.scrollTop - t.clientHeight < 140;
            if (nearBottom) setPendingBelow(0);
          }}
        >
          {threadQ.isLoading ? (
            <p className="text-xs text-muted-foreground">{msgCopy.loading}</p>
          ) : !threadQ.isLoading && threadQ.isSuccess && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm font-medium text-foreground">{msgCopy.threadEmptyTitle(String(contactName || 'ce contact'))}</p>
              <p className="max-w-sm text-xs text-muted-foreground">{msgCopy.threadEmptyHint}</p>
            </div>
          ) : (
            <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = threadRows[vi.index];
                if (!row) return null;
                if (row.kind === 'date') {
                  return (
                    <div
                      key={row.key}
                      data-index={vi.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 flex w-full justify-center py-2"
                      style={{ transform: `translateY(${vi.start}px)` }}
                    >
                      <span className="rounded-full bg-muted px-3 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {row.label}
                      </span>
                    </div>
                  );
                }
                const msg = row.msg;
                const isAdmin = msg.sender_id === adminUserId;
                const quoted = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : undefined;
                return (
                  <div
                    key={msg.id}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className={cn(
                      'group absolute left-0 top-0 flex w-full gap-2 pb-3 pl-1',
                      isAdmin && 'flex-row-reverse',
                    )}
                    style={{ transform: `translateY(${vi.start}px)` }}
                  >
                    <input
                      type="checkbox"
                      className="mt-2 h-3.5 w-3.5 shrink-0 rounded border-border accent-brand"
                      checked={selectedMsgIds.has(msg.id)}
                      title="Sélectionner"
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedMsgIds((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) n.add(msg.id);
                          else n.delete(msg.id);
                          return n;
                        });
                      }}
                    />
                    {!isAdmin ? (
                      <AvatarWithInitials name={String(contactName || '?')} className="size-8 shrink-0" />
                    ) : (
                      <span className="w-8 shrink-0" />
                    )}
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
                        {renderMessageContent(msg, setLightbox, { highlightQuery: highlightQ })}
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
      </div>

      {selectedMsgIds.size > 0 ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <span className="text-xs text-muted-foreground">{selectedMsgIds.size} sélectionné(s)</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedMsgIds(new Set())}>
              Annuler
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => void bulkDeleteSelected()}>
              Supprimer
            </Button>
          </div>
        </div>
      ) : null}

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
          <div className="mb-2 flex flex-col gap-2">
            {pendingFiles.map((f) => (
              <div key={f.url} className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-2 text-xs">
                {f.type.startsWith('audio/') ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="max-w-[140px] truncate text-muted-foreground">{f.name}</span>
                    <audio controls src={f.url} className="h-8 max-w-full flex-1 min-w-[160px]" preload="metadata" />
                  </div>
                ) : (
                  <span className="max-w-[180px] truncate">{f.name}</span>
                )}
                <button
                  type="button"
                  className="ml-auto shrink-0 text-destructive"
                  aria-label="Retirer"
                  onClick={() => setPendingFiles((p) => p.filter((x) => x.url !== f.url))}
                >
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

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transférer la conversation</DialogTitle>
          </DialogHeader>
          <TransferParticipantPicker
            disabled={transferBusy}
            searchFn={searchProfilesForTransfer}
            onPick={async (participantId) => {
              if (!selectedConversationId) return;
              setTransferBusy(true);
              try {
                const res = await fetch(`/api/messages/conversations/${selectedConversationId}/transfer`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ new_participant_id: participantId }),
                });
                const j = (await res.json().catch(() => ({}))) as { error?: unknown };
                if (!res.ok) {
                  const err =
                    typeof j.error === 'string'
                      ? j.error
                      : j.error && typeof j.error === 'object'
                        ? JSON.stringify(j.error)
                        : 'Transfert échoué';
                  toast.error(err);
                  return;
                }
                toast.success('Conversation transférée');
                setTransferOpen(false);
                void threadQ.refetch();
                void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
              } finally {
                setTransferBusy(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransferParticipantPicker({
  onPick,
  disabled,
  searchFn,
}: {
  onPick: (id: string) => void | Promise<void>;
  disabled: boolean;
  searchFn: (q: string) => Promise<
    { id: string; email?: string; first_name?: string; last_name?: string; role?: string }[]
  >;
}) {
  const [q, setQ] = React.useState('');
  const [rows, setRows] = React.useState<
    { id: string; email?: string; first_name?: string; last_name?: string; role?: string }[]
  >([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let ok = true;
    if (q.length < 2) {
      setRows([]);
      return;
    }
    setLoading(true);
    void searchFn(q).then((r) => {
      if (ok) {
        setRows(r);
        setLoading(false);
      }
    });
    return () => {
      ok = false;
    };
  }, [q, searchFn]);

  return (
    <Command shouldFilter={false} className="rounded-lg border border-border">
      <CommandInput placeholder="Nom, email du nouveau contact…" value={q} onValueChange={setQ} disabled={disabled} />
      <CommandList>
        <CommandEmpty>{loading ? 'Recherche…' : q.length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun profil'}</CommandEmpty>
        <CommandGroup>
          {rows.map((u) => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id;
            return (
              <CommandItem
                key={u.id}
                value={u.id}
                onSelect={() => void onPick(u.id)}
                disabled={disabled}
                className="cursor-pointer"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.email} · {u.role || '—'}
                  </span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
