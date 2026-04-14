import { NextResponse } from 'next/server';
import { UAParser } from 'ua-parser-js';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { lookupGeoIp } from '@/lib/geoip/lookup';
import { writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

function adminRole(u: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  const a = u.app_metadata?.role ?? u.user_metadata?.role;
  return typeof a === 'string' ? a : '';
}

function parseUa(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: '—', os: '—' };
  const p = new UAParser(ua).getResult();
  const browser = [p.browser.name, p.browser.version?.split('.')[0]].filter(Boolean).join(' ') || '—';
  const os = [p.os.name, p.os.version].filter(Boolean).join(' ') || '—';
  return { browser, os };
}

async function geoBatch(ips: string[]): Promise<Map<string, { country?: string; city?: string }>> {
  const map = new Map<string, { country?: string; city?: string }>();
  const unique = [...new Set(ips.map((s) => s.trim()).filter(Boolean))].slice(0, 48);
  const chunk = 6;
  for (let i = 0; i < unique.length; i += chunk) {
    const part = unique.slice(i, i + chunk);
    await Promise.all(
      part.map(async (ip) => {
        const g = await lookupGeoIp(ip);
        map.set(ip, { country: g.country, city: g.city });
      }),
    );
  }
  return map;
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = data?.users ?? [];
  const now = Date.now();
  const { data: loginRows } = await sb
    .from('admin_login_history')
    .select('user_id, email, ip_address, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);
  const loginByUser = new Map<string, { ip: string | null; ua: string | null; at: string | null; email: string | null }>();
  const loginByEmail = new Map<string, { ip: string | null; ua: string | null; at: string | null }>();
  for (const row of loginRows || []) {
    const userId = String((row as { user_id?: string | null }).user_id || '');
    const email = String((row as { email?: string | null }).email || '').toLowerCase();
    const ip = ((row as { ip_address?: string | null }).ip_address || null) as string | null;
    const ua = ((row as { user_agent?: string | null }).user_agent || null) as string | null;
    const at = ((row as { created_at?: string | null }).created_at || null) as string | null;
    if (userId && !loginByUser.has(userId)) loginByUser.set(userId, { ip, ua, at, email: email || null });
    if (email && !loginByEmail.has(email)) loginByEmail.set(email, { ip, ua, at });
  }

  const activeSessions = users
    .filter((u) => {
      const r = adminRole(u).toLowerCase();
      return r === 'admin' || r === 'superadmin' || r === 'super_admin';
    })
    .filter((u) => u.last_sign_in_at)
    .map((u) => {
      const lastSignIn = new Date(u.last_sign_in_at!).getTime();
      const hoursAgo = (now - lastSignIn) / 3600000;
      const meta = (u.user_metadata || {}) as Record<string, unknown>;
      const byUser = loginByUser.get(u.id);
      const byEmail = u.email ? loginByEmail.get(String(u.email).toLowerCase()) : undefined;
      const ip = (meta.last_ip as string) || byUser?.ip || byEmail?.ip || null;
      const ua = (meta.last_ua as string) || byUser?.ua || byEmail?.ua || null;
      const startedAt = byUser?.at || byEmail?.at || u.last_sign_in_at;
      const { browser, os } = parseUa(ua);
      return {
        id: u.id,
        user_id: u.id,
        email: u.email,
        started_at: startedAt,
        ended_at: null as string | null,
        last_active_at: u.last_sign_in_at,
        ip_address: ip,
        user_agent: ua,
        device_type: hoursAgo < 24 ? 'web_active' : 'web',
        is_active: hoursAgo < 24,
        hours_ago: Math.round(hoursAgo),
        browser,
        os,
        country: null as string | null,
        city: null as string | null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.last_active_at || 0).getTime() - new Date(a.last_active_at || 0).getTime(),
    );

  const ips = activeSessions.map((s) => s.ip_address).filter((x): x is string => !!x);
  const geo = await geoBatch(ips);
  for (const s of activeSessions) {
    if (s.ip_address) {
      const g = geo.get(s.ip_address);
      s.country = g?.country ?? null;
      s.city = g?.city ?? null;
    }
  }

  return NextResponse.json({
    data: activeSessions,
    meta: {
      total: activeSessions.length,
      active: activeSessions.filter((s) => s.is_active).length,
    },
  });
}

export async function DELETE() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { error } = await sb.from('user_sessions').update({ ended_at: now }).is('ended_at', null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actionType: 'delete',
    entityType: 'profile',
    entityId: 'all',
    description: 'Révocation globale des sessions applicatives',
    status: 'success',
  });

  return NextResponse.json({ ok: true });
}
