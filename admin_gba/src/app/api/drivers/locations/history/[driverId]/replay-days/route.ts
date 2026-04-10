import { NextResponse } from 'next/server';
import { format, startOfDay } from 'date-fns';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** Jours calendaires ayant au moins un point GPS (pour surlignage replay). */
export async function GET(req: Request, ctx: { params: Promise<{ driverId: string }> }) {
  const auth = await requireAdminPermission('drivers', 'read');
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
      .select('captured_at, created_at')
      .eq('driver_id', driverId)
      .gte('captured_at', from)
      .lte('captured_at', to)
      .order('captured_at', { ascending: true })
      .limit(25_000);

    if (error) throw error;

    const days = new Set<string>();
    for (const row of data || []) {
      const t = (row as { captured_at?: string; created_at?: string }).captured_at || (row as { created_at?: string }).created_at;
      if (t) days.add(format(startOfDay(new Date(t)), 'yyyy-MM-dd'));
    }

    return NextResponse.json({ data: { dates: [...days].sort() } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
