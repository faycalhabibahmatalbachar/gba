import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const PRODUCT_DETAIL_SELECT =
  'id,name,slug,sku,description,price,compare_at_price,quantity,category_id,brand,main_image,is_featured,is_active,rating,reviews_count,created_at,listing_status,gallery_urls,admin_metadata,low_stock_threshold,currency,category:categories(id,name,slug,parent_id)';
// low_stock_threshold + currency require migration 20260403180000

const patchSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    slug: z
      .string()
      .min(1)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    sku: z.string().max(80).nullable().optional(),
    description: z.string().max(20000).nullable().optional(),
    price: z.number().nonnegative().optional(),
    compare_at_price: z.number().nonnegative().nullable().optional(),
    quantity: z.number().int().nonnegative().optional(),
    category_id: z.string().uuid().nullable().optional(),
    brand: z.string().max(120).nullable().optional(),
    main_image: z.string().url().max(2000).nullable().optional(),
    is_featured: z.boolean().optional(),
    is_active: z.boolean().optional(),
    listing_status: z.enum(['draft', 'active', 'archived']).optional(),
    gallery_urls: z.array(z.string().url()).optional(),
    admin_metadata: z.record(z.string(), z.unknown()).optional(),
    low_stock_threshold: z.number().int().nonnegative().optional(),
    currency: z.string().max(8).optional(),
  })
  .strict();

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

