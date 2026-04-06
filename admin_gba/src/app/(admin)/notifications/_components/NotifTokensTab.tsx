'use client';

import * as React from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { Bell, RefreshCw, Trash2 } from 'lucide-react';

type TokenRow = {
  id: string;
  user_id: string;
  contact_name: string;
  contact_email: string | null;
  role: string | null;
  platform: string;
  token_preview: string;
  last_seen_at: string;
  is_valid: boolean;
};

async function fetchTokens(cursor: string | null, platform: string) {
  const p = new URLSearchParams();
  if (cursor) p.set('cursor', cursor);
  if (platform.trim()) p.set('platform', platform.trim());
  const r = await fetch(`/api/notifications/tokens?${p}`, { credentials: 'include' });
  const t = await r.text();
  const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : r.statusText);
  return j.data as { rows: TokenRow[]; nextCursor: string | null; kpis: { total: number; valid: number } };
}

export function NotifTokensTab() {
  const qc = useQueryClient();
  const [platform, setPlatform] = React.useState('');

  const q = useInfiniteQuery({
    queryKey: ['device-tokens-admin', platform],
    queryFn: ({ pageParam }) => fetchTokens(pageParam as string | null, platform),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const kpis = q.data?.pages[0]?.kpis;

  const cleanupMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/cleanup-stale-tokens', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ deleted: number }>;
    },
    onSuccess: async (d) => {
      toast.success(`Jetons obsolètes supprimés : ${d.deleted}`);
      await logAuditEvent({
        actionType: 'delete',
        entityType: 'notification',
        description: 'Nettoyage jetons obsolètes',
        changes: { after: { deleted: d.deleted } },
      });
      qc.invalidateQueries({ queryKey: ['device-tokens-admin'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Jetons FCM</CardTitle>
          {kpis != null && (
            <p className="text-xs text-muted-foreground">
              Total {kpis.total} — valides <span className="font-medium text-foreground">{kpis.valid}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 w-40 text-sm"
            placeholder="Filtrer plateforme…"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          />
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className="size-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1" disabled={cleanupMut.isPending} onClick={() => cleanupMut.mutate()}>
            <Trash2 className="size-3.5" /> Nettoyer
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading && <Skeleton className="h-48 w-full" />}
        {q.isError && (
          <EmptyState
            icon={<Bell className="size-8" />}
            title="Erreur"
            description={(q.error as Error).message}
            action={{ label: 'Réessayer', onClick: () => q.refetch() }}
          />
        )}
        {!q.isLoading && !q.isError && rows.length === 0 && (
          <EmptyState icon={<Bell className="size-8" />} title="Aucun jeton" description="Les appareils enregistrés apparaîtront ici." />
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Plateforme</TableHead>
                  <TableHead>Jeton</TableHead>
                  <TableHead>Vu</TableHead>
                  <TableHead>Valide</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.contact_name}</div>
                      <div className="text-muted-foreground">{r.contact_email ?? r.user_id.slice(0, 8)}…</div>
                    </TableCell>
                    <TableCell className="text-xs">{r.role ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.platform}</TableCell>
                    <TableCell className="font-mono text-[11px]">{r.token_preview}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.last_seen_at).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_valid ? 'secondary' : 'destructive'} className="text-[10px]">
                        {r.is_valid ? 'oui' : 'non'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {q.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="outline" size="sm" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
              Charger plus
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
