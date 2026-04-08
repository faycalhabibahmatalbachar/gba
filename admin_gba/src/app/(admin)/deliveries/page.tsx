'use client';

import { Suspense, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import {
  fetchDeliveries, fetchDeliveryKpis, updateDeliveryStatus, assignDriver,
  buildDestinationAddress, buildGoogleMapsDirectionsUrl,
  type DeliveryOrderRow,
} from '@/lib/services/deliveries';
import { supabase } from '@/lib/supabase/client';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Truck, Clock, CheckCircle2, XCircle, AlertTriangle,
  Search, Filter, ChevronLeft, ChevronRight, MapPin,
  RefreshCw, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PAGE_SIZE = 20;

const STATUSES = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'payment_pending', label: 'Paiement en attente' },
  { value: 'paid', label: 'Payée' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'processing', label: 'En préparation' },
  { value: 'packed', label: 'Emballée' },
  { value: 'ready_to_ship', label: 'Prête à expédier' },
  { value: 'shipped', label: 'En cours de livraison' },
  { value: 'out_for_delivery', label: 'En livraison' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'completed', label: 'Terminée' },
  { value: 'cancelled', label: 'Annulée' },
  { value: 'refunded', label: 'Remboursée' },
  { value: 'returned', label: 'Retournée' },
  { value: 'failed', label: 'Échec' },
];

/** Label Français pour tout code de statut connu (sinon phrase lisible sans code brut anglais). */
function deliveryStatusLabel(code: string | null | undefined): string {
  const raw = String(code || '').trim();
  if (!raw) return '—';
  const k = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const map: Record<string, string> = {
    pending: 'En attente',
    payment_pending: 'Paiement en attente',
    awaiting_payment: 'En attente de paiement',
    unpaid: 'Non payée',
    paid: 'Payée',
    payment_failed: 'Paiement refusé',
    confirmed: 'Confirmée',
    processing: 'En préparation',
    packed: 'Emballée',
    ready_to_ship: 'Prête à expédier',
    shipped: 'En cours de livraison',
    out_for_delivery: 'En livraison',
    in_transit: 'En transit',
    delivered: 'Livrée',
    completed: 'Terminée',
    cancelled: 'Annulée',
    canceled: 'Annulée',
    refunded: 'Remboursée',
    returned: 'Retournée',
    failed: 'Échec',
    on_hold: 'Mise en attente',
    delayed: 'Retardée',
  };
  return map[k] || `Statut : ${raw}`;
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM HH:mm', { locale: fr }); } catch { return iso; }
}

async function fetchDrivers() {
  const primary = await supabase
    .from('profiles')
    .select('id, full_name, first_name, last_name, phone')
    .or('role.eq.driver,role.eq.livreur')
    .eq('is_active', true)
    .limit(300);
  let err = primary.error;
  let data: unknown[] = (primary.data || []) as unknown[];

  if (err && String(err.message || '').includes('full_name')) {
    const fallbackNoFullName = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .or('role.eq.driver,role.eq.livreur')
      .eq('is_active', true)
      .limit(300);
    err = fallbackNoFullName.error;
    data = (fallbackNoFullName.data || []) as unknown[];
  }

  if (err && String(err.message || '').includes('is_active')) {
    const fallbackNoActive = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, phone')
      .or('role.eq.driver,role.eq.livreur')
      .limit(300);
    err = fallbackNoActive.error;
    data = (fallbackNoActive.data || []) as unknown[];
  }

  if (err) throw new Error(err.message || 'Impossible de charger les livreurs');

  const rows = data as Array<{
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  }>;

  return rows
    .map((r) => ({
      id: r.id,
      full_name: (r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || null) as string | null,
      phone: r.phone ?? null,
    }))
    .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'fr'));
}

