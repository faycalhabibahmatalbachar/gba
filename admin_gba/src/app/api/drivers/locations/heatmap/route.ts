import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const qSchema = z.object({
  hours: z.coerce.number().min(1).max(168).default(24),
});

/**
 * Points agrégés par grille ~0,01° pour leaflet.heat : [lat, lng, intensity]
 */
export async function GET(req: Request) {
  const auth = await requireAdminPermission('drivers', 'read');
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const sp = new URL(req.url).searchParams;
  const parsed = qSchema.safeParse({ hours: sp.get('hours') ?? undefined });
  const hours = parsed.success ? parsed.data.hours : 24;
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  try {
    const { data, error } = await sb
      .from('driver_locations')
      .select('lat, lng')
      .gte('captured_at', since)
      .limit(12_000);

    if (error) throw error;

    const grid = new Map<string, number>();
    for (const row of data || []) {
      const r = row as { lat: number; lng: number };
      const glat = Math.round(Number(r.lat) * 100) / 100;
      const glng = Math.round(Number(r.lng) * 100) / 100;
      const k = `${glat},${glng}`;
      grid.set(k, (grid.get(k) || 0) + 1);
    }

    let max = 1;
    for (const v of grid.values()) if (v > max) max = v;

    const points: [number, number, number][] = [];
    for (const [k, w] of grid) {
      const [la, ln] = k.split(',').map(Number);
      points.push([la, ln, Math.min(w / max, 1)]);
    }

    return NextResponse.json({ data: { points, max_weight: max, hours } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
