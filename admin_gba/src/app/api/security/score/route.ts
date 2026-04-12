import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** Score 0–100 synthétique (heuristique) pour la barre d’état sécurité. */
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

  const [failed, blacklist, admins, wl] = await Promise.all([
    sb.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action_type', 'login').eq('status', 'failed').gte('created_at', since),
    sb.from('ip_blacklist').select('id', { count: 'exact', head: true }),
    sb.auth.admin.listUsers({ perPage: 200 }),
    sb.from('ip_whitelist').select('id', { count: 'exact', head: true }),
  ]);

  const users = admins.data?.users ?? [];
  const adminUsers = users.filter((u) => {
    const r = String((u.app_metadata as Record<string, unknown>)?.role || (u.user_metadata as Record<string, unknown>)?.role || '').toLowerCase();
    return r === 'admin' || r === 'superadmin' || r === 'super_admin';
  });
  const with2fa = adminUsers.filter((u) => u.factors && u.factors.length > 0).length;
  const cov2 = adminUsers.length ? with2fa / adminUsers.length : 1;

  let score = 100;
  const failedN = failed.count ?? 0;
  if (failedN > 10) score -= 35;
  else if (failedN > 5) score -= 20;
  else if (failedN > 0) score -= 8;

  if ((blacklist.count ?? 0) > 50) score -= 10;
  if (cov2 < 0.5) score -= 25;
  else if (cov2 < 0.8) score -= 10;

  if ((wl.count ?? 0) === 0) score -= 5;

  score = Math.max(0, Math.min(100, score));

  const level = score >= 75 ? 'secure' : score >= 45 ? 'warning' : 'critical';

  return NextResponse.json({
    score,
    level,
    breakdown: {
      failed_logins_24h: failedN,
      blacklist_size: blacklist.count ?? 0,
      whitelist_size: wl.count ?? 0,
      two_fa_coverage: Math.round(cov2 * 100),
    },
  });
}
