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

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    description: z.string().max(5000).nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
    link_url: z.string().url().max(2000).nullable().optional(),
    accent_color: z.string().max(32).nullable().optional(),
    icon_key: z.string().max(64).nullable().optional(),
    image_url: z.string().url().max(2000).nullable().optional(),
  })
  .strict();

const deleteSchema = z.object({
  migrate_to_category_id: z.string().uuid(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('categories', 'update');
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
  const updates = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucun champ' }, { status: 400 });
  }

  try {
    let { data: before, error: e0 } = await sb
      .from('categories')
      .select(CAT_SELECT_WITH_COLOR)
      .eq('id', id)
      .maybeSingle();
    if (e0 && /accent_color/i.test(e0.message || '')) {
      const fallback = await sb.from('categories').select(CAT_SELECT_NO_COLOR).eq('id', id).maybeSingle();
      before = fallback.data ? ({ ...fallback.data, accent_color: null } as typeof before) : before;
      e0 = fallback.error;
    }
    if (e0 && /icon_key/i.test(e0.message || '')) {
      const fallback = await sb.from('categories').select(CAT_SELECT_MIN).eq('id', id).maybeSingle();
      before = fallback.data ? ({ ...fallback.data, accent_color: null, icon_key: null } as typeof before) : before;
      e0 = fallback.error;
    }
    if (e0 || !before) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    const slug = updates.slug as string | undefined;
    if (slug && slug !== before.slug) {
      const { data: dup } = await sb.from('categories').select('id').eq('slug', slug).maybeSingle();
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: 'Slug déjà utilisé' }, { status: 409 });
      }
    }

    let { data: after, error } = await sb
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select(CAT_SELECT_WITH_COLOR)
      .single();
    if (error && /accent_color/i.test(error.message || '')) {
      const { accent_color, ...updatesNoColor } = updates;
      const fallback = await sb
        .from('categories')
        .update(updatesNoColor)
        .eq('id', id)
        .select(CAT_SELECT_NO_COLOR)
        .single();
      after = fallback.data ? ({ ...fallback.data, accent_color: null } as typeof after) : after;
      error = fallback.error;
    }
    if (error && /icon_key/i.test(error.message || '')) {
      const { accent_color, icon_key, ...updatesMin } = updates;
      const fallback = await sb
        .from('categories')
        .update(updatesMin)
        .eq('id', id)
        .select(CAT_SELECT_MIN)
        .single();
      after = fallback.data ? ({ ...fallback.data, accent_color: null, icon_key: null } as typeof after) : after;
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
      actionType: 'update',
      entityType: 'category',
      entityId: id,
      entityName: String(before.name),
      changes: {
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      },
    });

    return NextResponse.json({ data: after });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('categories', 'delete');
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

  let body: unknown = {};
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      body = await req.json();
    }
  } catch {
    body = {};
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'migrate_to_category_id requis (UUID) dans le corps JSON' },
      { status: 400 },
    );
  }
  const { migrate_to_category_id } = parsed.data;

  if (migrate_to_category_id === id) {
    return NextResponse.json({ error: 'Catégorie cible identique' }, { status: 400 });
  }

  try {
    let { data: before, error: e0 } = await sb
      .from('categories')
      .select(CAT_SELECT_WITH_COLOR)
      .eq('id', id)
      .maybeSingle();
    if (e0 && /accent_color/i.test(e0.message || '')) {
      const fallback = await sb.from('categories').select(CAT_SELECT_NO_COLOR).eq('id', id).maybeSingle();
      before = fallback.data ? ({ ...fallback.data, accent_color: null } as typeof before) : before;
      e0 = fallback.error;
    }
    if (e0 && /icon_key/i.test(e0.message || '')) {
      const fallback = await sb.from('categories').select(CAT_SELECT_MIN).eq('id', id).maybeSingle();
      before = fallback.data ? ({ ...fallback.data, accent_color: null, icon_key: null } as typeof before) : before;
      e0 = fallback.error;
    }
    if (e0 || !before) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    const { data: target } = await sb.from('categories').select('id').eq('id', migrate_to_category_id).maybeSingle();
    if (!target) {
      return NextResponse.json({ error: 'Catégorie cible introuvable' }, { status: 404 });
    }

    const { count } = await sb.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id);
    const n = count ?? 0;

    if (n > 0) {
      const { error: e1 } = await sb.from('products').update({ category_id: migrate_to_category_id }).eq('category_id', id);
      if (e1) {
        return NextResponse.json({ error: e1.message }, { status: 500 });
      }
    }

    const { error: e2 } = await sb.from('categories').delete().eq('id', id);
    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'delete',
      entityType: 'category',
      entityId: id,
      entityName: String(before.name),
      changes: { before: before as unknown as Record<string, unknown> },
      description: `${n} produit(s) migrés vers ${migrate_to_category_id}`,
      metadata: { migrated_products: n, migrate_to_category_id },
    });

    return NextResponse.json({ ok: true, migrated_products: n });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