function unwrapOrder(
  row: { orders?: { created_at?: string; status?: string; id?: string } | { created_at?: string; status?: string; id?: string }[] | null },
): { created_at?: string; status?: string; id?: string } | null {
  const o = row.orders;
  if (o == null) return null;
  if (Array.isArray(o)) return o[0] ?? null;
  return o;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const productSelect = `
      id, name, slug, description, sku, price, compare_at_price,
      promo_price, promo_starts_at, promo_ends_at,
      quantity, stock_quantity, stock_alert_threshold, status, is_featured, is_active, listing_status,
      main_image, gallery_urls, images, tags, custom_fields, weight_g, dimensions,
      rating, reviews_count, view_count, return_rate, conversion_rate, last_sold_at,
      created_at, updated_at, category_id, currency, low_stock_threshold,
      category:categories(id, name, slug, parent_id)
    `;

    let baseProduct: Record<string, unknown> | null = null;
    const rpcTry = await sb.rpc('get_product_detail', { p_id: id });
    if (!rpcTry.error && rpcTry.data != null && typeof rpcTry.data === 'object' && !Array.isArray(rpcTry.data)) {
      baseProduct = rpcTry.data as Record<string, unknown>;
    }

    const { data: pFull, error: pe } = await sb.from('products').select(productSelect).eq('id', id).maybeSingle();
    if (pe) {
      const { data: p2, error: pe2 } = await sb.from('products').select(PRODUCT_DETAIL_SELECT).eq('id', id).maybeSingle();
      if (pe2 || !p2) {
        return NextResponse.json({ error: pe.message || pe2?.message || 'Introuvable' }, { status: pe2 ? 500 : 404 });
      }
      baseProduct = { ...(baseProduct || {}), ...(p2 as unknown as Record<string, unknown>) };
    } else if (pFull) {
      baseProduct = { ...(baseProduct || {}), ...(pFull as unknown as Record<string, unknown>) };
    } else if (!baseProduct) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [linesRes, salesLinesRes, reviewsRes, favRes] = await Promise.all([
      sb
        .from('order_items')
        .select('id, quantity, total_price, order_id, orders(created_at, status, id)')
        .eq('product_id', id)
        .limit(8000),
      sb
        .from('order_items')
        .select('quantity, total_price, orders(created_at, status)')
        .eq('product_id', id)
        .limit(5000),
      sb
        .from('reviews')
        .select(
          `id, rating, title, body, comment, moderation_status, admin_response, created_at, user_id,
           profiles!reviews_user_id_fkey(first_name, last_name, avatar_url)`,
        )
        .eq('product_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      sb.from('favorites').select('id', { count: 'exact', head: true }).eq('product_id', id),
    ]);

    let reviewsData: unknown[] | null = reviewsRes.data as unknown[] | null;
    if (reviewsRes.error) {
      const retry = await sb
        .from('reviews')
        .select('id, rating, title, body, comment, moderation_status, admin_response, created_at, user_id')
        .eq('product_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      reviewsData = retry.data as unknown[] | null;
    }

    const lines = linesRes.data || [];
    const validLines = lines.filter((oi) => {
      const o = unwrapOrder(oi as Parameters<typeof unwrapOrder>[0]);
      const st = String(o?.status || '').toLowerCase();
      return st !== 'cancelled' && st !== 'refunded';
    });

    const totalRevenue = validLines.reduce((s, oi) => s + (Number((oi as { total_price?: number }).total_price) || 0), 0);
    const totalUnitsSold = validLines.reduce((s, oi) => s + (Number((oi as { quantity?: number }).quantity) || 0), 0);
    const orderIds = new Set<string>();
    let lastSold: string | null = null;
    for (const oi of validLines) {
      const oid = String((oi as { order_id?: string }).order_id || '');
      if (oid) orderIds.add(oid);
      const o = unwrapOrder(oi as Parameters<typeof unwrapOrder>[0]);
      const c = o?.created_at;
      if (c && (!lastSold || c > lastSold)) lastSold = c;
    }
    const totalOrders = orderIds.size;
    const wishlistCount = favRes.error ? 0 : typeof favRes.count === 'number' ? favRes.count : 0;
    const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const salesRows = (salesLinesRes.data || []) as {
      quantity?: number;
      total_price?: number;
      orders?: { created_at?: string; status?: string } | { created_at?: string; status?: string }[] | null;
    }[];
    const salesFiltered = salesRows.filter((oi) => {
      const o = unwrapOrder(oi);
      const st = String(o?.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'refunded') return false;
      const c = o?.created_at;
      return c != null && c >= thirtyAgo;
    });

    const byDate = new Map<string, { revenue: number; units: number }>();
    for (const oi of salesFiltered) {
      const o = unwrapOrder(oi);
      const day = o?.created_at?.slice(0, 10);
      if (!day) continue;
      const cur = byDate.get(day) || { revenue: 0, units: 0 };
      cur.revenue += Number(oi.total_price) || 0;
      cur.units += Number(oi.quantity) || 0;
      byDate.set(day, cur);
    }

    const chartDays = lastNDates(30);
    const chartData = chartDays.map((date) => {
      const b = byDate.get(date);
      return { date, revenue: b?.revenue ?? 0, units: b?.units ?? 0 };
    });

    const reviews = (reviewsData || []).map((r) => {
      const row = r as {
        id: string;
        rating: number;
        title?: string | null;
        body?: string | null;
        comment?: string | null;
        moderation_status?: string | null;
        admin_response?: string | null;
        created_at: string;
        profiles?: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null } | null;
      };
      return {
        ...row,
        body: row.body ?? row.comment ?? null,
        profiles: row.profiles ?? null,
      };
    });

    const stockQty = Number(baseProduct.stock_quantity ?? baseProduct.quantity ?? 0);
    const product = {
      ...baseProduct,
      stock_quantity: stockQty,
      totalRevenue,
      totalUnitsSold,
      totalOrders,
      wishlistCount,
      avgBasket,
      last_sold_at: (baseProduct.last_sold_at as string | null | undefined) ?? lastSold,
    };

    return NextResponse.json({
      product,
      chartData,
      reviews,
      data: product,
      meta: {
        linesError: linesRes.error?.message,
        salesError: salesLinesRes.error?.message,
        reviewsError: reviewsRes.error?.message,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ' }, { status: 400 });
  }

  try {
    const { data: before, error: e0 } = await sb
      .from('products')
      .select(PRODUCT_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (e0 || !before) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    if (patch.slug && patch.slug !== before.slug) {
      const { data: dup } = await sb.from('products').select('id').eq('slug', patch.slug).maybeSingle();
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: 'Slug déjà utilisé' }, { status: 409 });
      }
    }

    const updates: Record<string, unknown> = { ...patch };
    if (patch.listing_status === 'active') updates.is_active = true;
    if (patch.listing_status === 'draft' || patch.listing_status === 'archived') {
      updates.is_active = false;
    }

    const { data: after, error } = await sb
      .from('products')
      .update(updates)
      .eq('id', id)
      .select(PRODUCT_DETAIL_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'update',
      entityType: 'product',
      entityId: id,
      entityName: String(before.name),
      changes: {
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      },
      description: 'Mise à jour produit',
    });

    return NextResponse.json({ data: after });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data: before, error: e0 } = await sb
      .from('products')
      .select('id,name,slug,listing_status,is_active')
      .eq('id', id)
      .maybeSingle();
    if (e0 || !before) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    const { data: after, error } = await sb
      .from('products')
      .update({ listing_status: 'archived', is_active: false })
      .eq('id', id)
      .select('id,name,slug,listing_status,is_active')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'status_change',
      entityType: 'product',
      entityId: id,
      entityName: String(before.name),
      changes: {
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      },
      description: 'Archivage produit (soft)',
    });

    return NextResponse.json({ data: after });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
