import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { decodeProductCursor, encodeProductCursor } from '@/app/api/_lib/cursor';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
// Note: pas d'audit sur GET liste (volume) — mutations tracées.

export const dynamic = 'force-dynamic';

const PRODUCT_LIST_SELECT =
  'id,name,slug,sku,description,price,compare_at_price,quantity,category_id,brand,main_image,is_featured,is_active,rating,reviews_count,created_at,listing_status,gallery_urls,admin_metadata,low_stock_threshold,currency,category:categories(id,name,slug)';

const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(24),
  cursor: z.string().optional(),
  search: z.string().optional(),
  category_ids: z.string().optional(),
  listing_status: z.enum(['draft', 'active', 'archived', 'all']).default('all'),
  stock: z.enum(['all', 'in_stock', 'low', 'out']).default('all'),
  price_min: z.coerce.number().optional(),
  price_max: z.coerce.number().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  performance: z.enum(['all', 'bestsellers', 'slow', 'rupture']).default('all'),
});

const createBodySchema = z.object({
  name: z.string().min(1).max(500),
  slug: z.string().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sku: z.string().max(80).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  price: z.number().nonnegative(),
  compare_at_price: z.number().nonnegative().optional().nullable(),
  quantity: z.number().int().nonnegative().default(0),
  category_id: z.string().uuid().optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  main_image: z.string().url().max(2000).optional().nullable(),
  is_featured: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  listing_status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
  gallery_urls: z.array(z.string().url()).optional().default([]),
  admin_metadata: z.record(z.string(), z.unknown()).optional().default({}),
  low_stock_threshold: z.number().int().nonnegative().optional().default(5),
  currency: z.string().max(8).optional().default('XOF'),
});

