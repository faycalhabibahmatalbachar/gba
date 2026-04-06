'use client';

import { useQuery } from '@tanstack/react-query';
import { parseApiJson } from '@/lib/fetch-api-json';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

type OrderLine = {
  line_id: string;
  order_id: string;
  quantity: number;
  amount: number;
  created_at: string | null;
  status: string | null;
  order_total: number | null;
  customer_name: string | null;
};

export function ProductOrdersTable({ productId }: { productId: string | null }) {
  const q = useQuery({
    queryKey: ['product-orders', productId],
    queryFn: async () => {
      const r = await fetch(`/api/products/${productId}/orders?limit=80`, { credentials: 'include' });
      const j = await parseApiJson<{ orders: OrderLine[]; error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      return j.orders ?? [];
    },
    enabled: !!productId,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (q.error) {
    return <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : 'Erreur'}</p>;
  }

  const rows = q.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Aucune commande pour ce produit.</p>;
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left p-2 font-medium text-muted-foreground">Commande</th>
            <th className="text-left p-2 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
            <th className="text-left p-2 font-medium text-muted-foreground hidden md:table-cell">Client</th>
            <th className="text-right p-2 font-medium text-muted-foreground">Qté</th>
            <th className="text-right p-2 font-medium text-muted-foreground">Montant</th>
            <th className="text-left p-2 font-medium text-muted-foreground">Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.line_id} className="border-b border-border last:border-0">
              <td className="p-2 font-mono text-xs">#{o.order_id.slice(0, 8)}</td>
              <td className="p-2 text-xs text-muted-foreground hidden sm:table-cell">
                {o.created_at
                  ? format(new Date(o.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                  : '—'}
              </td>
              <td className="p-2 text-xs truncate max-w-[120px] hidden md:table-cell">
                {o.customer_name || '—'}
              </td>
              <td className="p-2 text-right tabular-nums">{o.quantity}</td>
              <td className="p-2 text-right tabular-nums">
                {new Intl.NumberFormat('fr-FR').format(o.amount)} XOF
              </td>
              <td className="p-2">
                <StatusBadge status={o.status || 'pending'} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
