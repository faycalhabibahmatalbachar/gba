import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: behaviors, error: be } = await sb
      .from('user_behavior')
      .select('product_id, action, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(80);

    if (be && be.code === '42P01') {
      return NextResponse.json({ data: { products: [], note: 'Table user_behavior absente' } });
    }
    if (be) throw be;

    const ids = [...new Set((behaviors || []).map((b) => b.product_id).filter(Boolean))] as string[];
    let products: Record<string, unknown>[] = [];
    if (ids.length) {
      const { data: pr } = await sb
        .from('products')
        .select('id, name, price, quantity, image_url, category_id')
        .in('id', ids.slice(0, 24));
      products = pr || [];
    }

    if (!products.length) {
      const { data: trending } = await sb
        .from('products')
        .select('id, name, price, quantity, image_url, category_id')
        .eq('is_active', true)
        .limit(12);
      products = trending || [];
    }

    return NextResponse.json({
      data: {
        products,
        behavior_sample: behaviors?.slice(0, 30) || [],
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
