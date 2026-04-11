'use client';

import * as React from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Archive,
  BellOff,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  Mic,
  Pin,
  Plus,
  Search,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { AvatarWithInitials } from '@/components/ui/custom/AvatarWithInitials';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useMessagesContext } from './MessagesContext';
import type { ConversationListItem } from './types';
import { BroadcastInAppDialog } from './BroadcastInAppDialog';
import { msgCopy } from './messagesCopy';

type FilterTab = 'all' | 'unread' | 'clients' | 'drivers' | 'admins' | 'broadcast' | 'archived';

const FILTER_CHIPS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: msgCopy.filterAll },
  { id: 'unread', label: msgCopy.filterUnread },
  { id: 'clients', label: msgCopy.filterClients },
  { id: 'drivers', label: msgCopy.filterDrivers },
  { id: 'admins', label: msgCopy.filterAdmins },
  { id: 'broadcast', label: msgCopy.filterBroadcast },
  { id: 'archived', label: msgCopy.filterArchived },
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function lastMessageIcon(t: string | undefined) {
  const x = (t || 'text').toLowerCase();
  if (x === 'image') return <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />;
  if (x === 'audio') return <Mic className="h-3 w-3 shrink-0 text-muted-foreground" />;
  if (x === 'file') return <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />;
  return <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />;
}

function roleChipLabel(role: string | null | undefined): string {
  const r = String(role || '').toLowerCase();
  if (r === 'driver') return 'Livreur';
  if (r === 'admin' || r === 'superadmin' || r === 'super_admin') return 'Admin';
  if (r === 'client' || r === 'customer' || r === 'user') return 'Client';
  return r || '—';
}

async function fetchConversationsPage({
  cursor,
  filter,
  search,
}: {
  cursor: string | undefined;
  filter: FilterTab;
  search: string;
}): Promise<{
  conversations: ConversationListItem[];
  next_cursor: string | null;
  tab_counts?: { unread_conversations: number };
}> {
  const u = new URL('/api/messages/conversations', window.location.origin);
  u.searchParams.set('limit', '30');
  if (cursor) u.searchParams.set('cursor', cursor);
  if (search.trim()) u.searchParams.set('search', search.trim());
  u.searchParams.set('filter', filter);
  const res = await fetch(u.toString());
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    conversations?: ConversationListItem[];
    next_cursor?: string | null;
    tab_counts?: { unread_conversations: number };
  };
  if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : res.statusText);
  return {
    conversations: j.conversations ?? [],
    next_cursor: j.next_cursor ?? null,
    tab_counts: j.tab_counts,
  };
}

