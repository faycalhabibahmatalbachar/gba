import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** Agrégats légers pour les cartes /audit (évite RLS côté client). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: total }, { count: today }, { count: failed }, { data: roleRows }] = await Promise.all([
    sb.from('audit_logs').select('id', { count: 'exact', head: true }),
    sb.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    sb.from('audit_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    sb.from('audit_logs').select('user_role').limit(5000),
  ]);

  const roles = new Set((roleRows || []).map((r) => String((r as { user_role?: string }).user_role || 'unknown')));

  const now = new Date().toISOString().slice(0, 10);
  const statistics = [
    {
      date: now,
      action_type: 'view' as const,
      entity_type: 'profile' as const,
      user_role: 'mixed',
      event_count: total ?? 0,
      unique_users: roles.size,
      failed_count: failed ?? 0,
      success_count: Math.max(0, (total ?? 0) - (failed ?? 0)),
    },
  ];

  return NextResponse.json({
    statistics,
    kpis: {
      total: total ?? 0,
      actions_today: today ?? 0,
      failures: failed ?? 0,
      distinct_roles: roles.size,
    },
  });
}
