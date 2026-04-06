import type { SupabaseClient } from '@supabase/supabase-js';

/** Sans table `user_sessions` : méta Auth + admin_login_history (+ legacy si présent). */
export async function loadUserSessionRows(
  sb: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];

  try {
    const { data: authUser } = await sb.auth.admin.getUserById(userId);
    const u = authUser?.user;
    if (u?.last_sign_in_at) {
      rows.push({
        id: `last-sign-in-${userId}`,
        session_id: null,
        ip_address: null,
        user_agent: null,
        device_type: 'auth',
        started_at: u.last_sign_in_at,
        ended_at: null,
        last_active_at: u.last_sign_in_at,
        created_at: u.created_at,
        revoked_at: null,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { data: hist } = await sb
      .from('admin_login_history')
      .select('id, user_id, created_at, ip_address, user_agent, success')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    for (const h of hist || []) {
      const r = h as Record<string, unknown>;
      rows.push({
        id: r.id,
        session_id: null,
        ip_address: r.ip_address,
        user_agent: r.user_agent,
        device_type: r.success === false ? 'login_failed' : 'web',
        started_at: r.created_at,
        ended_at: null,
        last_active_at: r.created_at,
        created_at: r.created_at,
        revoked_at: null,
      });
    }
  } catch {
    /* table absente */
  }

  try {
    const { data: legacy } = await sb
      .from('user_sessions')
      .select(
        'id, session_id, ip_address, user_agent, device_type, started_at, ended_at, last_active_at, created_at, revoked_at',
      )
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(50);
    if (legacy?.length) {
      for (const s of legacy) rows.push(s as Record<string, unknown>);
    }
  } catch {
    /* table absente */
  }

  return rows;
}
