import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const SELECT_FULL =
  'id,name,slug,sku,description,price,compare_at_price,quantity,category_id,brand,main_image,is_featured,is_active,rating,reviews_count,created_at,listing_status,gallery_urls,admin_metadata,low_stock_threshold,currency';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const { data: src, error: e0 } = await sb.from('products').select(SELECT_FULL).eq('id', id).maybeSingle();
    if (e0 || !src) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    const baseSlug = `${src.slug}-copie`;
    let slug = baseSlug;
    let n = 2;
    while (true) {
      const { data: ex } = await sb.from('products').select('id').eq('slug', slug).maybeSingle();
      if (!ex) break;
      slug = `${baseSlug}-${n}`;
      n += 1;
    }

    const skuBase = src.sku ? `${src.sku}-COPY` : `SKU-${slug.slice(0, 12)}`;
    let sku = skuBase;
    n = 2;
    while (true) {
      const { data: ex } = await sb.from('products').select('id').eq('sku', sku).maybeSingle();
      if (!ex) break;
      sku = `${skuBase}-${n}`;
      n += 1;
    }

    const insert = {
      name: `${src.name} (copie)`,
      slug,
      sku,
      description: src.description,
      price: src.price,
      compare_at_price: src.compare_at_price,
      quantity: src.quantity,
      category_id: src.category_id,
      brand: src.brand,
      main_image: src.main_image,
      is_featured: false,
      is_active: false,
      listing_status: 'draft' as const,
      gallery_urls: Array.isArray(src.gallery_urls) ? [...src.gallery_urls] : [],
      admin_metadata: src.admin_metadata ?? {},
      low_stock_threshold: src.low_stock_threshold ?? 5,
      currency: src.currency ?? 'XOF',
    };

    const { data: created, error } = await sb.from('products').insert(insert).select(SELECT_FULL).single();
    if (error) {
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
      entityName: String(created?.name),
      changes: { after: created as Record<string, unknown> },
      description: `Duplication depuis ${id}`,
      metadata: { source_product_id: id },
    });

    return NextResponse.json({ data: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
