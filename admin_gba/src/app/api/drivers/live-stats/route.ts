import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { buildLiveMarkers } from '@/app/api/drivers/_lib/live-markers';

export const dynamic = 'force-dynamic';

/** KPIs agrégés pour la barre live (réutilise la même logique que la carte). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { stats } = await buildLiveMarkers(sb);

    const { count: unassigned } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'processing'])
      .is('driver_id', null);

    return NextResponse.json({
      data: {
        ...stats,
        orders_without_driver: unassigned ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