async function patchConversationMetadata(id: string, partial: Record<string, unknown>) {
  const res = await fetch(`/api/messages/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata: partial }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    const err =
      typeof j.error === 'string'
        ? j.error
        : j.error && typeof j.error === 'object' && 'formErrors' in (j.error as object)
          ? JSON.stringify(j.error)
          : 'Échec';
    throw new Error(err);
  }
}

export function ConversationsList() {
  const { selectedConversationId, setSelectedConversationId, setMobilePanel } = useMessagesContext();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<FilterTab>('all');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [newOpen, setNewOpen] = React.useState(false);
  const [broadcastOpen, setBroadcastOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const parentRef = React.useRef<HTMLDivElement>(null);

  const infinite = useInfiniteQuery({
    queryKey: ['msg-conversations', filter, debouncedSearch],
    queryFn: ({ pageParam }) =>
      fetchConversationsPage({ cursor: pageParam as string | undefined, filter, search: debouncedSearch }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const tabCounts = infinite.data?.pages[0]?.tab_counts;

  const flat = React.useMemo(
    () => infinite.data?.pages.flatMap((p) => p.conversations) ?? [],
    [infinite.data?.pages],
  );

  const duplicateNames = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of flat) {
      m.set(c.contact_name, (m.get(c.contact_name) || 0) + 1);
    }
    return m;
  }, [flat]);

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  const onScrollList = React.useCallback(() => {
    const el = parentRef.current;
    if (!el || !infinite.hasNextPage || infinite.isFetchingNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) void infinite.fetchNextPage();
  }, [infinite]);

  React.useEffect(() => {
    const ch = supabase
      .channel('gba-msg-conversations-refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {
          void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const searchProfiles = React.useCallback(async (q: string) => {
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

  const openNewConvDialog = () => setNewOpen(true);

  React.useEffect(() => {
    const onOpen = () => setNewOpen(true);
    window.addEventListener('gba-messages-open-new-conv', onOpen);
    return () => window.removeEventListener('gba-messages-open-new-conv', onOpen);
  }, []);

  const createConv = async (participantId: string) => {
    setCreating(true);
    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: participantId }),
      });
      const j = (await res.json()) as { error?: string; conversation?: { id: string }; reused?: boolean };
      if (!res.ok) throw new Error(j.error || 'Échec');
      const id = j.conversation?.id as string;
      toast.success(j.reused ? 'Conversation existante ouverte' : 'Conversation créée');
      setNewOpen(false);
      await qc.invalidateQueries({ queryKey: ['msg-conversations'] });
      setSelectedConversationId(id);
      setMobilePanel('thread');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-semibold">{msgCopy.hubTitle}</h2>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setBroadcastOpen(true)}
            title={msgCopy.broadcastTitle}
          >
            <Megaphone className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" className="h-8 w-8" onClick={openNewConvDialog}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 bg-muted/50 pl-7 pr-8 text-xs"
            placeholder={msgCopy.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Effacer"
              onClick={() => setSearch('')}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="max-h-[120px] shrink-0 overflow-y-auto border-b border-border px-2 py-2">
          <div className="flex flex-wrap gap-1">
            {FILTER_CHIPS.map(({ id, label }) => {
              const active = filter === id;
              const extra =
                id === 'unread' && tabCounts?.unread_conversations != null
                  ? tabCounts.unread_conversations
                  : null;
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  className={cn('h-7 rounded-full px-2.5 text-[10px] font-medium', active && 'shadow-sm')}
                  onClick={() => setFilter(id)}
                >
                  {label}
                  {id === 'unread' && extra != null && extra > 0 ? (
                    <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[9px]">
                      {extra > 99 ? '99+' : extra}
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </div>

        <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto" onScroll={onScrollList}>
          {infinite.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-[42px] shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : flat.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">{msgCopy.noConversations}</div>
          ) : (
            <>
              <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
                {virtualizer.getVirtualItems().map((vi) => {
                  const c = flat[vi.index];
                  const selected = c.id === selectedConversationId;
                  const dup = (duplicateNames.get(c.contact_name) || 0) > 1;
                  const tags = (c.tags || []).slice(0, 2);
                  const moreTags = (c.tags || []).length - tags.length;
                  return (
                    <div
                      key={c.id}
                      data-index={vi.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full border-b border-border/50 px-2 py-1"
                      style={{ transform: `translateY(${vi.start}px)` }}
                    >
                      <div
                        className={cn(
                          'group relative flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50',
                          selected && 'bg-brand/10 ring-1 ring-brand/30',
                        )}
                        onClick={() => {
                          setSelectedConversationId(c.id);
                          setMobilePanel('thread');
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedConversationId(c.id);
                            setMobilePanel('thread');
                          }
                        }}
                      >
                        <div className="relative shrink-0">
                          <AvatarWithInitials name={c.contact_name} src={c.avatar_url} className="size-[42px]" />
                          <span
                            className={cn(
                              'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background',
                              c.is_online ? 'bg-emerald-500' : 'bg-muted-foreground/35',
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="truncate text-sm font-medium leading-tight">{c.contact_name}</span>
                                <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                                  {roleChipLabel(c.contact_role)}
                                </Badge>
                                {c.is_pinned ? <Pin className="h-3 w-3 text-amber-500" /> : null}
                                {c.is_muted ? <BellOff className="h-3 w-3 text-muted-foreground" /> : null}
                              </div>
                              {dup ? (
                                <p className="text-[10px] text-muted-foreground">
                                  {c.id.slice(0, 8)} ·{' '}
                                  {c.created_at
                                    ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })
                                    : ''}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {c.last_message_at
                                ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: fr })
                                : ''}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-1">
                            <div className="flex min-w-0 items-center gap-1">
                              {lastMessageIcon(c.last_message_type)}
                              <span className="truncate text-xs text-muted-foreground">
                                {c.last_message_excerpt || '—'}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              {c.unread_count > 0 ? (
                                <Badge className="h-5 min-w-5 bg-brand px-1 text-[10px] text-white">
                                  {c.unread_count}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          {tags.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {tags.map((t) => (
                                <span
                                  key={t}
                                  className="rounded border border-border bg-muted/40 px-1 py-0 text-[9px] text-muted-foreground"
                                >
                                  {t}
                                </span>
                              ))}
                              {moreTags > 0 ? (
                                <span className="text-[9px] text-muted-foreground">+{moreTags}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div
                          className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            title="Épingler"
                            onClick={async () => {
                              try {
                                await patchConversationMetadata(c.id, { pinned: !c.is_pinned });
                                toast.success(c.is_pinned ? 'Désépinglé' : 'Épinglé');
                                void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            title="Muet (notifications)"
                            onClick={async () => {
                              try {
                                const until = c.is_muted
                                  ? null
                                  : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
                                await patchConversationMetadata(c.id, { muted_until: until });
                                toast.success(c.is_muted ? 'Son réactivé' : 'Conversation en sourdine');
                                void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <BellOff className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            title="Archiver"
                            onClick={async () => {
                              try {
                                await patchConversationMetadata(c.id, { archived: true });
                                toast.success('Archivée');
                                void qc.invalidateQueries({ queryKey: ['msg-conversations'] });
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {infinite.isFetchingNextPage ? (
                <div className="space-y-2 border-t border-border p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="size-[42px] shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{msgCopy.newConversation}</DialogTitle>
          </DialogHeader>
          <ProfilePickCommand onPick={(id) => void createConv(id)} disabled={creating} searchFn={searchProfiles} />
          <DialogFooter />
        </DialogContent>
      </Dialog>

      <BroadcastInAppDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </div>
  );
}

function ProfilePickCommand({
  onPick,
  disabled,
  searchFn,
}: {
  onPick: (id: string) => void;
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
      <CommandInput placeholder="Nom, email…" value={q} onValueChange={setQ} disabled={disabled} />
      <CommandList>
        <CommandEmpty>
          {loading ? msgCopy.loading : q.length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun profil'}
        </CommandEmpty>
        <CommandGroup>
          {rows.map((u) => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id;
            return (
              <CommandItem
                key={u.id}
                value={u.id}
                onSelect={() => onPick(u.id)}
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