function DeliveriesContent() {
  const qc = useQueryClient();
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('all'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  const deliveriesQuery = useQuery({
    queryKey: ['deliveries', { search, status, page }],
    queryFn: () => fetchDeliveries({ page, pageSize: PAGE_SIZE, search: search || undefined, status: status || undefined }),
    staleTime: 20_000,
  });

  const kpisQuery = useQuery({
    queryKey: ['delivery-kpis'],
    queryFn: () => fetchDeliveryKpis(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const driversQuery = useQuery({
    queryKey: ['drivers-list'],
    queryFn: fetchDrivers,
    staleTime: 60_000,
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateDeliveryStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); qc.invalidateQueries({ queryKey: ['delivery-kpis'] }); toast.success('Statut mis à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignMut = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string | null }) => assignDriver(orderId, driverId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); toast.success('Livreur assigné'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deliveries = deliveriesQuery.data?.data || [];
  const total = deliveriesQuery.data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const kpis = kpisQuery.data;
  const drivers = driversQuery.data || [];
  const [assignForOrder, setAssignForOrder] = useState<DeliveryOrderRow | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Livraisons"
        subtitle={`${total} livraison${total !== 1 ? 's' : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ['deliveries'] }); qc.invalidateQueries({ queryKey: ['delivery-kpis'] }); }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Aujourd\'hui', value: kpis?.today ?? 0, icon: <Clock className="h-4 w-4" />, bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
          { label: 'En cours', value: kpis?.inProgress ?? 0, icon: <Truck className="h-4 w-4" />, bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
          { label: 'En retard', value: kpis?.late ?? 0, icon: <AlertTriangle className="h-4 w-4" />, bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
          { label: 'Livrées', value: kpis?.delivered ?? 0, icon: <CheckCircle2 className="h-4 w-4" />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
          { label: 'Annulées', value: kpis?.cancelled ?? 0, icon: <XCircle className="h-4 w-4" />, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
        ].map(k => (
          <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} iconBg={k.bg} iconColor={k.color} loading={kpisQuery.isLoading} />
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher N°, client..."
                value={search}
                onChange={e => { setSearch(e.target.value || null); setPage(1); }}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={status} onValueChange={v => { setStatus(v && v !== 'all' ? v : null); setPage(1); }}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">N° commande</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Livreur</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden xl:table-cell">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deliveriesQuery.isLoading && [...Array(8)].map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-9 w-full" /></td></tr>
              ))}
              {!deliveriesQuery.isLoading && deliveries.map(d => {
                const dest = buildDestinationAddress(d);
                const mapsUrl = buildGoogleMapsDirectionsUrl(d);
                return (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      #{d.order_number || d.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="font-medium truncate max-w-[120px]">{d.customer_name || '—'}</div>
                      {d.customer_phone && <div className="text-xs text-muted-foreground">{d.customer_phone}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[180px]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{dest || '—'}</span>
                        {mapsUrl && (
                          <a href={mapsUrl} target="_blank" rel="noreferrer" className="shrink-0 text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status || 'pending'} customLabel={deliveryStatusLabel(d.status)} size="sm" />
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <button
                        type="button"
                        className="w-full text-left rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors"
                        onClick={() => setAssignForOrder(d)}
                      >
                        <span className="font-medium truncate block">
                          {d.driver_name || (d.driver_id ? `Livreur ${d.driver_id.slice(0, 8)}…` : 'Cliquer pour assigner un livreur')}
                        </span>
                        {d.driver_phone ? (
                          <span className="text-[10px] text-muted-foreground truncate block">{d.driver_phone}</span>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden xl:table-cell">
                      {fmtDate(d.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Select
                        value={d.status || ''}
                        onValueChange={v => v && statusMut.mutate({ id: d.id, status: v })}
                      >
                        <SelectTrigger className="h-7 min-w-[140px] text-xs">
                          <SelectValue placeholder={deliveryStatusLabel(d.status)} />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.filter(s => s.value !== 'all').map(s => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
              {!deliveriesQuery.isLoading && deliveries.length === 0 && (
                <tr><td colSpan={7}>
                  <EmptyState icon={<Truck className="h-8 w-8" />} title="Aucune livraison" description={search || status !== 'all' ? 'Essayez d\'autres filtres.' : 'Les livraisons apparaîtront ici.'} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Page {page} / {totalPages}</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={Boolean(assignForOrder)} onOpenChange={(o) => !o && setAssignForOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assigner un livreur</DialogTitle>
          </DialogHeader>
          {assignForOrder ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground text-xs">
                Commande #{assignForOrder.order_number || assignForOrder.id.slice(0, 8)} · statut :{' '}
                <span className="font-medium text-foreground">{deliveryStatusLabel(assignForOrder.status)}</span>
              </p>
              <div className="max-h-[320px] overflow-y-auto rounded-md border divide-y">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60"
                  onClick={() => {
                    assignMut.mutate({ orderId: assignForOrder.id, driverId: null });
                    setAssignForOrder(null);
                  }}
                  disabled={assignMut.isPending}
                >
                  <span className="font-medium">Aucun livreur</span>
                  <span className="block text-muted-foreground">Retirer l&apos;assignation</span>
                </button>
                {drivers.map((dr) => (
                  <button
                    key={dr.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60"
                    onClick={() => {
                      assignMut.mutate({ orderId: assignForOrder.id, driverId: dr.id });
                      setAssignForOrder(null);
                    }}
                    disabled={assignMut.isPending}
                  >
                    <span className="font-medium">{dr.full_name || `Livreur ${dr.id.slice(0, 8)}…`}</span>
                    {dr.phone ? <span className="block text-muted-foreground">{dr.phone}</span> : null}
                  </button>
                ))}
              </div>
              {!drivers.length ? (
                <p className="text-xs text-amber-600">
                  Aucun livreur actif trouvé apres verification. Verifiez le role (driver/livreur) et l&apos;activation du profil.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignForOrder(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DeliveriesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <DeliveriesContent />
    </Suspense>
  );
}
