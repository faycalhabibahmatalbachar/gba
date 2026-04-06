import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** Historique GPS pour un livreur (driver_id = auth.users.id). */
export async function GET(req: Request, ctx: { params: Promise<{ driverId: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { driverId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(driverId)) {
    return NextResponse.json({ error: 'driverId invalide' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from')?.trim();
  const to = searchParams.get('to')?.trim();
  if (!from || !to) {
    return NextResponse.json({ error: 'from et to (ISO) requis' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data, error } = await sb
      .from('driver_locations')
      .select('id, lat, lng, recorded_at, captured_at, created_at, speed_mps, heading, order_id')
      .eq('driver_id', driverId)
      .gte('captured_at', from)
      .lte('captured_at', to)
      .order('captured_at', { ascending: true })
      .limit(5000);

    if (error) throw error;

    const points = (data || []).map((row: Record<string, unknown>) => ({
      lat: Number(row.lat),
      lng: Number(row.lng),
      t: String(row.recorded_at || row.captured_at || row.created_at),
      speed_mps: row.speed_mps != null ? Number(row.speed_mps) : null,
      heading: row.heading != null ? Number(row.heading) : null,
      order_id: row.order_id as string | null,
    }));

    return NextResponse.json({ data: { points } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
