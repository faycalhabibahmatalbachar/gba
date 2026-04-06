'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { ImageIcon, Upload } from 'lucide-react';

type MediaRow = {
  id: string;
  url: string;
  filename?: string | null;
  size_bytes?: number | null;
  mime_type?: string | null;
  created_at: string;
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const t = await r.text();
  let body: unknown;
  try {
    body = t ? JSON.parse(t) : {};
  } catch {
    throw new Error(t || r.statusText);
  }
  if (!r.ok) {
    const err = body as { error?: unknown; hint?: string };
    const msg = typeof err.error === 'string' ? err.error : r.statusText;
    throw new Error(err.hint ? `${msg} — ${err.hint}` : msg);
  }
  return body as T;
}

export function NotifMediaTab() {
  const qc = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const listQ = useQuery({
    queryKey: ['push-media'],
    queryFn: () => jsonFetch<{ data: MediaRow[] }>('/api/notifications/media').then((r) => r.data),
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set('file', file);
      await jsonFetch('/api/notifications/media', { method: 'POST', body: fd });
    },
    onSuccess: async (_, file) => {
      toast.success(`Fichier « ${file.name} » importé`);
      await logAuditEvent({
        actionType: 'create',
        entityType: 'notification',
        description: 'Média push importé',
      });
      qc.invalidateQueries({ queryKey: ['push-media'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Médias (bucket push-media)</CardTitle>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) uploadMut.mutate(f);
            }}
          />
          <Button type="button" size="sm" className="gap-1" disabled={uploadMut.isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="size-3.5" /> Importer
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {listQ.isLoading && <Skeleton className="h-40 w-full" />}
        {listQ.isError && (
          <EmptyState
            icon={<ImageIcon className="size-8" />}
            title="Erreur"
            description={(listQ.error as Error).message}
            action={{ label: 'Réessayer', onClick: () => listQ.refetch() }}
          />
        )}
        {!listQ.isLoading && !listQ.isError && (listQ.data || []).length === 0 && (
          <EmptyState
            icon={<ImageIcon className="size-8" />}
            title="Aucun média"
            description="Les images utilisées dans les push enrichis peuvent être référencées ici."
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(listQ.data || []).map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-lg border border-border bg-muted/20 transition-colors hover:bg-muted/40"
            >
              <div className="aspect-video w-full overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="size-full object-cover" />
              </div>
              <div className="space-y-0.5 p-2 text-xs">
                <p className="truncate font-medium">{m.filename || 'Sans nom'}</p>
                <p className="text-muted-foreground">
                  {m.size_bytes != null ? `${(m.size_bytes / 1024).toFixed(1)} Ko` : '—'} ·{' '}
                  {new Date(m.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
