import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { loadUserSessionRows } from '@/app/api/users/_lib/user-sessions';

export const dynamic = 'force-dynamic';

function parseUa(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: '—', os: '—' };
  const u = ua.toLowerCase();
  let browser = 'Navigateur';
  if (u.includes('chrome') && !u.includes('edg')) browser = 'Chrome';
  else if (u.includes('firefox')) browser = 'Firefox';
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('edg')) browser = 'Edge';
  let os = '—';
  if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os')) os = 'macOS';
  else if (u.includes('linux')) os = 'Linux';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  return { browser, os };
}

/** Score 0–100 (heuristique). */
function computeSecurityScore(input: {
  loginFails30: number;
  loginsOk30: number;
  hasRecentLogin: boolean;
}): { score: number; details: { label: string; pts: number }[] } {
  const details: { label: string; pts: number }[] = [];
  let score = 40;
  if (input.hasRecentLogin) {
    details.push({ label: 'Connexion récente (< 30 j)', pts: 20 });
    score += 20;
  }
  if (input.loginFails30 === 0) {
    details.push({ label: 'Aucun échec de connexion (30 j)', pts: 15 });
    score += 15;
  } else {
    details.push({ label: 'Échecs de connexion (30 j)', pts: -Math.min(15, input.loginFails30 * 3) });
    score -= Math.min(15, input.loginFails30 * 3);
  }
  if (input.loginsOk30 >= 5) {
    details.push({ label: 'Activité de connexion régulière', pts: 15 });
    score += 15;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, details };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const { data: profile, error: pe } = await sb
      .from('profiles')
      .select(
        'id, email, first_name, last_name, phone, role, city, country, avatar_url, is_suspended, suspended_at, suspended_by, suspension_reason, last_seen_at, is_online, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (pe) throw pe;
    if (!profile) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const r = String(profile.role || '').toLowerCase();
    if (!['admin', 'superadmin', 'super_admin'].includes(r)) {
      return NextResponse.json({ error: 'Cet endpoint est réservé aux comptes administrateur' }, { status: 400 });
    }

    let last_sign_in_at: string | null = null;
    try {
      const { data: au } = await sb.auth.admin.getUserById(id);
      last_sign_in_at = au.user?.last_sign_in_at ?? null;
    } catch {
      /* ignore */
    }

    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let loginsOk30 = 0;
    let loginFails30 = 0;
    let lastIp: string | null = null;
    let lastUa: string | null = null;
    try {
      const { data: hist } = await sb
        .from('admin_login_history')
        .select('success, ip_address, user_agent, created_at')
        .eq('user_id', id)
        .gte('created_at', since30)
        .order('created_at', { ascending: false })
        .limit(500);
      for (const h of hist || []) {
        const row = h as { success?: boolean; ip_address?: string | null; user_agent?: string | null };
        if (row.success === false) loginFails30++;
        else loginsOk30++;
      }
      const last = (hist || [])[0] as { ip_address?: string | null; user_agent?: string | null } | undefined;
      if (last) {
        lastIp = last.ip_address ?? null;
        lastUa = last.user_agent ?? null;
      }
    } catch {
      /* table absente */
    }

    const sessions = await loadUserSessionRows(sb, id);
    let connectedMinutesMonth = 0;
    for (const s of sessions) {
      const start = s.started_at ? new Date(String(s.started_at)).getTime() : 0;
      const end = s.ended_at ? new Date(String(s.ended_at)).getTime() : Date.now();
      if (start && start >= monthStart.getTime() && end > start) {
        connectedMinutesMonth += Math.round((end - start) / 60000);
      }
    }

    const hasRecentLogin = last_sign_in_at
      ? new Date(last_sign_in_at).getTime() > Date.now() - 30 * 86400000
      : false;
    const { score, details } = computeSecurityScore({
      loginFails30,
      loginsOk30,
      hasRecentLogin,
    });

    const uaInfo = parseUa(lastUa);

    return NextResponse.json({
      profile: { ...profile, last_sign_in_at },
      presence: {
        is_online: Boolean(profile.is_online),
        last_seen_at: profile.last_seen_at,
        last_ip: lastIp,
        last_country: profile.country ?? null,
        browser_line: `${uaInfo.browser} · ${uaInfo.os}`,
      },
      stats: {
        connected_minutes_month: connectedMinutesMonth,
        logins_ok_30d: loginsOk30,
        logins_fail_30d: loginFails30,
        security_score: score,
        security_score_details: details,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
