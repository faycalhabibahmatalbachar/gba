import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const SELECT_ENRICHED = `
  id, status, created_at, updated_at,
  pickup_address, delivery_address,
  pickup_lat, pickup_lng, delivery_lat, delivery_lng,
  estimated_delivery_at, actual_delivery_at,
  distance_km, delivery_fee, driver_earnings, notes,
  order_id, driver_id,
  orders(
    id, total_amount, total, status, currency, user_id,
    profiles!orders_user_id_fkey(first_name, last_name, phone, avatar_url)
  ),
  drivers(
    id, vehicle_type, vehicle_plate, vehicle_color, rating_avg,
    profiles!drivers_user_id_fkey(first_name, last_name, phone, avatar_url)
  )
`;

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const statusFilter = url.searchParams.get('status')?.trim();

  let q = sb.from('deliveries').select(SELECT_ENRICHED, { count: 'exact' }).order('created_at', { ascending: false });
  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  }
  q = q.range(offset, offset + limit - 1);

  const { data: deliveries, count, error } = await q;

  if (error) {
    console.error('[deliveries]', error);
    const { data: simple, error: e2 } = await sb
      .from('deliveries')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (e2) {
      return NextResponse.json({ deliveries: [], total: 0, error: e2.message }, { status: 500 });
    }
    return NextResponse.json({ deliveries: simple ?? [], total: count ?? 0, fallback: true });
  }

  const result = (deliveries ?? []).map((d: Record<string, unknown>) => {
    const orders = unwrap(d.orders as Record<string, unknown> | Record<string, unknown>[] | null);
    const profC = unwrap(orders?.profiles as Record<string, unknown> | Record<string, unknown>[] | null);
    const drivers = unwrap(d.drivers as Record<string, unknown> | Record<string, unknown>[] | null);
    const profD = unwrap(drivers?.profiles as Record<string, unknown> | Record<string, unknown>[] | null);
    const customerName = profC
      ? `${String(profC.first_name ?? '')} ${String(profC.last_name ?? '')}`.trim() || null
      : null;
    const driverName = profD
      ? `${String(profD.first_name ?? '')} ${String(profD.last_name ?? '')}`.trim() || null
      : null;
    return {
      id: d.id,
      status: d.status,
      created_at: d.created_at,
      pickup_address: d.pickup_address,
      delivery_address: d.delivery_address,
      estimated_delivery_at: d.estimated_delivery_at,
      distance_km: d.distance_km,
      delivery_fee: d.delivery_fee,
      notes: d.notes,
      order_id: d.order_id,
      order_total: orders != null ? Number(orders.total ?? orders.total_amount ?? 0) || null : null,
      order_status: orders != null ? String(orders.status ?? '') : null,
      order_currency: orders != null ? String(orders.currency ?? 'XOF') : 'XOF',
      customer_name: customerName,
      customer_phone: profC != null ? (profC.phone as string | null) : null,
      customer_avatar: profC != null ? (profC.avatar_url as string | null) : null,
      driver_id: d.driver_id,
      driver_name: driverName,
      driver_phone: profD != null ? (profD.phone as string | null) : null,
      driver_avatar: profD != null ? (profD.avatar_url as string | null) : null,
      vehicle_type: drivers != null ? (drivers.vehicle_type as string | null) : null,
      vehicle_plate: drivers != null ? (drivers.vehicle_plate as string | null) : null,
      driver_rating: drivers != null ? drivers.rating_avg : null,
    };
  });

  return NextResponse.json({ deliveries: result, total: count ?? result.length });
}
