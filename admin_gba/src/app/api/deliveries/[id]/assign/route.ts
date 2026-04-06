import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  driver_id: z.string().uuid(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { driver_id } = parsed.data;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data: driver, error: de } = await sb
    .from('drivers')
    .select('id, user_id, is_available, is_online')
    .eq('id', driver_id)
    .maybeSingle();

  if (de || !driver) {
    return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 });
  }
  const dr = driver as { user_id?: string | null; is_available?: boolean; is_online?: boolean };
  if (dr.is_available === false) {
    return NextResponse.json({ error: 'Livreur non disponible' }, { status: 409 });
  }
  const driverUserId = dr.user_id;

  const { data: del, error: le } = await sb.from('deliveries').select('id, order_id').eq('id', id).maybeSingle();
  if (le || !del) {
    return NextResponse.json({ error: 'Livraison introuvable' }, { status: 404 });
  }
  const orderId = (del as { order_id: string }).order_id;

  const { error: ue } = await sb
    .from('deliveries')
    .update({ driver_id, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (ue) {
    return NextResponse.json({ error: ue.message }, { status: 500 });
  }

  if (driverUserId) {
    await sb.from('orders').update({ driver_id: driverUserId, updated_at: new Date().toISOString() }).eq('id', orderId);
  }

  const assignRow: Record<string, unknown> = {
    order_id: orderId,
    driver_id,
    status: 'assigned',
    assigned_at: new Date().toISOString(),
    assigned_by: auth.userId,
  };

  const { error: ie } = await sb.from('delivery_assignments').upsert(assignRow, { onConflict: 'order_id' });
  if (ie) {
    console.error('[delivery_assignments]', ie.message);
  }

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'assign',
    entityType: 'delivery',
    entityId: id,
    description: 'Assignation livreur',
    changes: { after: { driver_id, order_id: orderId } },
    metadata: { action: 'assign_driver' },
  });

  return NextResponse.json({ success: true });
}
