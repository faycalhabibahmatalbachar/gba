import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

type DayBucket = { day_key: string; total: number; failed: number; success: number };

/** Volume audit par jour sur les N derniers jours (fenêtre glissante). */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30', 10) || 30));

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = new Date(Date.now() - days * 86400000).toISOString();

  try {
    const { data, error } = await sb
      .from('audit_logs')
      .select('created_at, status')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(25_000);

    if (error) throw error;

    const map = new Map<string, DayBucket>();

    for (const row of data || []) {
      const d = new Date(String(row.created_at));
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const cur = map.get(dayKey) || { day_key: dayKey, total: 0, failed: 0, success: 0 };
      cur.total += 1;
      if (row.status === 'failed') cur.failed += 1;
      else cur.success += 1;
      map.set(dayKey, cur);
    }

    const series = [...map.values()].sort((a, b) => a.day_key.localeCompare(b.day_key));

    return NextResponse.json({
      data: { days, series },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
