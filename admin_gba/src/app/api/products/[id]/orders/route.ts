import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: productId } = await ctx.params;
  if (!z.string().uuid().safeParse(productId).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: lines, error: le } = await sb
      .from('order_items')
      .select('id, quantity, unit_price, total_price, order_id, orders(id, created_at, status, total_amount, total, user_id)')
      .eq('product_id', productId)
      .order('id', { ascending: false })
      .limit(limit);

    if (le) {
      return NextResponse.json({ error: le.message, orders: [] }, { status: 500 });
    }

    const rows = lines || [];
    const userIds = [
      ...new Set(
        rows
          .map((r) => {
            const o = r.orders as { user_id?: string } | { user_id?: string }[] | null;
            const one = Array.isArray(o) ? o[0] : o;
            return one?.user_id;
          })
          .filter((x): x is string => Boolean(x)),
      ),
    ];

    let profileMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await sb
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      for (const p of profs || []) {
        profileMap[String((p as { id: string }).id)] = {
          first_name: (p as { first_name?: string | null }).first_name ?? null,
          last_name: (p as { last_name?: string | null }).last_name ?? null,
        };
      }
    }

    const orders = rows.map((r) => {
      const o = r.orders as
        | {
            id?: string;
            created_at?: string;
            status?: string;
            total_amount?: number;
            total?: number;
            user_id?: string;
          }
        | Array<{
            id?: string;
            created_at?: string;
            status?: string;
            total_amount?: number;
            total?: number;
            user_id?: string;
          }>
        | null;
      const one = Array.isArray(o) ? o[0] : o;
      const uid = one?.user_id;
      const pr = uid ? profileMap[uid] : undefined;
      const customer =
        pr != null ? `${pr.first_name ?? ''} ${pr.last_name ?? ''}`.trim() || null : null;
      return {
        line_id: (r as { id: string }).id,
        order_id: (r as { order_id: string }).order_id,
        quantity: (r as { quantity: number }).quantity,
        amount: Number((r as { total_price?: number }).total_price) || 0,
        created_at: one?.created_at ?? null,
        status: one?.status ?? null,
        order_total: Number(one?.total_amount ?? one?.total) || null,
        customer_name: customer,
      };
    });

    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message), orders: [] }, { status: 500 });
  }
}
