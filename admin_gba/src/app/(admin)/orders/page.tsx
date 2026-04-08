'use client';

import { Suspense } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import {
  fetchOrders, fetchOrdersKpis, fetchOrderDetails,
  updateOrderStatus, bulkUpdateOrderStatus,
  type OrderRow, type OrderDetailsRow,
} from '@/lib/services/orders';
import { supabase } from '@/lib/supabase/client';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShoppingCart, DollarSign, Clock, CheckCircle2,
  Search, Filter, Download, ChevronLeft, ChevronRight,
  RefreshCw, User, Phone, MapPin, Package, Truck, Loader2,
  TrendingUp, Printer, UserCheck, AlertTriangle,
  ShoppingBag, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OrderItem } from '@/lib/services/orders';

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

function parseSpecialPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  try {
    const j = JSON.parse(raw) as unknown;
    return typeof j === 'object' && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isSpecialOrder(order: Pick<OrderRow, 'order_number' | 'notes' | 'is_special_mobile'>): boolean {
  if (order.is_special_mobile) return true;
  const n = String(order.notes || '').toLowerCase();
  const num = String(order.order_number || '').toLowerCase();
  return num.startsWith('sp-') || n.includes('special') || n.includes('devis') || n.includes('quote');
}

function exportCSV(orders: OrderRow[]) {
  const header = ['N°Commande', 'Client', 'Téléphone', 'Statut', 'Montant', 'Articles', 'Date'].join(';');
  const rows = orders.map(o => [
    o.order_number || o.id.slice(0, 8),
    o.customer_name || '',
    o.customer_phone || '',
    o.status || '',
    o.total_amount || 0,
    o.item_count ?? o.total_items ?? o.items?.length ?? 0,
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
  const [kind, setKind] = useQueryState('kind', parseAsString.withDefault('all'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [focusOrderId, setFocusOrderId] = useQueryState('focus', parseAsString.withDefault(''));

  // Local state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'timeline' | 'actions'>('details');
  const [bulkStatus, setBulkStatus] = useState('');
  const [availableDrivers, setAvailableDrivers] = useState<{id:string;name:string}[]>([]);
  const [itemsModalOrder, setItemsModalOrder] = useState<OrderRow | null>(null);

  // Load drivers once
  const loadDrivers = useCallback(async () => {
    if (availableDrivers.length > 0) return;
    try {
      const { data } = await import('@/lib/supabase/client').then(m => m.supabase
        .from('profiles').select('id,first_name,last_name').eq('role','driver').limit(100));
      setAvailableDrivers(((data||[]) as any[]).map(d => ({ id: d.id, name: `${d.first_name||''} ${d.last_name||''}`.trim() })));
    } catch {}
  }, [availableDrivers.length]);

  // Queries
  const ordersQuery = useQuery({
    queryKey: ['orders', { search, status, kind, page }],
    queryFn: () =>
      fetchOrders({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        kind: (kind as 'all' | 'special_mobile' | 'standard') || 'all',
      }),
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

  const deliveryHistoryQuery = useQuery({
    queryKey: ['delivery_status_history', drawerOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_status_history')
        .select('id, status, note, created_at, created_by')
        .eq('order_id', drawerOrderId!)
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: drawerTab === 'timeline' && !!drawerOrderId,
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

  useEffect(() => {
    if (!focusOrderId) return;
    const inPage = orders.find((o) => o.id === focusOrderId);
    if (inPage) {
      setDrawerOrderId(inPage.id);
      setDrawerTab('details');
      void setFocusOrderId('');
      return;
    }
    if (!drawerOrderId && /^[0-9a-f-]{36}$/i.test(focusOrderId)) {
      setDrawerOrderId(focusOrderId);
      setDrawerTab('details');
      void setFocusOrderId('');
    }
  }, [focusOrderId, orders, drawerOrderId, setFocusOrderId]);

  function printDeliverySlip() {
    if (!detail) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Bon de livraison #${detail.order_number || detail.id.slice(0,8)}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto}
      h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px}
      .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:13px}
      .total{font-weight:bold;font-size:14px;margin-top:8px}</style></head><body>
      <h1>Bon de livraison GBA</h1>
      <p style="font-size:12px;color:#666">N° ${detail.order_number || detail.id.slice(0,8)} — ${fmtDate(detail.created_at)}</p>
      <h2 style="font-size:14px;margin-top:16px">Client</h2>
      <p style="font-size:13px">${detail.customer_name || '—'}<br>${detail.customer_phone || ''}<br>${[detail.shipping_city, detail.shipping_district].filter(Boolean).join(', ')}</p>
      ${detail.driver_name ? `<h2 style="font-size:14px;margin-top:16px">Livreur</h2><p style="font-size:13px">${detail.driver_name}</p>` : ''}
      <h2 style="font-size:14px;margin-top:16px">Articles</h2>
      ${(detail.order_items || []).map(i => `<div class="row"><span>${i.product_name} × ${i.quantity}</span><span>${i.total_price ? fmtCurrency(i.total_price) : '—'}</span></div>`).join('')}
      <div class="row total"><span>Total</span><span>${detail.total_amount ? fmtCurrency(detail.total_amount) : '—'}</span></div>
      <p style="font-size:11px;color:#999;margin-top:24px">GBA Admin — Imprimé le ${fmtDate(new Date().toISOString())}</p>
      </body></html>`);
    win.document.close();
    win.print();
  }

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
            <Select value={kind} onValueChange={v => { setKind(v && v !== 'all' ? v : null); setPage(1); }}>
              <SelectTrigger className="h-8 w-[210px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les commandes</SelectItem>
                <SelectItem value="special_mobile">Commandes spéciales (mobile)</SelectItem>
                <SelectItem value="standard">Commandes standard</SelectItem>
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
                    {isSpecialOrder(order) ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        spéciale mobile
                      </span>
                    ) : null}
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
                  <td className="px-4 py-3 text-right text-xs hidden md:table-cell" onClick={e => e.stopPropagation()}>
                    {(() => {
                      const items = order.items ?? [];
                      const count = order.item_count ?? order.total_items ?? items.length;
                      return (
                        <button
                          type="button"
                          onClick={() => setItemsModalOrder(order)}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ShoppingBag size={14} className="shrink-0" />
                          <span className="font-medium text-foreground tabular-nums">{count}</span>
                          <span className="text-muted-foreground">
                            article{count !== 1 ? 's' : ''}
                          </span>
                          <Eye size={12} className="shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })()}
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
      <Sheet open={!!drawerOrderId} onOpenChange={open => { if (!open) { setDrawerOrderId(null); setDrawerTab('details'); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm">
                Commande #{detail?.order_number || drawerOrderId?.slice(0, 8)}
              </SheetTitle>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={printDeliverySlip} disabled={!detail}>
                  <Printer className="h-3 w-3 mr-1" />Imprimer
                </Button>
              </div>
            </div>
            {/* Drawer tabs */}
            <div className="flex gap-0 mt-2 border border-border rounded-md overflow-hidden">
              {([['details','Détails'],['timeline','Timeline'],['actions','Actions']] as const).map(([v,l]) => (
                <button key={v} onClick={() => { setDrawerTab(v); if (v==='actions') loadDrivers(); }}
                  className={`flex-1 py-1 text-[11px] font-medium transition-colors ${
                    drawerTab===v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>{l}</button>
              ))}
            </div>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : detail ? (
            <div className="p-4">
              {/* TAB: DETAILS */}
              {drawerTab === 'details' && (
              <div className="space-y-5">
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
              {(() => {
                const payload = parseSpecialPayload(detail.notes) || detail.special_payload || null;
                const special = isSpecialOrder({
                  order_number: detail.order_number,
                  notes: detail.notes ?? null,
                  is_special_mobile: detail.is_special_mobile,
                });
                const quoteStatus = detail.quote_status || (payload?.quote_status as string | undefined) || (payload?.devis_status as string | undefined) || null;
                if (!special && !payload) return null;
                return (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <p className="mb-1 font-medium text-amber-700 dark:text-amber-400">Commande spéciale (mobile)</p>
                    {quoteStatus ? (
                      <p className="text-xs text-muted-foreground mb-2">
                        Statut devis: <span className="font-medium text-foreground">{quoteStatus}</span>
                      </p>
                    ) : null}
                    {payload ? (
                      <pre className="max-h-48 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Les détails spéciaux sont stockés dans les notes.
                      </p>
                    )}
                  </div>
                );
              })()}
              </div>
              )}

              {drawerTab === 'timeline' && (
                <div className="p-4 space-y-3 text-sm">
                  <p className="font-medium text-foreground text-xs uppercase tracking-wide text-muted-foreground">
                    Historique livraison
                  </p>
                  {deliveryHistoryQuery.isLoading && <Skeleton className="h-20 w-full" />}
                  {!deliveryHistoryQuery.isLoading && (deliveryHistoryQuery.data || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aucun historique enregistré pour le moment. Les transitions livraison apparaîtront ici lorsque le flux
                      métier écrira dans <span className="font-mono">delivery_status_history</span> (assignation livreur,
                      changements de statut).
                    </p>
                  )}
                  {(deliveryHistoryQuery.data || []).map((h: { id: string; status: string; note?: string | null; created_at: string }) => (
                    <div key={h.id} className="border-l-2 border-primary/50 pl-3 py-1">
                      <div className="font-medium text-foreground">{h.status}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(h.created_at)}</div>
                      {h.note && <div className="text-xs mt-1 text-muted-foreground">{h.note}</div>}
                    </div>
                  ))}
                </div>
              )}

              {drawerTab === 'actions' && (
                <div className="p-4 space-y-3 text-sm">
                  <p className="text-muted-foreground">Assignation livreur et changement de statut depuis l&apos;onglet Détails ou la liste principale.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">Commande introuvable</div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!itemsModalOrder}
        onOpenChange={(open) => {
          if (!open) setItemsModalOrder(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              Articles de la commande #{itemsModalOrder?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {itemsModalOrder ? (
            (() => {
              const modalItems: OrderItem[] = itemsModalOrder.items ?? [];
              const subtotal = modalItems.reduce((s, i) => s + Number(i.total_price ?? 0), 0);
              const totalOrder = Number(itemsModalOrder.total_amount ?? 0);
              const shipping = Math.max(0, totalOrder - subtotal);
              return (
                <>
                  <div>
                    {modalItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">Aucun article lié.</p>
                    ) : (
                      modalItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                            {item.product_image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.product_image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package size={20} className="text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.product_name}</p>
                            {item.sku ? (
                              <p className="text-xs text-muted-foreground">{item.sku}</p>
                            ) : null}
                            <p className="text-sm">
                              Qté: <strong>{item.quantity}</strong>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold">
                              {item.total_price != null
                                ? `${fmtCurrency(item.total_price)}`
                                : '—'}
                            </p>
                            {item.unit_price != null ? (
                              <p className="text-xs text-muted-foreground">
                                {fmtCurrency(item.unit_price)} × {item.quantity}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col border-t border-border pt-4 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span className="tabular-nums">{fmtCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Livraison (estim.)</span>
                      <span className="tabular-nums">{fmtCurrency(shipping)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {itemsModalOrder.total_amount != null
                          ? fmtCurrency(itemsModalOrder.total_amount)
                          : fmtCurrency(subtotal + shipping)}
                      </span>
                    </div>
                  </DialogFooter>
                </>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>
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
