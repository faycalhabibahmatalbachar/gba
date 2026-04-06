import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

function pickLatLng(row: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = row.lat ?? row.latitude;
  const lng = row.lng ?? row.longitude;
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { lat: la, lng: ln };
}

async function latestDriverLocationRow(
  sb: ReturnType<typeof getServiceSupabase>,
  driverId: string,
): Promise<Record<string, unknown> | null> {
  for (const timeCol of ['captured_at', 'recorded_at'] as const) {
    const { data, error } = await sb
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .order(timeCol, { ascending: false })
      .limit(1);
    if (!error && data?.[0]) return data[0] as Record<string, unknown>;
  }
  const { data } = await sb.from('driver_locations').select('*').eq('driver_id', driverId).limit(1);
  return (data?.[0] as Record<string, unknown>) ?? null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { orderId } = await ctx.params;
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data: order, error: oe } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (oe) return NextResponse.json({ error: oe.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const o = order as Record<string, unknown>;
  const userId = o.user_id as string | undefined;
  const driverId = o.driver_id as string | undefined;

  let client: Record<string, unknown> | null = null;
  let driverProfile: Record<string, unknown> | null = null;
  if (userId) {
    const { data: p } = await sb.from('profiles').select('id, first_name, last_name, phone, email, avatar_url').eq('id', userId).maybeSingle();
    client = p;
  }
  if (driverId) {
    const { data: p } = await sb.from('profiles').select('id, first_name, last_name, phone, email, avatar_url').eq('id', driverId).maybeSingle();
    driverProfile = p;
  }

  let driverLocation: Record<string, unknown> | null = null;
  if (driverId) {
    const row = await latestDriverLocationRow(sb, driverId);
    if (row) {
      const ll = pickLatLng(row);
      if (ll) {
        driverLocation = {
          ...ll,
          speed: row.speed,
          heading: row.heading,
          battery_level: row.battery_level,
          recorded_at: row.recorded_at ?? row.captured_at,
        };
      }
    }
  }

  let timeline: Record<string, unknown>[] = [];
  const { data: byOrder } = await sb
    .from('delivery_status_history')
    .select('id, status, note, created_at, created_by')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (byOrder?.length) {
    timeline = byOrder as Record<string, unknown>[];
  } else {
    const { data: del } = await sb.from('deliveries').select('id').eq('order_id', orderId).maybeSingle();
    const deliveryId = (del as { id?: string } | null)?.id;
    if (deliveryId) {
      const { data: th } = await sb
        .from('delivery_status_history')
        .select('id, status, note, created_at, created_by')
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: true });
      timeline = (th || []) as Record<string, unknown>[];
    }
  }

  if (!timeline.length) {
    timeline = [
      {
        status: o.status,
        note: 'Statut actuel',
        created_at: o.updated_at ?? o.created_at,
        created_by: null,
      },
    ];
  }

  const orderOut = {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total_amount: o.total_amount,
    delivery_fee: o.delivery_fee,
    shipping_address: o.shipping_address ?? o.delivery_address,
    shipping_city: o.shipping_city ?? o.delivery_city,
    created_at: o.created_at,
    updated_at: o.updated_at,
    user_id: userId,
    driver_id: driverId,
    client,
    driver: driverProfile,
  };

  return NextResponse.json({
    data: {
      order: orderOut,
      driver_location: driverLocation,
      timeline,
    },
  });
}
