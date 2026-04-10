import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const CAT_SELECT_WITH_COLOR =
  'id,name,slug,description,parent_id,sort_order,is_active,link_url,accent_color,icon_key,image_url';
const CAT_SELECT_NO_COLOR =
  'id,name,slug,description,parent_id,sort_order,is_active,link_url,icon_key,image_url';
const CAT_SELECT_MIN =
  'id,name,slug,description,parent_id,sort_order,is_active,link_url,image_url';

const postSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(5000).optional().nullable(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional().default(0),
  is_active: z.boolean().optional().default(true),
  link_url: z.string().url().max(2000).nullable().optional(),
  accent_color: z.string().max(32).nullable().optional(),
  icon_key: z.string().max(64).nullable().optional(),
  image_url: z.string().url().max(2000).nullable().optional(),
});

async function attachCategoryStats(sb: ReturnType<typeof getServiceSupabase>) {
  const { data: products } = await sb
    .from('products')
    .select('id,category_id,price,quantity')
    .not('category_id', 'is', null);

  const { data: lines } = await sb
    .from('order_items')
    .select('total_price,product_id')
    .limit(50_000);

  const revenueByProduct = new Map<string, number>();
  for (const row of lines || []) {
    const pid = String(row.product_id);
    revenueByProduct.set(pid, (revenueByProduct.get(pid) || 0) + (Number(row.total_price) || 0));
  }

  const byCat: Record<string, { product_count: number; revenue_total: number; orders_proxy: number }> = {};

  for (const p of products || []) {
    const cid = p.category_id as string | null;
    if (!cid) continue;
    if (!byCat[cid]) byCat[cid] = { product_count: 0, revenue_total: 0, orders_proxy: 0 };
    byCat[cid].product_count += 1;
    byCat[cid].revenue_total += revenueByProduct.get(String(p.id)) || 0;
  }

  return byCat;
}

export async function GET() {
  const auth = await requireAdminPermission('categories', 'read');
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    let { data: rows, error } = await sb
      .from('categories')
      .select(CAT_SELECT_WITH_COLOR)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error && /accent_color/i.test(error.message || '')) {
      const fallback = await sb
        .from('categories')
        .select(CAT_SELECT_NO_COLOR)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      rows = (fallback.data || []).map((r) => ({ ...r, accent_color: null }));
      error = fallback.error;
    }
    if (error && /icon_key/i.test(error.message || '')) {
      const fallback = await sb
        .from('categories')
        .select(CAT_SELECT_MIN)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      rows = (fallback.data || []).map((r) => ({ ...r, accent_color: null, icon_key: null }));
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats = await attachCategoryStats(sb);
    const enriched = (rows || []).map((c) => {
      const s = stats[c.id] || { product_count: 0, revenue_total: 0, orders_proxy: 0 };
      const conversion_rate =
        s.product_count > 0 ? Math.min(100, Math.round((s.revenue_total > 0 ? 1 : 0) * 100)) : 0;
      return {
        ...c,
        product_count: s.product_count,
        revenue_total: s.revenue_total,
        conversion_rate,
      };
    });

    return NextResponse.json({ data: enriched, categories: enriched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminPermission('categories', 'create');
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

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const { data: dup } = await sb.from('categories').select('id').eq('slug', p.slug).maybeSingle();
  if (dup) {
    return NextResponse.json({ error: 'Slug déjà utilisé' }, { status: 409 });
  }

  try {
    let { data: created, error } = await sb
      .from('categories')
      .insert({
        name: p.name,
        slug: p.slug,
        description: p.description ?? null,
        parent_id: p.parent_id ?? null,
        sort_order: p.sort_order,
        is_active: p.is_active,
        link_url: p.link_url ?? null,
        accent_color: p.accent_color ?? null,
        icon_key: p.icon_key ?? null,
        image_url: p.image_url ?? null,
      })
      .select(CAT_SELECT_WITH_COLOR)
      .single();
    if (error && /accent_color/i.test(error.message || '')) {
      const payloadNoColor = {
        name: p.name,
        slug: p.slug,
        description: p.description ?? null,
        parent_id: p.parent_id ?? null,
        sort_order: p.sort_order,
        is_active: p.is_active,
        link_url: p.link_url ?? null,
        icon_key: p.icon_key ?? null,
        image_url: p.image_url ?? null,
      };
      const fallback = await sb.from('categories').insert(payloadNoColor).select(CAT_SELECT_NO_COLOR).single();
      created = fallback.data ? ({ ...fallback.data, accent_color: null } as typeof created) : created;
      error = fallback.error;
    }
    if (error && /icon_key/i.test(error.message || '')) {
      const payloadMin = {
        name: p.name,
        slug: p.slug,
        description: p.description ?? null,
        parent_id: p.parent_id ?? null,
        sort_order: p.sort_order,
        is_active: p.is_active,
        link_url: p.link_url ?? null,
        image_url: p.image_url ?? null,
      };
      const fallback = await sb.from('categories').insert(payloadMin).select(CAT_SELECT_MIN).single();
      created = fallback.data ? ({ ...fallback.data, accent_color: null, icon_key: null } as typeof created) : created;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'category',
      entityId: created?.id,
      entityName: p.name,
      changes: { after: created as Record<string, unknown> },
    });

    return NextResponse.json({ data: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
