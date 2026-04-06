import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  order_id: z.string().uuid(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: driverTableId } = await ctx.params;
  if (!z.string().uuid().safeParse(driverTableId).success) {
    return NextResponse.json({ error: 'ID livreur invalide' }, { status: 400 });
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

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data: driver, error: de } = await sb
      .from('drivers')
      .select('id, user_id, is_active')
      .eq('id', driverTableId)
      .maybeSingle();

    if (de) throw de;
    if (!driver?.user_id) {
      return NextResponse.json({ error: 'Livreur ou compte utilisateur introuvable' }, { status: 404 });
    }

    const userId = driver.user_id as string;

    const { data: order, error: oe } = await sb
      .from('orders')
      .select('id, order_number, driver_id, status')
      .eq('id', parsed.data.order_id)
      .maybeSingle();

    if (oe) throw oe;
    if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

    const { error: ue } = await sb
      .from('orders')
      .update({ driver_id: userId, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.order_id);

    if (ue) throw ue;

    const { error: ae } = await sb.from('delivery_assignments').upsert(
      {
        order_id: parsed.data.order_id,
        driver_id: driverTableId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        assigned_by: auth.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id' },
    );

    if (ae) {
      // table peut ne pas avoir assigned_by — retenter insert minimal
      const { error: ae2 } = await sb.from('delivery_assignments').upsert(
        {
          order_id: parsed.data.order_id,
          driver_id: driverTableId,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' },
      );
      if (ae2) throw ae2;
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'assign',
      entityType: 'order',
      entityId: parsed.data.order_id,
      entityName: (order as { order_number?: string }).order_number,
      changes: {
        before: { driver_id: (order as { driver_id: string | null }).driver_id },
        after: { driver_id: userId, drivers_row_id: driverTableId },
      },
      description: 'Assignation commande → livreur',
    });

    return NextResponse.json({ ok: true, order_id: parsed.data.order_id, driver_user_id: userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
