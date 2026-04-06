import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { buildReportsOverview } from '@/app/api/reports/_lib/build-overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const data = await unstable_cache(
      async () => {
        const sb = getServiceSupabase();
        return buildReportsOverview(sb);
      },
      ['reports-overview-v1'],
      { revalidate: 300 },
    )();
    return NextResponse.json({ data, cache_ttl_sec: 300 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
