import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

type KpiRow = {
  total_events: number;
  distinct_actors: number;
  failed_count: number;
  success_or_partial: number;
  distinct_role_values: number;
};

type RoleRow = { role_label: string; event_count: number };

/** GET /api/audit/stats?from=ISO&to=ISO — fenêtre par défaut : 90 derniers jours */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const toParam = searchParams.get('to')?.trim();
  const fromParam = searchParams.get('from')?.trim();

  const toD = toParam ? new Date(toParam) : new Date();
  const fromD = fromParam
    ? new Date(fromParam)
    : new Date(toD.getTime() - 90 * 86400000);

  const pFrom = fromD.toISOString();
  const pTo = toD.toISOString();

  const spanMs = toD.getTime() - fromD.getTime();
  const prevTo = new Date(fromD.getTime());
  const prevFrom = new Date(fromD.getTime() - spanMs);

  try {
    let kpiData: unknown;
    let prevData: unknown;
    let roleData: unknown;
    let kpiErr: { message: string } | null = null;

    const r1 = await sb.rpc('audit_page_kpis', { p_from: pFrom, p_to: pTo });
    kpiData = r1.data;
    if (r1.error) kpiErr = r1.error;

    const r2 = await sb.rpc('audit_page_kpis', {
      p_from: prevFrom.toISOString(),
      p_to: prevTo.toISOString(),
    });
    prevData = r2.data;
    if (r2.error) kpiErr = r2.error;

    const r3 = await sb.rpc('audit_role_breakdown', { p_from: pFrom, p_to: pTo });
    roleData = r3.data;
    if (r3.error) kpiErr = r3.error;

    if (kpiErr) {
      console.warn('[audit/stats] RPC indisponible, fallback counts:', kpiErr.message);
    }

    let row = (Array.isArray(kpiData) ? kpiData[0] : kpiData) as KpiRow | undefined;
    let prevRow = (Array.isArray(prevData) ? prevData[0] : prevData) as KpiRow | undefined;

    if (kpiErr || !row) {
      const { count: totalC } = await sb
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', pFrom)
        .lte('created_at', pTo);
      const { count: failC } = await sb
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', pFrom)
        .lte('created_at', pTo)
        .eq('status', 'failed');
      row = {
        total_events: totalC ?? 0,
        distinct_actors: 0,
        failed_count: failC ?? 0,
        success_or_partial: Math.max(0, (totalC ?? 0) - (failC ?? 0)),
        distinct_role_values: 0,
      };
      const { count: prevTotalC } = await sb
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', prevFrom.toISOString())
        .lte('created_at', prevTo.toISOString());
      prevRow = {
        total_events: prevTotalC ?? 0,
        distinct_actors: 0,
        failed_count: 0,
        success_or_partial: prevTotalC ?? 0,
        distinct_role_values: 0,
      };
      roleData = [];
    }

    const total = row?.total_events ?? 0;
    const prevTotal = prevRow?.total_events ?? 0;
    const deltaTotal = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null;

    const failed = row?.failed_count ?? 0;
    const successRate =
      total > 0 ? Math.round(((total - failed) / total) * 1000) / 10 : 100;

    const roles = (Array.isArray(roleData) ? roleData : []) as RoleRow[];

    /** Latence : moyenne sur metadata.duration_ms (chaîne) si présent — requête légère */
    const { data: latRows } = await sb
      .from('audit_logs')
      .select('metadata')
      .gte('created_at', pFrom)
      .lte('created_at', pTo)
      .limit(5000);

    const durations: number[] = [];
    for (const r of latRows || []) {
      const m = r.metadata as Record<string, unknown> | null;
      const d = m?.duration_ms;
      const n = typeof d === 'number' ? d : typeof d === 'string' ? parseFloat(d) : NaN;
      if (Number.isFinite(n) && n >= 0 && n < 600000) durations.push(n);
    }
    durations.sort((a, b) => a - b);
    const avgMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    const p50 = durations.length ? durations[Math.floor(durations.length * 0.5)] : null;
    const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] : null;
    const p99 = durations.length ? durations[Math.floor(durations.length * 0.99)] : null;

    return NextResponse.json({
      period: { from: pFrom, to: pTo },
      previous_period: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
      kpis: {
        total_events: total,
        distinct_actors: row?.distinct_actors ?? 0,
        failed_count: failed,
        success_rate_pct: successRate,
        distinct_role_values: row?.distinct_role_values ?? 0,
        delta_total_pct: deltaTotal,
        prev_total_events: prevTotal,
      },
      role_breakdown: roles.map((r) => ({ role: r.role_label, count: Number(r.event_count) })),
      latency_ms: {
        avg: avgMs,
        p50,
        p95,
        p99,
        sample_size: durations.length,
      },
      statistics: [
        {
          date: pTo.slice(0, 10),
          action_type: 'view' as const,
          entity_type: 'profile' as const,
          user_role: 'mixed',
          event_count: total,
          unique_users: row?.distinct_actors ?? 0,
          failed_count: failed,
          success_count: total - failed,
        },
      ],
    });
  } catch (e) {
    console.error('[audit/stats]', e);
    return NextResponse.json(
      {
        error: String((e as Error).message),
        kpis: null,
        statistics: [],
        role_breakdown: [],
      },
      { status: 500 },
    );
  }
}
