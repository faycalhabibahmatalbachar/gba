'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const OrderTrackingMap = dynamic(() => import('./OrderTrackingMap').then((m) => ({ default: m.OrderTrackingMap })), {
  ssr: false,
  loading: () => <div className="flex h-[360px] items-center justify-center rounded-[14px] border bg-muted/40 text-sm text-muted-foreground">Chargement carte…</div>,
});

export default function DeliveryTrackingContent({ orderId }: { orderId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['delivery-tracking', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/deliveries/tracking/${orderId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Commande introuvable');
      return res.json() as Promise<{
        data: {
          order: Record<string, unknown>;
          driver_location: { lat: number; lng: number } | null;
          timeline: Record<string, unknown>[];
        };
      }>;
    },
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Chargement du suivi…</div>;
  }
  if (error || !data?.data?.order) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Commande introuvable.</p>
        <Link href="/deliveries/tracking" className="mt-4 inline-block text-sm text-brand underline">
          Retour au suivi livraisons
        </Link>
      </div>
    );
  }

  const { order, driver_location, timeline } = data.data;
  const orderNumber = String(order.order_number ?? order.id ?? '').slice(0, 32);
  const status = String(order.status ?? '');

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/deliveries/tracking" className="text-sm text-muted-foreground hover:text-foreground">
          ← Suivi livraisons
        </Link>
        <h1 className="text-xl font-bold">Commande #{orderNumber}</h1>
        <StatusBadge status={status} />
      </div>

      <div className="overflow-hidden rounded-[14px] border" style={{ height: 360 }}>
        <OrderTrackingMap
          key={`${driver_location?.lat ?? 'x'}-${driver_location?.lng ?? 'y'}`}
          driver={driver_location}
          height={360}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Chronologie</h2>
          <ul className="space-y-2 text-sm">
            {(timeline || []).map((t, i) => (
              <li key={i} className="flex flex-col border-b border-border/60 pb-2 last:border-0">
                <span className="font-medium">{String(t.status ?? '—')}</span>
                <span className="text-xs text-muted-foreground">
                  {t.created_at
                    ? format(new Date(String(t.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr })
                    : '—'}
                </span>
                {t.note ? <span className="text-xs">{String(t.note)}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Détails</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Adresse</dt>
              <dd className="text-right">{String(order.shipping_address ?? '—')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Ville</dt>
              <dd className="text-right">{String(order.shipping_city ?? '—')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Montant</dt>
              <dd className="text-right">{order.total_amount != null ? `${order.total_amount} XOF` : '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
