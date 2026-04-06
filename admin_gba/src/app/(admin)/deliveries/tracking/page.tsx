'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  fetchActiveDeliveries, fetchDriverLocations, fetchDeliveryStatusHistory,
  forceDeliveryStatus, reassignDelivery, fetchTrackingKpis, fetchAvailableDrivers,
  type ActiveDelivery, type StatusHistory,
} from '@/lib/services/tracking';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Navigation, RefreshCw, MapPin, Phone, CheckCircle2,
  AlertTriangle, Truck, Activity, LocateFixed
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const TrackingMap = dynamic(
  () => import('@/components/ui/custom/TrackingMap').then(m => ({ default: m.TrackingMap })),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-muted"><span className="text-sm text-muted-foreground">Chargement de la carte...</span></div> }
);

const DELIVERY_STATUSES = [
  { value: 'assigned', label: 'Assigné' },
  { value: 'picked_up', label: 'Récupéré' },
  { value: 'in_transit', label: 'En transit' },
  { value: 'out_for_delivery', label: 'En livraison' },
  { value: 'delivered', label: 'Livré' },
  { value: 'failed', label: 'Échoué' },
];

function fmtTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm', { locale: fr }); } catch { return '—'; }
}
function fmtRelative(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr }); } catch { return '—'; }
}

function isStale(capturedAt?: string | null, maxMins = 10) {
  if (!capturedAt) return true;
  return (Date.now() - new Date(capturedAt).getTime()) > maxMins * 60 * 1000;
}

