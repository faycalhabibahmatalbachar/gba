import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: profile } = await sb.from('profiles').select('role').eq('id', id).maybeSingle();
    const r = String(profile?.role || '').toLowerCase();
    if (!['admin', 'superadmin', 'super_admin'].includes(r)) {
      return NextResponse.json({ error: 'Profil admin requis' }, { status: 400 });
    }

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: logs } = await sb
      .from('audit_logs')
      .select('created_at, metadata, action_type')
      .eq('user_id', id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(8000);

    const minutesByDay = new Map<string, number>();
    const pageCounts = new Map<string, number>();
    const heatmap: Record<string, number> = {};

    for (const row of logs || []) {
      const ca = String((row as { created_at: string }).created_at);
      const day = ca.slice(0, 10);
      minutesByDay.set(day, (minutesByDay.get(day) || 0) + 1);
      const meta = (row as { metadata?: Record<string, unknown> }).metadata || {};
      const path = typeof meta.path === 'string' ? meta.path : typeof meta.page === 'string' ? meta.page : null;
      if (path) pageCounts.set(path, (pageCounts.get(path) || 0) + 1);
      const d = new Date(ca);
      const wd = d.getDay();
      const hr = d.getHours();
      const key = `${wd}-${hr}`;
      heatmap[key] = (heatmap[key] || 0) + 1;
    }

    const chart = [...minutesByDay.entries()]
      .map(([date, count]) => ({ date, minutes: Math.min(count * 5, 24 * 60) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const top_pages = [...pageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, visits]) => ({ path, visits }));

    return NextResponse.json({
      chart_30d: chart,
      heatmap_24x7: heatmap,
      top_pages,
      note:
        top_pages.length === 0
          ? 'Les chemins de page sont enrichis lorsque les actions audit incluent metadata.path.'
          : null,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
