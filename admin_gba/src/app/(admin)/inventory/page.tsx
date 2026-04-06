'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Package } from 'lucide-react';

async function fetchInventory() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, quantity, price, category:categories(name)')
    .order('quantity', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data || []).map((p: any) => ({
    ...p,
    categoryName: Array.isArray(p.category) ? p.category[0]?.name : p.category?.name,
  }));
}

export default function InventoryPage() {
  const [q, setQ] = useState('');
  const invQ = useQuery({ queryKey: ['inventory'], queryFn: fetchInventory });

  const rows = (invQ.data || []).filter((p: { name?: string; sku?: string }) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (p.name || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s);
  });

  const critical = rows.filter((p: { quantity: number | null }) => (p.quantity ?? 0) < 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventaire" subtitle="Stocks produits — seuil critique &lt; 5" />
      <div className="flex gap-3 items-center">
        <Input placeholder="Filtrer nom / SKU…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm h-9 text-sm" />
        <Card className="px-3 py-2 text-xs flex items-center gap-2">
          <Package className="h-4 w-4" />
          Lignes critiques : {critical.length}
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <tr className="border-b">
                <th className="px-3 py-2 text-left">Produit</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Prix</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invQ.isLoading && [...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="p-2">
                    <Skeleton className="h-7 w-full" />
                  </td>
                </tr>
              ))}
              {!invQ.isLoading &&
                rows.map((p: any) => (
                  <tr key={p.id} className={(p.quantity ?? 0) < 5 ? 'bg-amber-500/5' : ''}>
                    <td className="px-3 py-2 max-w-[200px] truncate">{p.name}</td>
                    <td className="px-3 py-2 font-mono">{p.sku || '—'}</td>
                    <td className="px-3 py-2">{p.categoryName || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{p.quantity ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.price ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