export default function TrackingPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'stale'>('active');
  const [forceStatusDialog, setForceStatusDialog] = useState<{ delivery: ActiveDelivery; newStatus: string } | null>(null);
  const [deliveriesWithLoc, setDeliveriesWithLoc] = useState<ActiveDelivery[]>([]);
  const [statusNote, setStatusNote] = useState('');

  const deliveriesQuery = useQuery({
    queryKey: ['tracking-deliveries'],
    queryFn: fetchActiveDeliveries,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const kpisQuery = useQuery({
    queryKey: ['tracking-kpis'],
    queryFn: fetchTrackingKpis,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const driversQuery = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => fetchAvailableDrivers(),
    staleTime: 60_000,
  });

  const historyQuery = useQuery({
    queryKey: ['delivery-history', selectedId],
    queryFn: () => selectedId ? fetchDeliveryStatusHistory(selectedId) : Promise.resolve([]),
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  const forceStatusMut = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note: string }) =>
      forceDeliveryStatus(id, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracking-deliveries'] });
      qc.invalidateQueries({ queryKey: ['tracking-kpis'] });
      setForceStatusDialog(null);
      setStatusNote('');
      toast.success('Statut mis à jour');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reassignMut = useMutation({
    mutationFn: ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) =>
      reassignDelivery(deliveryId, driverId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracking-deliveries'] }); toast.success('Réassigné'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Merge locations into deliveries
  const mergeLocations = useCallback(async (deliveries: ActiveDelivery[]) => {
    const driverIds = [...new Set(deliveries.map(d => d.driver_id).filter(Boolean) as string[])];
    if (!driverIds.length) { setDeliveriesWithLoc(deliveries); return; }
    try {
      const locMap = await fetchDriverLocations(driverIds);
      setDeliveriesWithLoc(deliveries.map(d => ({
        ...d,
        driver_location: d.driver_id ? (locMap[d.driver_id] || null) : null,
      })));
    } catch { setDeliveriesWithLoc(deliveries); }
  }, []);

  useEffect(() => {
    if (deliveriesQuery.data) mergeLocations(deliveriesQuery.data);
  }, [deliveriesQuery.data, mergeLocations]);

  // Supabase realtime — driver_locations
  useEffect(() => {
    const ch = supabase
      .channel('tracking-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations' }, () => {
        if (deliveriesQuery.data) mergeLocations(deliveriesQuery.data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
        qc.invalidateQueries({ queryKey: ['tracking-deliveries'] });
        qc.invalidateQueries({ queryKey: ['tracking-kpis'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deliveriesQuery.data, mergeLocations, qc]);

  const selectedDelivery = deliveriesWithLoc.find(d => d.id === selectedId) || null;
  const drivers = driversQuery.data || [];

  const filtered = deliveriesWithLoc.filter(d => {
    if (filter === 'active') return !isStale(d.driver_location?.captured_at, 15);
    if (filter === 'stale') return isStale(d.driver_location?.captured_at, 15);
    return true;
  });

  const kpis = kpisQuery.data;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <PageHeader
        title="Suivi GPS en direct"
        subtitle="Positions temps réel · App client + Livreurs"
        actions={
          <Button variant="outline" size="sm" onClick={() => {
            qc.invalidateQueries({ queryKey: ['tracking-deliveries'] });
            qc.invalidateQueries({ queryKey: ['tracking-kpis'] });
          }}>
            <RefreshCw className={`h-3.5 w-3.5 ${deliveriesQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 shrink-0">
        <KpiCard label="Livreurs actifs" value={kpis?.activeDrivers ?? 0} icon={<Activity className="h-4 w-4" />} iconBg="rgba(16,185,129,0.12)" iconColor="#10B981" loading={kpisQuery.isLoading} />
        <KpiCard label="En transit" value={kpis?.inTransit ?? 0} icon={<Truck className="h-4 w-4" />} iconBg="rgba(99,102,241,0.12)" iconColor="#6366F1" loading={kpisQuery.isLoading} />
        <KpiCard label="En retard" value={kpis?.delayed ?? 0} icon={<AlertTriangle className="h-4 w-4" />} iconBg="rgba(239,68,68,0.12)" iconColor="#EF4444" loading={kpisQuery.isLoading} />
        <KpiCard label="Livrées aujourd'hui" value={kpis?.deliveredToday ?? 0} icon={<CheckCircle2 className="h-4 w-4" />} iconBg="rgba(245,158,11,0.12)" iconColor="#F59E0B" loading={kpisQuery.isLoading} />
      </div>

      {/* Main panel */}
      <div className="flex flex-1 gap-3 overflow-hidden">

        {/* Left sidebar — delivery list */}
        <Card className="w-72 shrink-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Livraisons actives</p>
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          {/* Filter tabs */}
          <div className="flex border-b border-border">
            {([['all','Toutes'],['active','Actives'],['stale','Inactives']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  filter === v ? 'bg-primary/5 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                }`}>{l}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {deliveriesQuery.isLoading ? (
              <div className="p-3 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Navigation className="h-5 w-5" />} title="Aucune livraison" />
            ) : (
              filtered.map(d => {
                const loc = d.driver_location;
                const stale = isStale(loc?.captured_at, 10);
                const isSelected = d.id === selectedId;
                return (
                  <button key={d.id} onClick={() => setSelectedId(isSelected ? null : d.id)}
                    className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/20 ${
                      isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                    }`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                      stale ? 'bg-muted' : 'bg-emerald-500/10'
                    }`}>
                      <Truck className={`h-4 w-4 ${stale ? 'text-muted-foreground' : 'text-emerald-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate">{d.driver_name || 'Livreur'}</span>
                        <span className={`h-2 w-2 rounded-full shrink-0 ${stale ? 'bg-muted-foreground' : 'bg-emerald-500'}`} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">#{d.order_number || '—'} · {d.client_name || '?'}</p>
                      {loc && <p className="text-[10px] text-muted-foreground mt-0.5">{fmtRelative(loc.captured_at)}</p>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Map */}
        <Card className="flex-1 overflow-hidden relative">
          {deliveriesQuery.isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Skeleton className="w-full h-full" />
            </div>
          ) : (
            <TrackingMap
              deliveries={filtered}
              selectedId={selectedId}
              onSelectDelivery={setSelectedId}
            />
          )}
          {/* Map legend */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur rounded-lg px-3 py-2 text-xs space-y-1 shadow">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Actif (&lt; 10 min)</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground" />Inactif</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" />Sélectionné</div>
          </div>
        </Card>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedDelivery} onOpenChange={open => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="text-sm flex items-center gap-2">
              <LocateFixed className="h-4 w-4 text-primary" />
              Détails livraison
            </SheetTitle>
          </SheetHeader>
          {selectedDelivery && (
            <div className="p-4 space-y-5">
              {/* Driver & order info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-primary">{(selectedDelivery.driver_name || 'L')[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedDelivery.driver_name || 'Livreur'}</p>
                    {selectedDelivery.driver_phone && (
                      <a href={`tel:${selectedDelivery.driver_phone}`} className="text-xs text-primary flex items-center gap-1">
                        <Phone className="h-3 w-3" />{selectedDelivery.driver_phone}
                      </a>
                    )}
                  </div>
                  <StatusBadge status={selectedDelivery.status} size="sm" className="ml-auto" />
                </div>
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Commande</span><span className="font-mono font-medium">#{selectedDelivery.order_number || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Client</span><span>{selectedDelivery.client_name || '—'}</span></div>
                  {selectedDelivery.client_phone && <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Tél client</span><span>{selectedDelivery.client_phone}</span></div>}
                  {selectedDelivery.shipping_address && <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Adresse</span><span>{selectedDelivery.shipping_address}</span></div>}
                  {selectedDelivery.shipping_city && <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Ville</span><span>{selectedDelivery.shipping_city}</span></div>}
                </div>
              </div>

              {/* GPS Position */}
              {selectedDelivery.driver_location && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Position GPS livreur</p>
                  <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs">
                    <div className="flex gap-2"><span className="text-muted-foreground w-20">Latitude</span><span className="font-mono">{selectedDelivery.driver_location.lat.toFixed(6)}</span></div>
                    <div className="flex gap-2"><span className="text-muted-foreground w-20">Longitude</span><span className="font-mono">{selectedDelivery.driver_location.lng.toFixed(6)}</span></div>
                    {selectedDelivery.driver_location.accuracy != null && <div className="flex gap-2"><span className="text-muted-foreground w-20">Précision</span><span>±{Math.round(selectedDelivery.driver_location.accuracy)}m</span></div>}
                    {selectedDelivery.driver_location.speed != null && <div className="flex gap-2"><span className="text-muted-foreground w-20">Vitesse</span><span>{Math.round(selectedDelivery.driver_location.speed)} km/h</span></div>}
                    <div className="flex gap-2"><span className="text-muted-foreground w-20">Dernière MAJ</span><span>{fmtRelative(selectedDelivery.driver_location.captured_at)}</span></div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedDelivery.driver_location.lat},${selectedDelivery.driver_location.lng}`}
                    target="_blank" rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <MapPin className="h-3 w-3" />Ouvrir dans Google Maps
                  </a>
                </div>
              )}

              <Separator />

              {/* Status timeline */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Timeline statuts</p>
                {historyQuery.isLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : (
                  <div className="space-y-2">
                    {(historyQuery.data || []).map((h: StatusHistory, i: number) => (
                      <div key={h.id} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          </div>
                          {i < (historyQuery.data?.length || 0) - 1 && <div className="w-px h-4 bg-border" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <p className="text-xs font-medium">{h.status}</p>
                          {h.note && <p className="text-[11px] text-muted-foreground">{h.note}</p>}
                          <p className="text-[10px] text-muted-foreground">{fmtRelative(h.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {(!historyQuery.data || historyQuery.data.length === 0) && (
                      <p className="text-xs text-muted-foreground">Aucun historique disponible.</p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Admin actions */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions admin</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Forcer le statut</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DELIVERY_STATUSES.map(s => (
                      <Button key={s.value} variant="outline" size="sm" className="h-7 text-xs"
                        disabled={selectedDelivery.status === s.value || forceStatusMut.isPending}
                        onClick={() => setForceStatusDialog({ delivery: selectedDelivery, newStatus: s.value })}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Réassigner à un livreur</p>
                  <select
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value && selectedDelivery) {
                        reassignMut.mutate({ deliveryId: selectedDelivery.id, driverId: e.target.value });
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">— Sélectionner un livreur —</option>
                    {drivers.map((drv: any) => (
                      <option key={drv.id} value={drv.id}>{drv.first_name} {drv.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm force status dialog */}
      <ConfirmDialog
        open={!!forceStatusDialog}
        onOpenChange={open => !open && setForceStatusDialog(null)}
        title={`Forcer le statut → "${forceStatusDialog?.newStatus}" ?`}
        description="Cette action modifie le statut de la livraison immédiatement."
        confirmLabel="Confirmer"
        loading={forceStatusMut.isPending}
        onConfirm={() => forceStatusDialog && forceStatusMut.mutate({
          id: forceStatusDialog.delivery.id,
          status: forceStatusDialog.newStatus,
          note: statusNote,
        })}
      />
    </div>
  );
}
