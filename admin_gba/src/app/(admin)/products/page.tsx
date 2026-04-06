'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { motion, AnimatePresence } from 'framer-motion';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  dataTableSelectColumn,
  PageHeader,
  FilterBar,
  StatusBadge,
  ConfirmModal,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  LayoutGrid,
  List,
  Plus,
  Eye,
  Pencil,
  Copy,
  Archive,
  Trash2,
  Package,
  ChevronDown,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { parseApiJson } from '@/lib/fetch-api-json';
import { ProductWizard, type CategoryOption } from './_components/ProductWizard';
import { ProductDetailDrawer } from './_components/ProductDetailDrawer';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  quantity: number;
  listing_status: string;
  low_stock_threshold?: number;
  main_image: string | null;
  rating: number;
  reviews_count: number;
  category: { id: string; name: string; slug: string | null } | null;
  order_count: number;
  revenue_total: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' XOF';
}

function stockBadge(qty: number, th: number) {
  if (qty <= 0) return { key: 'out_of_stock', label: 'Rupture' };
  if (qty <= th) return { key: 'low_stock', label: 'Stock bas' };
  return { key: 'in_stock', label: 'OK' };
}

function ProductsInner() {
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [productDeepLink, setProductDeepLink] = useQueryState('product', parseAsString.withDefault(''));
  const [view, setView] = useQueryState('v', parseAsStringEnum(['grid', 'table']).withDefault('table'));
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ProductRow[]>([]);
  const [nextCur, setNextCur] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [filters, setFilters] = React.useState({
    listing_status: 'all',
    stock: 'all',
    performance: 'all',
    price_min: '',
    price_max: '',
    date_from: '',
    date_to: '',
    category_ids: [] as string[],
  });
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  React.useEffect(() => {
    const id = productDeepLink?.trim();
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      setDetailId(id);
      setDetailOpen(true);
    }
  }, [productDeepLink]);
  const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);
  const [deleteHardOpen, setDeleteHardOpen] = React.useState(false);

  const fetchPage = React.useCallback(
    async (opts: { reset: boolean; cursorVal: string | null }) => {
      if (opts.reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const sp = new URLSearchParams();
        sp.set('limit', '24');
        if (!opts.reset && opts.cursorVal) sp.set('cursor', opts.cursorVal);
        if (search.trim()) sp.set('search', search.trim());
        if (filters.listing_status !== 'all') sp.set('listing_status', filters.listing_status);
        if (filters.stock !== 'all') sp.set('stock', filters.stock);
        if (filters.performance !== 'all') sp.set('performance', filters.performance);
        if (filters.price_min) sp.set('price_min', filters.price_min);
        if (filters.price_max) sp.set('price_max', filters.price_max);
        if (filters.date_from) sp.set('date_from', filters.date_from);
        if (filters.date_to) sp.set('date_to', filters.date_to);
        if (filters.category_ids.length) sp.set('category_ids', filters.category_ids.join(','));

        const r = await fetch(`/api/products?${sp}`, { credentials: 'include' });
        const j = await parseApiJson<{
          data?: ProductRow[];
          nextCursor?: string | null;
          count?: number;
          error?: string;
        }>(r);
        if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur chargement');
        const data = (j.data || []) as ProductRow[];
        setRows((prev) => (opts.reset ? data : [...prev, ...data]));
        setNextCur(j.nextCursor ?? null);
        setTotal(typeof j.count === 'number' ? j.count : data.length);
        setCursor(j.nextCursor ?? null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, filters],
  );

  React.useEffect(() => {
    setCursor(null);
    void fetchPage({ reset: true, cursorVal: null });
  }, [search, filters.listing_status, filters.stock, filters.performance, filters.price_min, filters.price_max, filters.date_from, filters.date_to, filters.category_ids, fetchPage]);

  React.useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/categories', { credentials: 'include' });
        const j = await parseApiJson<{ data?: { id: string; name: string; parent_id: string | null }[] }>(r);
        if (!r.ok) return;
        const flat = (j.data || []).map((c: { id: string; name: string; parent_id: string | null }) => ({
          id: c.id,
          name: c.name,
          parent_id: c.parent_id,
        }));
        setCategories(flat);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  const bulkStatus = async (listing_status: 'draft' | 'active' | 'archived') => {
    if (!selectedIds.length) return;
    try {
      const r = await fetch('/api/products/bulk-action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, action: 'set_listing_status', listing_status }),
      });
      const j = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success('Statuts mis à jour');
      setRowSelection({});
      setCursor(null);
      void fetchPage({ reset: true, cursorVal: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const bulkHardDelete = async () => {
    if (!selectedIds.length) return;
    try {
      const r = await fetch('/api/products/bulk-action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, action: 'delete_archived' }),
      });
      const j = await parseApiJson<{ error?: string; deleted?: number }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success(`${j.deleted ?? 0} produit(s) supprimé(s)`);
      setRowSelection({});
      setDeleteHardOpen(false);
      setCursor(null);
      void fetchPage({ reset: true, cursorVal: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const duplicate = async (id: string) => {
    try {
      const r = await fetch(`/api/products/${id}/duplicate`, { method: 'POST', credentials: 'include' });
      const j = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success('Produit dupliqué');
      setCursor(null);
      void fetchPage({ reset: true, cursorVal: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const archiveOne = async (id: string) => {
    try {
      const r = await fetch(`/api/products/${id}`, { method: 'DELETE', credentials: 'include' });
      const j = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success('Produit archivé');
      setCursor(null);
      void fetchPage({ reset: true, cursorVal: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const columns = React.useMemo<ColumnDef<ProductRow, unknown>[]>(
    () => [
      dataTableSelectColumn<ProductRow>(),
      {
        id: 'img',
        header: '',
        cell: ({ row }) => (
          <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted">
            {row.original.main_image ? (
              <Image src={row.original.main_image} alt="" fill className="object-cover" sizes="40px" />
            ) : (
              <Package className="h-4 w-4 m-3 text-muted-foreground/40" />
            )}
          </div>
        ),
        enableSorting: false,
      },
      { accessorKey: 'sku', header: 'SKU', cell: (c) => <span className="font-mono text-xs">{String(c.getValue() || '—')}</span> },
      { accessorKey: 'name', header: 'Nom' },
      {
        id: 'cat',
        header: 'Catégorie',
        accessorFn: (r) => r.category?.name ?? '—',
      },
      {
        accessorKey: 'price',
        header: 'Prix',
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-xs">
            {row.original.compare_at_price && row.original.compare_at_price > row.original.price ? (
              <>
                <span className="line-through text-muted-foreground mr-1">{fmt(row.original.compare_at_price)}</span>
                <span>{fmt(row.original.price)}</span>
              </>
            ) : (
              fmt(row.original.price)
            )}
          </div>
        ),
      },
      {
        id: 'promo',
        header: 'Promo',
        cell: ({ row }) =>
          row.original.compare_at_price && row.original.compare_at_price > row.original.price ? (
            <span className="text-xs text-emerald-600">Oui</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'stock',
        header: 'Stock',
        cell: ({ row }) => {
          const th = row.original.low_stock_threshold ?? 5;
          const b = stockBadge(row.original.quantity, th);
          return <StatusBadge status={b.key} customLabel={b.label} size="sm" />;
        },
      },
      {
        accessorKey: 'rating',
        header: '★',
        cell: (c) => <span className="tabular-nums text-xs">{Number(c.getValue()).toFixed(1)}</span>,
      },
      {
        accessorKey: 'order_count',
        header: 'Cmd',
        cell: (c) => <span className="tabular-nums text-xs">{Number(c.getValue())}</span>,
      },
      {
        accessorKey: 'revenue_total',
        header: 'CA',
        cell: (c) => <span className="tabular-nums text-xs">{fmt(Number(c.getValue()))}</span>,
      },
      {
        accessorKey: 'listing_status',
        header: 'Statut',
        cell: (c) => <StatusBadge status={String(c.getValue())} size="sm" />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-1 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8"
              onClick={() => {
                setDetailId(row.original.id);
                setDetailOpen(true);
                void setProductDeepLink(row.original.id);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8"
              onClick={() => {
                setEditId(row.original.id);
                setWizardOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8" onClick={() => void duplicate(row.original.id)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 text-destructive" onClick={() => void archiveOne(row.original.id)}>
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const chips = React.useMemo(() => {
    const c: { id: string; label: string }[] = [];
    if (filters.listing_status !== 'all') c.push({ id: 'st', label: `Statut: ${filters.listing_status}` });
    if (filters.stock !== 'all') c.push({ id: 'sk', label: `Stock: ${filters.stock}` });
    if (filters.performance !== 'all') c.push({ id: 'pf', label: `Perf: ${filters.performance}` });
    return c;
  }, [filters]);

  const advanced = (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label>Statut liste</Label>
        <Select
          value={filters.listing_status}
          onValueChange={(v) => setFilters((f) => ({ ...f, listing_status: v ?? 'all' }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="archived">Archivé</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Stock</Label>
        <Select value={filters.stock} onValueChange={(v) => setFilters((f) => ({ ...f, stock: v ?? 'all' }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="low">Stock bas</SelectItem>
            <SelectItem value="out">Rupture</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Performance</Label>
        <Select
          value={filters.performance}
          onValueChange={(v) => setFilters((f) => ({ ...f, performance: v ?? 'all' }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="bestsellers">Bestsellers</SelectItem>
            <SelectItem value="slow">Slow movers</SelectItem>
            <SelectItem value="rupture">Rupture</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Prix min</Label>
          <Input value={filters.price_min} onChange={(e) => setFilters((f) => ({ ...f, price_min: e.target.value }))} type="number" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Prix max</Label>
          <Input value={filters.price_max} onChange={(e) => setFilters((f) => ({ ...f, price_max: e.target.value }))} type="number" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Créé après</Label>
          <Input type="date" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Créé avant</Label>
          <Input type="date" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Catégories (multi)</Label>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-border rounded-md p-2">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={filters.category_ids.includes(c.id)}
                onChange={() =>
                  setFilters((f) => ({
                    ...f,
                    category_ids: f.category_ids.includes(c.id)
                      ? f.category_ids.filter((x) => x !== c.id)
                      : [...f.category_ids, c.id],
                  }))
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Produits"
        subtitle={`${total} référence(s) — centre de gestion`}
        actions={
          <>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button
                type="button"
                variant={view === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-9"
                onClick={() => void setView('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={view === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-9"
                onClick={() => void setView('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditId(null);
                setWizardOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nouveau
            </Button>
          </>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={(v) => void setSearch(v || null)}
        searchPlaceholder="Nom, SKU, description…"
        chips={chips}
        onRemoveChip={(id) => {
          if (id === 'st') setFilters((f) => ({ ...f, listing_status: 'all' }));
          if (id === 'sk') setFilters((f) => ({ ...f, stock: 'all' }));
          if (id === 'pf') setFilters((f) => ({ ...f, performance: 'all' }));
        }}
        onClearChips={() =>
          setFilters((f) => ({ ...f, listing_status: 'all', stock: 'all', performance: 'all' }))
        }
        advancedFilters={advanced}
      />

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.length} sélectionné(s)</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void bulkStatus('active')}>
            Activer
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void bulkStatus('draft')}>
            Brouillon
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void bulkStatus('archived')}>
            Archiver
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setBulkArchiveOpen(true)}>
            Archiver (confirm)
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteHardOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Supprimer archivés
          </Button>
        </div>
      )}

      <ConfirmModal
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title="Archiver la sélection ?"
        description="Les produits passent en statut archivé (soft)."
        onConfirm={() => {
          void bulkStatus('archived');
          setBulkArchiveOpen(false);
        }}
      />

      <ConfirmModal
        open={deleteHardOpen}
        onOpenChange={setDeleteHardOpen}
        title="Suppression définitive"
        description="Seuls les produits déjà archivés dans la sélection seront supprimés."
        confirmationPhrase="SUPPRIMER"
        onConfirm={() => void bulkHardDelete()}
      />

      {view === 'table' ? (
        <DataTable
          columns={columns}
          data={rows}
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          isLoading={loading && rows.length === 0}
          exportFilename="produits.csv"
          emptyTitle="Aucun produit"
          emptyDescription="Créez un produit ou élargissez les filtres."
          emptyAction={
            <Button type="button" size="sm" onClick={() => setWizardOpen(true)}>
              Créer un produit
            </Button>
          }
          cursorFooter={
            nextCur ? (
              <div className="p-3 border-t border-border flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore || !nextCur}
                  onClick={() => void fetchPage({ reset: false, cursorVal: cursor })}
                >
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Charger la suite
                </Button>
              </div>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          {loading && rows.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-16 border border-dashed rounded-xl">
              <Package className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucun produit</p>
              <Button type="button" className="mt-4" size="sm" onClick={() => setWizardOpen(true)}>
                Créer
              </Button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {rows.map((p, i) => {
                  const th = p.low_stock_threshold ?? 5;
                  const st = stockBadge(p.quantity, th);
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="group relative bg-card border border-border rounded-xl overflow-hidden"
                    >
                      <div className="aspect-square bg-muted relative">
                        {p.main_image ? (
                          <Image src={p.main_image} alt={p.name} fill className="object-cover" sizes="200px" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onClick={() => {
                              setDetailId(p.id);
                              setDetailOpen(true);
                              void setProductDeepLink(p.id);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Voir
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => { setEditId(p.id); setWizardOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => void duplicate(p.id)}>
                            <Copy className="h-3.5 w-3.5 mr-1" /> Dupliquer
                          </Button>
                          <Button type="button" size="sm" variant="destructive" className="h-8" onClick={() => void archiveOne(p.id)}>
                            <Archive className="h-3.5 w-3.5 mr-1" /> Archiver
                          </Button>
                        </div>
                      </div>
                      <div className="p-2.5 space-y-1">
                        <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                        <div className="flex items-center justify-between gap-2">
                          {p.compare_at_price && p.compare_at_price > p.price ? (
                            <span className="text-xs">
                              <span className="line-through text-muted-foreground mr-1">{fmt(p.compare_at_price)}</span>
                              <span className="font-semibold text-[var(--brand)]">{fmt(p.price)}</span>
                            </span>
                          ) : (
                            <span className="text-xs font-semibold">{fmt(p.price)}</span>
                          )}
                          <StatusBadge status={st.key} customLabel={st.label} size="sm" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>★ {Number(p.rating).toFixed(1)}</span>
                          <span>{p.order_count} cmd</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
          {nextCur && view === 'grid' ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore || !nextCur}
                onClick={() => void fetchPage({ reset: false, cursorVal: cursor })}
              >
                Charger plus
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ProductWizard
        open={wizardOpen}
        onOpenChange={(o) => {
          setWizardOpen(o);
          if (!o) setEditId(null);
        }}
        categories={categories}
        editingId={editId}
        onComplete={() => {
          setCursor(null);
          void fetchPage({ reset: true, cursorVal: null });
        }}
      />

      <ProductDetailDrawer
        productId={detailId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) void setProductDeepLink(null);
        }}
        onUpdated={() => {
          setCursor(null);
          void fetchPage({ reset: true, cursorVal: null });
        }}
      />
    </motion.div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <ProductsInner />
    </Suspense>
  );
}
