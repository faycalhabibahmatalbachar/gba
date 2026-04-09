'use client';

import * as React from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useMessagesContext } from './MessagesContext';
import type { ConversationListItem } from './types';
import { BroadcastInAppDialog } from './BroadcastInAppDialog';

type FilterTab = 'all' | 'unread' | 'clients' | 'drivers' | 'admins' | 'broadcast';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function fetchConversationsPage({
  cursor,
  filter,
  search,
}: {
  cursor: string | undefined;
  filter: FilterTab;
  search: string;
}): Promise<{ conversations: ConversationListItem[]; next_cursor: string | null }> {
  const u = new URL('/api/messages/conversations', window.location.origin);
  u.searchParams.set('limit', '30');
  if (cursor) u.searchParams.set('cursor', cursor);
  if (search.trim()) u.searchParams.set('search', search.trim());
  u.searchParams.set('filter', filter);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
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

  const flat = React.useMemo(
    () => infinite.data?.pages.flatMap((p) => p.conversations) ?? [],
    [infinite.data?.pages],
  );

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
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
    const j = (await res.json()) as { data?: { id: string; email?: string; first_name?: string; last_name?: string; role?: string }[] };
    return j.data ?? [];
  }, []);

  const openNewConvDialog = () => setNewOpen(true);

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
      toast.error(String((e as Error).message));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex w-full shrink-0 flex-col border-r border-border bg-background md:w-[280px]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-semibold">Messages</h2>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setBroadcastOpen(true)} title="Broadcast">
            <span className="text-xs font-bold">B</span>
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
            className="h-8 pl-7 text-xs"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-1 py-1">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 bg-muted/40 p-0.5">
            {(
              [
                ['all', 'Tous'],
                ['unread', 'Non lus'],
                ['clients', 'Clients'],
                ['drivers', 'Drivers'],
                ['admins', 'Admins'],
                ['broadcast', 'Broadcast'],
              ] as const
            ).map(([val, label]) => (
              <TabsTrigger key={val} value={val} className="px-1 py-1 text-[10px]">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto" onScroll={onScrollList}>
          {infinite.isLoading ? (
            <div className="p-3 text-xs text-muted-foreground">Chargement…</div>
          ) : flat.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">Aucune conversation</div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const c = flat[vi.index];
                const selected = c.id === selectedConversationId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className={cn(
                      'absolute left-0 top-0 flex h-[72px] w-full cursor-pointer items-center gap-3 border-b border-border/50 px-3 text-left hover:bg-muted/50',
                      selected && 'border-l-2 border-l-brand bg-brand/10',
                    )}
                    style={{ transform: `translateY(${vi.start}px)` }}
                    onClick={() => {
                      setSelectedConversationId(c.id);
                      setMobilePanel('thread');
                    }}
                  >
                    <AvatarWithInitials
                      name={c.contact_name}
                      src={c.avatar_url}
                      className="size-10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-1">
                        <span className="truncate text-sm font-medium">{c.contact_name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {c.last_message_at
                            ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: fr })
                            : ''}
                        </span>
                      </div>
                      <div className="flex justify-between gap-1">
                        <span className="truncate text-xs text-muted-foreground">{c.last_message_excerpt || '—'}</span>
                        {c.unread_count > 0 ? (
                          <Badge className="h-5 min-w-5 shrink-0 bg-brand px-1 text-[10px] text-white">{c.unread_count}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={cn('h-2 w-2 shrink-0 rounded-full', c.is_online ? 'bg-green-500' : 'bg-gray-300')}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Tabs>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
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
  searchFn: (q: string) => Promise<{ id: string; email?: string; first_name?: string; last_name?: string; role?: string }[]>;
}) {
  const [q, setQ] = React.useState('');
  const [rows, setRows] = React.useState<{ id: string; email?: string; first_name?: string; last_name?: string; role?: string }[]>([]);
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
        <CommandEmpty>{loading ? 'Recherche…' : q.length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun profil'}</CommandEmpty>
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
