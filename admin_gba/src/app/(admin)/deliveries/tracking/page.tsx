'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDeliveries, updateDeliveryStatus, buildDestinationAddress, buildGoogleMapsDirectionsUrl, buildOsmUrl } from '@/lib/services/deliveries';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { MapPin, ExternalLink, CheckCircle2, RefreshCw, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM HH:mm', { locale: fr }); } catch { return iso; }
}

export default function TrackingPage() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tracking-active'],
    queryFn: () => fetchDeliveries({ page: 1, pageSize: 50, status: 'shipped' }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const deliverMut = useMutation({
    mutationFn: (id: string) => updateDeliveryStatus(id, 'delivered'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracking-active'] }); toast.success('Livraison confirmée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deliveries = query.data?.data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suivi en temps réel"
        subtitle={`${deliveries.length} livraison${deliveries.length !== 1 ? 's' : ''} en cours`}
        actions={
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['tracking-active'] })}>
            <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon={<Navigation className="h-8 w-8" />}
          title="Aucune livraison en transit"
          description="Les livraisons avec statut 'Expédiée' apparaîtront ici."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deliveries.map(d => {
            const dest = buildDestinationAddress(d);
            const mapsUrl = buildGoogleMapsDirectionsUrl(d);
            const osmUrl = buildOsmUrl(d);
            return (
              <Card key={d.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">#{d.order_number || d.id.slice(0, 8)}</p>
                    <p className="font-semibold text-sm mt-0.5">{d.customer_name || '—'}</p>
                    {d.customer_phone && <p className="text-xs text-muted-foreground">{d.customer_phone}</p>}
                  </div>
                  <StatusBadge status={d.status || 'shipped'} size="sm" />
                </div>

                {dest && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{dest}</span>
                  </div>
                )}

                {d.driver_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-primary">{d.driver_name[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-muted-foreground">{d.driver_name}</span>
                    {d.driver_phone && <span className="text-muted-foreground">· {d.driver_phone}</span>}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {fmtDate(d.created_at)}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Google Maps
                      </Button>
                    </a>
                  )}
                  {osmUrl && !mapsUrl && (
                    <a href={osmUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        OpenStreetMap
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs ml-auto"
                    onClick={() => deliverMut.mutate(d.id)}
                    disabled={deliverMut.isPending}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Livrée
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
