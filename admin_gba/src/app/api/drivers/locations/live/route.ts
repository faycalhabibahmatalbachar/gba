import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { buildLiveMarkers } from '@/app/api/drivers/_lib/live-markers';

export const dynamic = 'force-dynamic';

/** Alias BFF — même payload que GET /api/drivers/live */
export async function GET() {
  const auth = await requireAdminPermission('drivers', 'read');
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { markers, stats } = await buildLiveMarkers(sb);
    return NextResponse.json({ markers, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
