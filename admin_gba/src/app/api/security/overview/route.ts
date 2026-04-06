import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

function adminRole(u: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  const a = u.app_metadata?.role ?? u.user_metadata?.role;
  return typeof a === 'string' ? a : '';
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = new Date(Date.now() - 86400000).toISOString();

  const [usersRes, failedHist, failedAudit, ipRes] = await Promise.all([
    sb.auth.admin.listUsers({ perPage: 1000 }),
    sb.from('admin_login_history').select('id', { count: 'exact', head: true }).eq('success', false).gte('created_at', since),
    sb
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action_type', 'login')
      .eq('status', 'failed')
      .gte('created_at', since),
    sb.from('ip_blacklist').select('id', { count: 'exact', head: true }),
  ]);

  const users = usersRes.data?.users ?? [];
  const admins = users.filter((u) => {
    const r = adminRole(u).toLowerCase();
    return r === 'admin' || r === 'superadmin' || r === 'super_admin';
  });

  const now = Date.now();
  const activeSessions = admins.filter((u) => {
    if (!u.last_sign_in_at) return false;
    const hoursAgo = (now - new Date(u.last_sign_in_at).getTime()) / 3600000;
    return hoursAgo < 24;
  }).length;

  const verified2FA = admins.filter((u) => u.factors && u.factors.length > 0).length;
  const coverage2fa = admins.length > 0 ? Math.round((verified2FA / admins.length) * 100) : 0;

  const failed24 = Math.max(failedHist.count ?? 0, failedAudit.count ?? 0);

  return NextResponse.json({
    active_sessions: activeSessions,
    failed_24h: failed24,
    blocked_ips: ipRes.count ?? 0,
    coverage_2fa: coverage2fa,
    total_admins: admins.length,
    tokens_expired_hint: 0,
    admins_without_2fa: admins.length - verified2FA,
  });
}
