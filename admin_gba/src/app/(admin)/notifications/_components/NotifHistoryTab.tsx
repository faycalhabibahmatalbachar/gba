'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, RefreshCw } from 'lucide-react';

type Campaign = {
  id: string;
  title: string;
  body?: string | null;
  status: string;
  sent_count?: number | null;
  delivered_count?: number | null;
  failed_count?: number | null;
  total_targeted?: number | null;
  created_at: string;
  scheduled_at?: string | null;
  completed_at?: string | null;
  error_detail?: string | null;
};

async function fetchPage(cursor: string | null) {
  const url = cursor
    ? `/api/admin/push/history?cursor=${encodeURIComponent(cursor)}`
    : '/api/admin/push/history';
  const r = await fetch(url, { credentials: 'include' });
  const t = await r.text();
  const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : r.statusText);
  return j.data as { campaigns: Campaign[]; nextCursor: string | null };
}

function statusLabel(s: string) {
  switch (s) {
    case 'completed':
      return 'Terminé';
    case 'processing':
      return 'En cours';
    case 'failed':
      return 'Échec';
    case 'scheduled':
      return 'Planifié';
    default:
      return s;
  }
}

export function NotifHistoryTab() {
  const q = useInfiniteQuery({
    queryKey: ['push-campaign-history'],
    queryFn: ({ pageParam }) => fetchPage(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const rows = q.data?.pages.flatMap((p) => p.campaigns) ?? [];

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Campagnes push</CardTitle>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className="size-3.5" /> Actualiser
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading && <Skeleton className="h-48 w-full" />}
        {q.isError && (
          <EmptyState
            icon={<History className="size-8" />}
            title="Impossible de charger l’historique"
            description={(q.error as Error).message}
            action={{ label: 'Réessayer', onClick: () => q.refetch() }}
          />
        )}
        {!q.isLoading && !q.isError && rows.length === 0 && (
          <EmptyState icon={<History className="size-8" />} title="Aucune campagne" description="Les envois segmentés apparaîtront ici." />
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Ciblés</TableHead>
                  <TableHead className="text-right">Envoyés</TableHead>
                  <TableHead>Créé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate font-medium">{c.title}</div>
                      {c.error_detail ? (
                        <div className="mt-0.5 truncate text-[11px] text-destructive">{c.error_detail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {statusLabel(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">{c.total_targeted ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs">{c.sent_count ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString('fr-FR')}
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
