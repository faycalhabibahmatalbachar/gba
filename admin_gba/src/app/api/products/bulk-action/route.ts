import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['set_listing_status', 'delete_archived']),
  listing_status: z.enum(['draft', 'active', 'archived']).optional(),
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, action, listing_status } = parsed.data;

  if (action === 'set_listing_status' && !listing_status) {
    return NextResponse.json({ error: 'listing_status requis' }, { status: 400 });
  }

  try {
    const role = await fetchActorRole(auth.userId);

    if (action === 'set_listing_status' && listing_status) {
      const isActive = listing_status === 'active';
      const { error } = await sb
        .from('products')
        .update({ listing_status, is_active: isActive })
        .in('id', ids);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await writeAuditLog({
        actorUserId: auth.userId,
        actorEmail: auth.email,
        actorRole: role,
        actionType: 'bulk_update',
        entityType: 'product',
        description: `Statut en masse → ${listing_status}`,
        changes: { after: { ids, listing_status } },
        metadata: { count: ids.length },
      });

      return NextResponse.json({ ok: true, updated: ids.length });
    }

    if (action === 'delete_archived') {
      const { data: rows, error: e0 } = await sb
        .from('products')
        .select('id,listing_status')
        .in('id', ids);
      if (e0) {
        return NextResponse.json({ error: e0.message }, { status: 500 });
      }
      const allowed = (rows || []).filter((r) => r.listing_status === 'archived').map((r) => String(r.id));
      if (!allowed.length) {
        return NextResponse.json({ error: 'Aucun produit archivé dans la sélection' }, { status: 400 });
      }
      const { error } = await sb.from('products').delete().in('id', allowed);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await writeAuditLog({
        actorUserId: auth.userId,
        actorEmail: auth.email,
        actorRole: role,
        actionType: 'bulk_delete',
        entityType: 'product',
        description: 'Suppression produits archivés (hard delete)',
        changes: { before: { ids: allowed } },
        metadata: { count: allowed.length },
      });

      return NextResponse.json({ ok: true, deleted: allowed.length });
    }

    return NextResponse.json({ error: 'Action non supportée' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
