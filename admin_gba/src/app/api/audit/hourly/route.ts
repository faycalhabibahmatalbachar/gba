import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

type Bucket = { hour_key: string; total: number; failed: number; success: number };

/** Agrégation simple des logs sur N dernières heures (pour graphiques admin). */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const hours = Math.min(168, Math.max(1, parseInt(searchParams.get('hours') || '24', 10) || 24));

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  try {
    const { data, error } = await sb
      .from('audit_logs')
      .select('created_at, status')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(12_000);

    if (error) throw error;

    const map = new Map<string, Bucket>();

    for (const row of data || []) {
      const d = new Date(String(row.created_at));
      if (Number.isNaN(d.getTime())) continue;
      const hourKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;
      const cur = map.get(hourKey) || { hour_key: hourKey, total: 0, failed: 0, success: 0 };
      cur.total += 1;
      if (row.status === 'failed') cur.failed += 1;
      else cur.success += 1;
      map.set(hourKey, cur);
    }

    const series = [...map.values()].sort((a, b) => a.hour_key.localeCompare(b.hour_key));

    return NextResponse.json({
      data: {
        hours,
        series,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
