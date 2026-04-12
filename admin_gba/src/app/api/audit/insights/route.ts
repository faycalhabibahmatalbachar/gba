import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

type Top = { key: string; count: number };

function topN(map: Map<string, number>, n: number): Top[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

/** Agrégations légères pour la page audit (30 j par défaut). */
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
      .select('action_type, entity_type, metadata, user_role')
      .gte('created_at', since)
      .limit(20_000);

    if (error) throw error;

    const byAction = new Map<string, number>();
    const byEntity = new Map<string, number>();
    const byRole = new Map<string, number>();
    const byIp = new Map<string, number>();

    for (const row of data || []) {
      const a = String(row.action_type || 'unknown');
      byAction.set(a, (byAction.get(a) || 0) + 1);
      const e = String(row.entity_type || 'unknown');
      byEntity.set(e, (byEntity.get(e) || 0) + 1);
      const r = String(row.user_role || 'unknown');
      byRole.set(r, (byRole.get(r) || 0) + 1);
      const m = row.metadata as Record<string, unknown> | null;
      const ipRaw = m?.ip ?? m?.ip_address;
      const ip = typeof ipRaw === 'string' ? ipRaw.trim() : '';
      if (ip) byIp.set(ip, (byIp.get(ip) || 0) + 1);
    }

    return NextResponse.json({
      period_days: days,
      top_actions: topN(byAction, 8),
      top_entities: topN(byEntity, 8),
      top_roles: topN(byRole, 8),
      top_ips: topN(byIp, 6),
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
