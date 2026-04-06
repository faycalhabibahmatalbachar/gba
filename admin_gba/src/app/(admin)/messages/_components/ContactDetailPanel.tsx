'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CreditCard, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AvatarWithInitials } from '@/components/ui/custom/AvatarWithInitials';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { useMessagesContext } from './MessagesContext';

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
        stats: { message_count: number; first_message_at: string | null; avg_response_time: string };
      }>;
    },
  });

  const meta = (detailQ.data?.conversation?.metadata as Record<string, unknown>) || {};
  const initialNotes = typeof meta.admin_notes === 'string' ? meta.admin_notes : '';
  const initialTags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];

  const [notes, setNotes] = React.useState(initialNotes);
  const [tags, setTags] = React.useState<string[]>(initialTags);

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
    if (!v || tags.includes(v)) return;
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
          href={role === 'driver' ? `/drivers/${userId}` : `/users?highlight=${userId}`}
          className="mx-auto text-sm text-primary underline-offset-4 hover:underline"
        >
          Voir fiche complète →
        </Link>
      </div>

      <div className="border-b border-border p-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Messages</dt>
          <dd className="text-right font-medium">{detailQ.data?.stats.message_count ?? '—'}</dd>
          <dt className="text-muted-foreground">Réponse moy.</dt>
          <dd className="text-right">{detailQ.data?.stats.avg_response_time ?? '—'}</dd>
          <dt className="text-muted-foreground">1ère interaction</dt>
          <dd className="text-right">
            {detailQ.data?.stats.first_message_at
              ? format(new Date(detailQ.data.stats.first_message_at), 'dd MMM yyyy', { locale: fr })
              : '—'}
          </dd>
        </dl>
      </div>

      <div className="space-y-2 border-b border-border p-4">
        <Button variant="outline" className="w-full justify-start gap-2 text-sm" type="button" onClick={() => toast.message('Notifications push', { description: 'Utilisez /notifications pour une campagne ciblée.' })}>
          <Bell className="h-3.5 w-3.5" /> Envoyer notification push
        </Button>
        <Link
          href={`/orders?user_id=${userId}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'default' }), 'w-full justify-start gap-2 text-sm')}
        >
          <ShoppingBag className="h-3.5 w-3.5" /> Voir commandes
        </Link>
        <Link
          href={`/users?highlight=${userId}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'default' }), 'w-full justify-start gap-2 text-sm')}
        >
          <CreditCard className="h-3.5 w-3.5" /> Voir paiements
        </Link>
      </div>

      <div className="border-b border-border p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Notes privées</p>
        <Textarea
          placeholder="Notes internes…"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          className="min-h-[80px] text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">Sauvegarde automatique</p>
      </div>

      <div className="p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Tags</p>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="cursor-pointer text-xs" onClick={() => removeTag(tag)}>
              {tag} ×
            </Badge>
          ))}
          <Input placeholder="+ tag" className="h-6 w-24 text-xs" onKeyDown={addTag} />
        </div>
      </div>
    </div>
  );
}
