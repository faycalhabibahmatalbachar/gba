import { supabase } from '@/lib/supabase/client';

export type ProductRow = {
  id: string;
  name: string;
  sku?: string | null;
  price?: number | null;
  quantity?: number | null;
  main_image?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
};

type ProductQueryRow = Omit<ProductRow, 'category'> & {
  category?: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

export async function fetchProducts(opts: { page: number; pageSize: number; search?: string }) {
  const { page, pageSize, search } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('products')
    .select('id,name,sku,price,quantity,main_image,category:categories(id,name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  }

  const { data, count, error } = await q;
  if (error) throw error;

  const normalized = ((data || []) as ProductQueryRow[]).map((p) => {
    const cat = Array.isArray(p.category) ? (p.category[0] || null) : (p.category ?? null);
    return { ...p, category: cat };
  }) as ProductRow[];

  return {
    data: normalized,
    count: count || 0,
  };
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}
