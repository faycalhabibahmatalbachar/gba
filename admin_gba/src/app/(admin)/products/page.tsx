'use client';

import { Suspense, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import { fetchProducts, deleteProduct, type ProductRow } from '@/lib/services/products';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Search, Package, Trash2, ChevronLeft, ChevronRight,
  LayoutGrid, List, Tag, RefreshCw,
} from 'lucide-react';
import Image from 'next/image';

const PAGE_SIZE = 24;

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' XOF';
}

function ProductCard({ product, onDelete }: { product: ProductRow; onDelete: (p: ProductRow) => void }) {
  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all">
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.main_image ? (
          <Image
            src={product.main_image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <button
          onClick={() => onDelete(product)}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {product.category?.name || 'Sans catégorie'}
          </span>
          <span className="text-xs font-semibold text-primary">
            {product.price ? fmtCurrency(product.price) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {product.sku && (
            <span className="text-[10px] text-muted-foreground font-mono">{product.sku}</span>
          )}
          <span className={`ml-auto text-[10px] font-medium ${(product.quantity ?? 0) <= 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
            Stock: {product.quantity ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProductsContent() {
  const qc = useQueryClient();
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [toDelete, setToDelete] = useState<ProductRow | null>(null);

  const productsQuery = useQuery({
    queryKey: ['products', { search, page }],
    queryFn: () => fetchProducts({ page, pageSize: PAGE_SIZE, search: search || undefined }),
    staleTime: 20_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit supprimé');
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur de suppression'),
  });

  const products = productsQuery.data?.data || [];
  const total = productsQuery.data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Produits"
        subtitle={`${total} produit${total !== 1 ? 's' : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['products'] })}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher nom, SKU..."
            value={search}
            onChange={e => { setSearch(e.target.value || null); setPage(1); }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={`flex h-8 w-8 items-center justify-center transition-colors ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex h-8 w-8 items-center justify-center transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <>
          {productsQuery.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border">
                  <Skeleton className="aspect-square w-full" />
                  <div className="p-3 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState icon={<Package className="h-8 w-8" />} title="Aucun produit" description={search ? 'Aucun résultat pour cette recherche.' : 'Les produits apparaîtront ici.'} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {products.map(p => (
                <ProductCard key={p.id} product={p} onDelete={setToDelete} />
              ))}
            </div>
          )}
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Produit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Catégorie</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Prix</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productsQuery.isLoading && [...Array(8)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-9 w-full" /></td></tr>
                ))}
                {!productsQuery.isLoading && products.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2">
                      <div className="h-9 w-9 rounded-md overflow-hidden bg-muted shrink-0">
                        {p.main_image ? (
                          <Image src={p.main_image} alt={p.name} width={36} height={36} className="h-9 w-9 object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/30" /></div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium truncate max-w-[200px]">{p.name}</div>
                      {p.sku && <div className="text-[11px] text-muted-foreground font-mono">{p.sku}</div>}
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />{p.category?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-xs">
                      {p.price ? fmtCurrency(p.price) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right hidden md:table-cell">
                      <span className={`text-xs font-medium ${(p.quantity ?? 0) <= 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {p.quantity ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setToDelete(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!productsQuery.isLoading && products.length === 0 && (
                  <tr><td colSpan={6}>
                    <EmptyState icon={<Package className="h-8 w-8" />} title="Aucun produit" />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} / {totalPages} — {total} produits</p>
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

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title={`Supprimer "${toDelete?.name}"?`}
        description="Cette action est irréversible. Le produit sera définitivement supprimé."
        confirmLabel="Supprimer"
        loading={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <ProductsContent />
    </Suspense>
  );
}
