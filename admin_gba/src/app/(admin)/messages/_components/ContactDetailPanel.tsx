'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CreditCard, ExternalLink, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AvatarWithInitials } from '@/components/ui/custom/AvatarWithInitials';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMessagesContext } from './MessagesContext';
import { msgCopy } from './messagesCopy';

function fmtXof(n: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' XOF';
}

export function ContactDetailPanel() {
  const { selectedConversationId } = useMessagesContext();
  const detailQ = useQuery({
    queryKey: ['msg-thread', selectedConversationId],
    enabled: !!selectedConversationId,
    queryFn: async () => {
      const res = await fetch(`/api/messages/conversations/${selectedConversationId}`);
      if (!res.ok) throw new Error('Erreur');
      return res.json() as Promise<{
        participant: Record<string, unknown> | null;
        conversation: Record<string, unknown>;
        stats: {
          message_count: number;
          first_message_at: string | null;
          avg_response_time: string;
          messages_per_week: number | null;
          orders_count?: number;
          orders_total?: number;
        };
        medias?: { url: string; type?: string }[];
      }>;
    },
  });

  const meta = (detailQ.data?.conversation?.metadata as Record<string, unknown>) || {};
  const initialNotes = typeof meta.admin_notes === 'string' ? meta.admin_notes : '';
  const initialTags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];

  const [notes, setNotes] = React.useState(initialNotes);
  const [tags, setTags] = React.useState<string[]>(initialTags);
  const [notesSavedAt, setNotesSavedAt] = React.useState<string | null>(null);
  const [pushOpen, setPushOpen] = React.useState(false);
  const [pushTitle, setPushTitle] = React.useState('');
  const [pushBody, setPushBody] = React.useState('');
  const [mediaOpen, setMediaOpen] = React.useState(false);

  React.useEffect(() => {
    setNotes(initialNotes);
    setTags(initialTags);
  }, [selectedConversationId, initialNotes, initialTags.join(',')]);

  const notesTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onNotes = (v: string) => {
    setNotes(v);
    if (!selectedConversationId) return;
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      void fetch(`/api/messages/conversations/${selectedConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: v }),
      }).then(() => {
        setNotesSavedAt(format(new Date(), 'HH:mm', { locale: fr }));
      });
    }, 2000);
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    void fetch(`/api/messages/conversations/${selectedConversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: next }),
    });
    toast.success('Tags mis à jour');
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = e.currentTarget.value.trim();
    if (!v || tags.includes(v) || tags.length >= 10) return;
    const next = [...tags, v];
    setTags(next);
    e.currentTarget.value = '';
    void fetch(`/api/messages/conversations/${selectedConversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: next }),
    });
  };

  if (!selectedConversationId) {
    return <div className="hidden w-[320px] shrink-0 border-l border-border bg-muted/5 lg:block" />;
  }

  const p = detailQ.data?.participant;
  const userId = (p?.id as string) || '';
  const name =
    p && ([p.first_name, p.last_name].filter(Boolean).join(' ') || (p.email as string) || 'Contact');
  const role = String(p?.role || 'user');
  const isOnline = Boolean(p?.is_online);
  const lastSeen = p?.last_seen_at as string | undefined;

  const profileHref = role === 'driver' ? `/drivers/${userId}` : `/users/${userId}`;
  const stats = detailQ.data?.stats;
  const medias = detailQ.data?.medias ?? [];
  const ordersCount = stats?.orders_count ?? 0;
  const ordersTotal = stats?.orders_total ?? 0;

  return (
    <div className="flex w-full shrink-0 flex-col overflow-y-auto border-l border-border bg-background lg:w-[320px]">
      <div className="space-y-3 border-b border-border p-4 text-center">
        <AvatarWithInitials name={String(name)} src={(p?.avatar_url as string) || null} className="mx-auto size-16" />
        <h3 className="font-semibold">{name}</h3>
        <StatusBadge status={role} customLabel={role} className="mx-auto" />
        <p className="text-xs text-muted-foreground">
          {isOnline ? 'En ligne' : lastSeen ? `Vu ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: fr })}` : '—'}
        </p>
        <Link
          href={profileHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          {msgCopy.seeFullProfile}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="border-b border-border p-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">{msgCopy.statsMessages}</dt>
          <dd className="text-right font-medium">{stats?.message_count ?? '—'}</dd>
          <dt className="text-muted-foreground">{msgCopy.statsAvgReply}</dt>
          <dd className="text-right">{stats?.avg_response_time ?? '—'}</dd>
          <dt className="text-muted-foreground">{msgCopy.statsFirstContact}</dt>
          <dd className="text-right">
            {stats?.first_message_at
              ? format(new Date(stats.first_message_at), 'dd MMM yyyy', { locale: fr })
              : '—'}
          </dd>
          <dt className="text-muted-foreground">{msgCopy.statsPerWeek}</dt>
          <dd className="text-right">{stats?.messages_per_week ?? '—'}</dd>
          <dt className="text-muted-foreground">{msgCopy.ordersBadge}</dt>
          <dd className="text-right font-medium">{ordersCount}</dd>
          <dt className="text-muted-foreground">{msgCopy.spentBadge}</dt>
          <dd className="text-right">{fmtXof(ordersTotal)}</dd>
        </dl>
      </div>

      <div className="space-y-2 border-b border-border p-4">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          onClick={() => setPushOpen(true)}
        >
          <Bell className="h-3.5 w-3.5" /> {msgCopy.pushNotification}
        </Button>
        <Sheet open={pushOpen} onOpenChange={setPushOpen}>
          <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{msgCopy.pushNotification}</SheetTitle>
              <SheetDescription>Rédigez un court message pour une notification mobile (flux admin à brancher sur votre dispatcher).</SheetDescription>
            </SheetHeader>
            <div className="space-y-2">
              <Input placeholder="Titre" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
              <Textarea
                placeholder="Corps du message"
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                toast.message('Notification', {
                  description: 'Branchez cette action sur votre pipeline push (device_tokens / campagne).',
                });
                setPushOpen(false);
              }}
            >
              Envoyer (aperçu)
            </Button>
          </SheetContent>
        </Sheet>
        <Link
          href={`/orders?q=${encodeURIComponent(String(p?.email || userId || ''))}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'default' }), 'w-full justify-start gap-2 text-sm')}
        >
          <ShoppingBag className="h-3.5 w-3.5" /> {msgCopy.seeOrders}
        </Link>
        <Link
          href={`/users/${userId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'default' }), 'w-full justify-start gap-2 text-sm')}
        >
          <CreditCard className="h-3.5 w-3.5" /> {msgCopy.seePayments}
        </Link>
      </div>

      {medias.length > 0 ? (
        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{msgCopy.mediasSection}</p>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMediaOpen(true)}>
              {msgCopy.seeAllMedias}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {medias.slice(0, 6).map((m) => (
              <button
                key={m.url}
                type="button"
                className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
                onClick={() => setMediaOpen(true)}
              >
                <Image src={m.url} alt="" fill className="object-cover" unoptimized sizes="100px" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{msgCopy.mediasSection}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {medias.map((m) => (
              <a
                key={m.url}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square overflow-hidden rounded-md border"
              >
                <Image src={m.url} alt="" fill className="object-cover" unoptimized sizes="150px" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="border-b border-border p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{msgCopy.privateNotes}</p>
        <Textarea
          placeholder="Notes internes…"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          className="min-h-[80px] text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {notesSavedAt ? msgCopy.notesSavedHint(notesSavedAt) : '—'}
        </p>
      </div>

      <div className="p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{msgCopy.tagsSection}</p>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="cursor-pointer text-xs" onClick={() => removeTag(tag)}>
              {tag} ×
            </Badge>
          ))}
          <Input placeholder={msgCopy.tagsPlaceholder} className="h-6 w-28 text-xs" onKeyDown={addTag} />
        </div>
      </div>
    </div>
  );
}
