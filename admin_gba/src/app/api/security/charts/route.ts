import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const DANGEROUS = new Set(['delete', 'bulk_delete', 'export', 'bulk_export', 'permission_change']);

/** Agrégations pour graphiques page sécurité (audit + tentatives). */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const since24h = new Date(Date.now() - 86400000).toISOString();

  try {
    const [auditRows, loginRows] = await Promise.all([
      sb
        .from('audit_logs')
        .select('created_at, action_type, status')
        .gte('created_at', since7d)
        .limit(15000),
      sb
        .from('admin_login_history')
        .select('created_at, success')
        .gte('created_at', since24h)
        .limit(5000),
    ]);

    const heatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    const now = new Date();
    for (const r of auditRows.data || []) {
      const d = new Date(String((r as { created_at: string }).created_at));
      if (Number.isNaN(d.getTime())) continue;
      const ageDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (ageDays < 0 || ageDays > 6) continue;
      const h = d.getHours();
      heatmap[6 - ageDays][h] += 1;
    }

    const bruteByHour = new Map<string, { hour_key: string; failed: number; ok: number }>();
    for (const r of loginRows.data || []) {
      const d = new Date(String((r as { created_at: string }).created_at));
      if (Number.isNaN(d.getTime())) continue;
      const hourKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;
      const cur = bruteByHour.get(hourKey) || { hour_key: hourKey, failed: 0, ok: 0 };
      if ((r as { success: boolean }).success) cur.ok += 1;
      else cur.failed += 1;
      bruteByHour.set(hourKey, cur);
    }
    const bruteSeries = [...bruteByHour.values()].sort((a, b) => a.hour_key.localeCompare(b.hour_key));

    const actionCounts = new Map<string, number>();
    for (const r of auditRows.data || []) {
      const a = String((r as { action_type: string }).action_type || 'view');
      actionCounts.set(a, (actionCounts.get(a) || 0) + 1);
    }
    const actionsByType = [...actionCounts.entries()]
      .map(([action_type, count]) => ({
        action_type,
        count,
        dangerous: DANGEROUS.has(action_type),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);

    return NextResponse.json({
      data: {
        heatmap_7d_24h: heatmap,
        brute_force_hourly_24h: bruteSeries,
        actions_by_type: actionsByType,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
