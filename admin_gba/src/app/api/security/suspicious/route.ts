import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** IPs avec ≥3 échecs connexion sur la dernière heure (admin_login_history ou audit). */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = new Date(Date.now() - 3600000).toISOString();

  try {
    const { data: hist } = await sb
      .from('admin_login_history')
      .select('ip_address, success')
      .eq('success', false)
      .gte('created_at', since)
      .limit(2000);

    const counts = new Map<string, number>();
    for (const r of hist || []) {
      const ip = String((r as { ip_address: string | null }).ip_address || '').trim();
      if (!ip) continue;
      counts.set(ip, (counts.get(ip) || 0) + 1);
    }

    if (counts.size === 0) {
      const { data: audit } = await sb
        .from('audit_logs')
        .select('metadata, status')
        .eq('action_type', 'login')
        .eq('status', 'failed')
        .gte('created_at', since)
        .limit(2000);
      for (const r of audit || []) {
        const m = (r as { metadata: Record<string, unknown> }).metadata || {};
        const ip = String(m.ip || m.ip_address || '').trim();
        if (!ip) continue;
        counts.set(ip, (counts.get(ip) || 0) + 1);
      }
    }

    const flagged = [...counts.entries()]
      .filter(([, n]) => n >= 3)
      .map(([ip, failures]) => ({ ip, failures }))
      .sort((a, b) => b.failures - a.failures);

    return NextResponse.json({ data: { flagged, threshold: 3, window_hours: 1 } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
