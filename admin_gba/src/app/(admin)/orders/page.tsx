'use client';

import { Suspense } from 'react';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import {
  fetchOrders, fetchOrdersKpis, fetchOrderDetails,
  updateOrderStatus, bulkUpdateOrderStatus,
  type OrderRow, type OrderDetailsRow,
} from '@/lib/services/orders';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ShoppingCart, DollarSign, Clock, CheckCircle2,
  Search, Filter, Download, ChevronLeft, ChevronRight,
  RefreshCw, User, Phone, MapPin, Package, Truck, Loader2,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PAGE_SIZE = 20;

const STATUSES = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'processing', label: 'En cours' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
];

const ACTION_STATUSES = STATUSES.filter(s => s.value !== 'all');

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' XOF';
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM yyyy HH:mm', { locale: fr }); } catch { return iso; }
}

function exportCSV(orders: OrderRow[]) {
  const header = ['N°Commande', 'Client', 'Téléphone', 'Statut', 'Montant', 'Articles', 'Date'].join(';');
  const rows = orders.map(o => [
    o.order_number || o.id.slice(0, 8),
    o.customer_name || '',
    o.customer_phone || '',
    o.status || '',
    o.total_amount || 0,
    o.total_items || 0,
    fmtDate(o.created_at),
  ].join(';'));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `commandes-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function OrdersContent() {
  const qc = useQueryClient();

  // URL state
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('all'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  // Local state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState('');

  // Queries
  const ordersQuery = useQuery({
    queryKey: ['orders', { search, status, page }],
    queryFn: () => fetchOrders({ page, pageSize: PAGE_SIZE, search: search || undefined, status: status || undefined }),
    staleTime: 20_000,
  });

  const kpisQuery = useQuery({
    queryKey: ['orders-kpis', { search, status }],
    queryFn: () => fetchOrdersKpis({ search: search || undefined, status: status || undefined }),
    staleTime: 30_000,
  });

  const detailQuery = useQuery({
    queryKey: ['order-detail', drawerOrderId],
    queryFn: () => fetchOrderDetails(drawerOrderId!),
    enabled: !!drawerOrderId,
    staleTime: 0,
  });

  // Mutations
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-detail', drawerOrderId] });
      qc.invalidateQueries({ queryKey: ['orders-kpis'] });
      toast.success('Statut mis à jour');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const bulkMut = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) => bulkUpdateOrderStatus(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders-kpis'] });
      setSelected(new Set());
      setBulkStatus('');
      toast.success(`${selected.size} commandes mises à jour`);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const orders = ordersQuery.data?.data || [];
  const total = ordersQuery.data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const kpis = kpisQuery.data;

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map(o => o.id)));
  }, [orders, selected.size]);

  const detail = detailQuery.data as OrderDetailsRow | null | undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Commandes"
        subtitle={`${total} commande${total !== 1 ? 's' : ''} au total`}
        actions={
          <>
            {orders.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => exportCSV(orders)}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['orders-kpis'] }); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total', value: kpis?.totalOrders ?? 0, icon: <ShoppingCart className="h-4 w-4" />, bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
          { label: 'CA total', value: kpis ? fmtCurrency(kpis.revenue) : '—', icon: <DollarSign className="h-4 w-4" />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
          { label: 'Panier moyen', value: kpis ? fmtCurrency(kpis.avgBasket) : '—', icon: <TrendingUp className="h-4 w-4" />, bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
          { label: 'En attente', value: kpis?.pendingCount ?? 0, icon: <Clock className="h-4 w-4" />, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
          { label: 'Livrées', value: kpis?.deliveredCount ?? 0, icon: <CheckCircle2 className="h-4 w-4" />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
          { label: 'Taux livraison', value: kpis ? `${kpis.deliveryRate.toFixed(0)}%` : '—', icon: <Truck className="h-4 w-4" />, bg: 'rgba(20,184,166,0.12)', color: '#14B8A6' },
        ].map(k => (
          <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} iconBg={k.bg} iconColor={k.color} loading={kpisQuery.isLoading} />
        ))}
      </div>

      {/* Filters bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher N°, client, téléphone..."
                value={search}
                onChange={e => { setSearch(e.target.value || null); setPage(1); }}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={status} onValueChange={v => { setStatus(v && v !== 'all' ? v : null); setPage(1); }}>
              <SelectTrigger className="h-8 w-[170px] text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground">{selected.size} sélectionné(s)</span>
                <Select value={bulkStatus} onValueChange={v => setBulkStatus(v ?? '')}>
                  <SelectTrigger className="h-8 w-[160px] text-sm">
                    <SelectValue placeholder="Changer statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" className="h-8"
                  disabled={!bulkStatus || bulkMut.isPending}
                  onClick={() => bulkMut.mutate({ ids: Array.from(selected), status: bulkStatus })}
                >
                  {bulkMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === orders.length && orders.length > 0}
                    onChange={toggleAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">N° commande</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Articles</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Montant</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordersQuery.isLoading && [...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={8}><Skeleton className="h-9 w-full" /></td>
                </tr>
              ))}
              {!ordersQuery.isLoading && orders.map(order => (
                <tr
                  key={order.id}
                  className={`hover:bg-muted/20 transition-colors cursor-pointer ${selected.has(order.id) ? 'bg-primary/5' : ''}`}
                  onClick={() => setDrawerOrderId(order.id)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    #{order.order_number || order.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="font-medium truncate max-w-[140px]">{order.customer_name || '—'}</div>
                    {order.customer_phone && (
                      <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status || 'pending'} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                    {order.total_items ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {order.total_amount ? fmtCurrency(order.total_amount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                    {fmtDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <Select
                      value={order.status || ''}
                      onValueChange={v => v && statusMut.mutate({ id: order.id, status: v })}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {!ordersQuery.isLoading && orders.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState
                    title="Aucune commande"
                    description={search || status !== 'all' ? 'Essayez d\'autres filtres.' : 'Les commandes apparaîtront ici.'}
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} sur {totalPages} — {total} résultats
            </p>
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

      {/* Detail drawer */}
      <Sheet open={!!drawerOrderId} onOpenChange={open => !open && setDrawerOrderId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="text-sm">
              Commande #{detail?.order_number || drawerOrderId?.slice(0, 8)}
            </SheetTitle>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : detail ? (
            <div className="p-4 space-y-5">
              {/* Status + quick change */}
              <div className="flex items-center justify-between">
                <StatusBadge status={detail.status || 'pending'} />
                <Select
                  value={detail.status || ''}
                  onValueChange={v => v && statusMut.mutate({ id: detail.id, status: v })}
                >
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Customer info */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{detail.customer_name || '—'}</span>
                </div>
                {(detail.customer_phone || detail.customer_phone_profile) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{detail.customer_phone || detail.customer_phone_profile}</span>
                  </div>
                )}
                {detail.shipping_city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{[detail.shipping_city, detail.shipping_district].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Driver */}
              {detail.driver_name && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Livreur</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{detail.driver_name}</span>
                      {detail.driver_phone && <span className="text-muted-foreground">· {detail.driver_phone}</span>}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Order items */}
              {detail.order_items && detail.order_items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Articles ({detail.order_items.length})
                  </p>
                  <div className="space-y-2">
                    {detail.order_items.map((item, i) => (
                      <div key={item.id || i} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0">
                          {item.product_image ? (
                            <img src={item.product_image} alt="" className="h-10 w-10 rounded-md object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product_name || 'Produit'}</p>
                          <p className="text-xs text-muted-foreground">Qté: {item.quantity}</p>
                        </div>
                        <div className="text-sm font-medium tabular-nums shrink-0">
                          {item.total_price ? fmtCurrency(item.total_price) : item.unit_price ? fmtCurrency(item.unit_price * item.quantity) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Financial summary */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{detail.total_amount ? fmtCurrency(detail.total_amount) : '—'}</span>
                </div>
                {detail.shipping_fee != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Livraison</span>
                    <span>{fmtCurrency(detail.shipping_fee)}</span>
                  </div>
                )}
                {detail.discount_amount != null && detail.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Remise</span>
                    <span>-{fmtCurrency(detail.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-border pt-1.5 mt-1.5">
                  <span>Total</span>
                  <span>{detail.total_amount ? fmtCurrency(detail.total_amount) : '—'}</span>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>Créée le : {fmtDate(detail.created_at)}</div>
                {detail.delivered_at && <div>Livrée le : {fmtDate(detail.delivered_at)}</div>}
                {detail.cancelled_at && <div>Annulée le : {fmtDate(detail.cancelled_at)}</div>}
              </div>

              {detail.notes && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Notes</p>
                  {detail.notes}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">Commande introuvable</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <OrdersContent />
    </Suspense>
  );
}
