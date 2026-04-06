'use client';

import { useQuery } from '@tanstack/react-query';
import { parseApiJson } from '@/lib/fetch-api-json';
import { JsonDiffViewer } from '@/components/shared/JsonDiffViewer';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type AuditRow = {
  id?: string;
  action_type?: string | null;
  action_description?: string | null;
  created_at?: string | null;
  user_email?: string | null;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
};

export function ProductAuditTimeline({ productId }: { productId: string | null }) {
  const q = useQuery({
    queryKey: ['product-audit', productId],
    queryFn: async () => {
      const r = await fetch(
        `/api/audit?entity_type=product&entity_id=${encodeURIComponent(productId!)}&limit=40&page=1`,
        { credentials: 'include' },
      );
      const j = await parseApiJson<{ logs?: AuditRow[]; data?: AuditRow[] }>(r);
      if (!r.ok) throw new Error('Erreur audit');
      return j.logs ?? j.data ?? [];
    },
    enabled: !!productId,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const logs = q.data ?? [];
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground py-6">Aucun historique d&apos;audit pour ce produit.</p>;
  }

  return (
    <div className="space-y-4">
      {logs.map((log, idx) => {
        const before = log.changes?.before ?? {};
        const after = log.changes?.after ?? {};
        const hasDiff = Object.keys(before).length > 0 || Object.keys(after).length > 0;
        return (
          <div key={log.id ?? String(idx)} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{log.action_type || 'action'}</span>
              <span className="text-muted-foreground">
                {log.created_at
                  ? format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: fr })
                  : ''}
              </span>
            </div>
            {log.action_description ? (
              <p className="text-xs text-muted-foreground">{log.action_description}</p>
            ) : null}
            {log.user_email ? (
              <p className="text-xs text-muted-foreground">Par {log.user_email}</p>
            ) : null}
            {hasDiff ? (
              <JsonDiffViewer before={before} after={after} className="text-xs max-h-48 overflow-auto" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
