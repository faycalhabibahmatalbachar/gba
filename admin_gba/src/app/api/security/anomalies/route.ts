import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * Heuristique simple : volume d’actions audit par admin sur 24h (seuil arbitraire).
 * À enrichir quand la table admin_anomalies existe.
 */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = new Date(Date.now() - 86400000).toISOString();

  try {
    const { data: rows } = await sb
      .from('audit_logs')
      .select('user_id, user_email')
      .not('user_id', 'is', null)
      .gte('created_at', since)
      .limit(8000);

    const counts = new Map<string, { email: string | null; n: number }>();
    for (const r of rows || []) {
      const uid = String((r as { user_id?: string }).user_id || '');
      if (!uid) continue;
      const email = ((r as { user_email?: string | null }).user_email || null) as string | null;
      const cur = counts.get(uid) || { email, n: 0 };
      cur.n += 1;
      if (!cur.email && email) cur.email = email;
      counts.set(uid, cur);
    }

    const anomalies = [...counts.entries()]
      .filter(([, v]) => v.n >= 120)
      .map(([user_id, v]) => ({
        type: 'high_volume' as const,
        admin_id: user_id,
        email: v.email,
        description: `Volume d’actions audit élevé sur 24h (${v.n} événements)`,
        severity: 'attention' as const,
      }))
      .slice(0, 20);

    return NextResponse.json({ data: anomalies });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
