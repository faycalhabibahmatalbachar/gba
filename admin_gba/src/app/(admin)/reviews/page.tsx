'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Star, Trash2 } from 'lucide-react';

async function fetchReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, created_at, user_id, product_id, products:product_id(id, name), profiles:user_id(email, first_name, last_name)',
    )
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) throw error;
  return data || [];
}

function reviewerLabel(row: {
  profiles?: { email?: string | null; first_name?: string | null; last_name?: string | null } | null;
  user_id?: string;
}) {
  const pr = row.profiles;
  const n = [pr?.first_name, pr?.last_name].filter(Boolean).join(' ').trim();
  if (n) return n;
  if (pr?.email) return pr.email;
  return row.user_id ? String(row.user_id).slice(0, 8) + '…' : '—';
}

export default function ReviewsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-reviews'], queryFn: fetchReviews });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success('Avis supprimé');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data || [];

  const byRating = [1, 2, 3, 4, 5].map((r) => ({
    r,
    n: rows.filter((x: { rating: number }) => x.rating === r).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Avis clients" subtitle="Modération — données table reviews" />
      <div className="flex flex-wrap gap-2 text-xs">
        {byRating.map(({ r, n }) => (
          <Card key={r} className="px-3 py-2 flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            {r}★ : {n}
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left text-xs">Date</th>
                <th className="px-3 py-2 text-left text-xs">Utilisateur</th>
                <th className="px-3 py-2 text-left text-xs">Produit</th>
                <th className="px-3 py-2 text-left text-xs">Note</th>
                <th className="px-3 py-2 text-left text-xs">Commentaire</th>
                <th className="px-3 py-2 text-right text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.isLoading && [...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="p-2">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
              {!q.isLoading &&
                rows.map((rev: any) => (
                  <tr key={rev.id}>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{rev.created_at?.slice(0, 16)}</td>
                    <td className="px-3 py-2 text-xs max-w-[160px] truncate" title={reviewerLabel(rev)}>
                      {reviewerLabel(rev)}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[160px] truncate">
                      {rev.product_id ? (
                        <Link
                          href={`/products?product=${rev.product_id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {rev.products?.name || `Produit ${String(rev.product_id).slice(0, 8)}…`}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">{rev.rating}★</td>
                    <td className="px-3 py-2 text-xs max-w-md truncate">{rev.comment || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => delMut.mutate(rev.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