async function attachOrderStats(
  sb: ReturnType<typeof getServiceSupabase>,
  productIds: string[],
): Promise<Map<string, { order_count: number; revenue_total: number }>> {
  const map = new Map<string, { order_count: number; revenue_total: number }>();
  if (!productIds.length) return map;
  const { data, error } = await sb
    .from('order_items')
    .select('product_id,total_price,order_id')
    .in('product_id', productIds);
  if (error || !data) return map;
  const acc = new Map<string, { orders: Set<string>; revenue: number }>();
  for (const row of data) {
    const pid = row.product_id as string;
    const oid = String(row.order_id);
    const price = Number(row.total_price) || 0;
    const cur = acc.get(pid) || { orders: new Set<string>(), revenue: 0 };
    cur.orders.add(oid);
    cur.revenue += price;
    acc.set(pid, cur);
  }
  for (const [pid, v] of acc) {
    map.set(pid, { order_count: v.orders.size, revenue_total: v.revenue });
  }
  return map;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const sp = new URL(req.url).searchParams;
  const parsed = listQuerySchema.safeParse({
    limit: sp.get('limit') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
    search: sp.get('search') ?? undefined,
    category_ids: sp.get('category_ids') ?? undefined,
    listing_status: sp.get('listing_status') ?? undefined,
    stock: sp.get('stock') ?? undefined,
    price_min: sp.get('price_min') ?? undefined,
    price_max: sp.get('price_max') ?? undefined,
    date_from: sp.get('date_from') ?? undefined,
    date_to: sp.get('date_to') ?? undefined,
    performance: sp.get('performance') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const q = parsed.data;
  const limit = q.limit + 1;

  try {
    let perfFilterIds: string[] | undefined;
    if (q.performance === 'bestsellers') {
      const { data: arr, error: e1 } = await sb.rpc('admin_product_ids_bestsellers', { p_limit: 500 });
      if (!e1 && Array.isArray(arr)) perfFilterIds = arr.map(String);
    } else if (q.performance === 'slow') {
      const { data: arr, error: e2 } = await sb.rpc('admin_product_ids_slow_movers', { p_limit: 500 });
      if (!e2 && Array.isArray(arr)) perfFilterIds = arr.map(String);
    }

    let query = sb
      .from('products')
      .select(PRODUCT_LIST_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);

    if (perfFilterIds !== undefined && perfFilterIds.length === 0) {
      return NextResponse.json({ data: [], nextCursor: null, count: 0 });
    }
    if (perfFilterIds !== undefined && perfFilterIds.length > 0) {
      query = query.in('id', perfFilterIds);
    }

    if (q.performance === 'rupture') query = query.eq('quantity', 0);

    if (q.listing_status !== 'all') {
      query = query.eq('listing_status', q.listing_status);
    }

    if (q.stock === 'out') query = query.eq('quantity', 0);
    else if (q.stock === 'in_stock') query = query.gt('quantity', 0);
    else if (q.stock === 'low') {
      query = query.gt('quantity', 0);
      // qty <= low_stock_threshold : filtre client si colonne absente
    }

    if (q.category_ids) {
      const ids = q.category_ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length) query = query.in('category_id', ids);
    }

    if (q.price_min != null) query = query.gte('price', q.price_min);
    if (q.price_max != null) query = query.lte('price', q.price_max);
    if (q.date_from) query = query.gte('created_at', q.date_from);
    if (q.date_to) query = query.lte('created_at', q.date_to);

    const search = q.search?.trim();
    if (search) {
      const esc = search.replace(/%/g, '\\%');
      query = query.or(`name.ilike.%${esc}%,sku.ilike.%${esc}%,description.ilike.%${esc}%`);
    }

    const cur = decodeProductCursor(q.cursor ?? null);
    if (cur) {
      query = query.or(
        `created_at.lt.${cur.created_at},and(created_at.eq.${cur.created_at},id.lt.${cur.id})`,
      );
    }

    const { data: rows, error, count } = await query;
    if (error) {
      console.error('[products GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let list = (rows || []) as Record<string, unknown>[];
    if (q.stock === 'low') {
      list = list.filter((r) => {
        const qty = Number(r.quantity) || 0;
        const th = Number(r.low_stock_threshold) || 5;
        return qty > 0 && qty <= th;
      });
    }

    const hasMore = list.length > q.limit;
    const pageRows = list.slice(0, q.limit);
    const ids = pageRows.map((r) => String(r.id));
    const stats = await attachOrderStats(sb, ids);

    const normalized = pageRows.map((r) => {
      const cat = r.category as { id: string; name: string; slug: string | null } | null | undefined;
      const st = stats.get(String(r.id));
      return {
        ...r,
        category: Array.isArray(cat) ? cat[0] ?? null : cat ?? null,
        order_count: st?.order_count ?? 0,
        revenue_total: st?.revenue_total ?? 0,
      };
    });

    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last && last.created_at && last.id
        ? encodeProductCursor(String(last.created_at), String(last.id))
        : null;

    return NextResponse.json({
      data: normalized,
      nextCursor,
      count: count ?? normalized.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const { data: dup } = await sb.from('products').select('id').eq('slug', p.slug).maybeSingle();
  if (dup) {
    return NextResponse.json({ error: 'Slug déjà utilisé' }, { status: 409 });
  }

  const isActive = p.listing_status === 'active';

  const insertRow = {
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? null,
    description: p.description ?? null,
    price: p.price,
    compare_at_price: p.compare_at_price ?? null,
    quantity: p.quantity,
    category_id: p.category_id ?? null,
    brand: p.brand ?? null,
    main_image: p.main_image ?? null,
    is_featured: p.is_featured,
    is_active: isActive,
    listing_status: p.listing_status,
    gallery_urls: p.gallery_urls,
    admin_metadata: p.admin_metadata,
    low_stock_threshold: p.low_stock_threshold,
    currency: p.currency,
  };

  try {
    const { data: created, error } = await sb
      .from('products')
      .insert(insertRow)
      .select(
        'id,name,slug,sku,description,price,compare_at_price,quantity,category_id,brand,main_image,is_featured,is_active,rating,reviews_count,created_at,listing_status,gallery_urls,admin_metadata,low_stock_threshold,currency',
      )
      .single();

    if (error) {
      console.error('[products POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'product',
      entityId: created?.id,
      entityName: p.name,
      changes: { after: created as Record<string, unknown> },
      description: 'Création produit',
    });

    return NextResponse.json({ data: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
