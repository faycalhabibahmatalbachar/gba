import { NextResponse } from 'next/server';
import { subHours } from 'date-fns';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { lookupGeoIp } from '@/lib/geoip/lookup';

export const dynamic = 'force-dynamic';

async function resolveBatch(ips: string[], concurrency: number) {
  const out = new Map<string, Awaited<ReturnType<typeof lookupGeoIp>>>();
  let i = 0;
  async function worker() {
    for (;;) {
      const j = i++;
      if (j >= ips.length) return;
      const ip = ips[j]!;
      const g = await lookupGeoIp(ip);
      out.set(ip, g);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ips.length) }, () => worker()));
  return out;
}

/** Connexions admin 24h : IP depuis metadata audit + GeoIP (ipwho.is) avec repli hachage si échec / IP privée. */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = subHours(new Date(), 24).toISOString();

  try {
    const { data, error } = await sb
      .from('audit_logs')
      .select('id, user_email, action_type, status, metadata, created_at')
      .eq('action_type', 'login')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(400);

    if (error) throw error;

    const rawRows = data || [];
    const uniqueIps = [
      ...new Set(
        rawRows.map((row) => {
          const m = (row.metadata || {}) as Record<string, unknown>;
          return String(m.ip || m.ip_address || '').trim();
        }),
      ),
    ].filter(Boolean);

    const geoByIp = await resolveBatch(uniqueIps, 6);

    const points = rawRows.map((row) => {
      const m = (row.metadata || {}) as Record<string, unknown>;
      const ip = String(m.ip || m.ip_address || '').trim();
      const g = ip ? geoByIp.get(ip) : undefined;
      const lat = g?.lat ?? 12.1;
      const lng = g?.lng ?? 15.05;
      const unusual = Boolean(m.unusual || m.new_device || m.risk || m.suspicious);
      const st =
        row.status === 'failed' ? 'blocked' : unusual ? 'unusual' : 'normal';
      return {
        id: row.id,
        lat,
        lng,
        status: st,
        ip: ip || null,
        email: row.user_email,
        at: row.created_at,
        country: g?.country ?? null,
        city: g?.city ?? null,
        geo_source: g?.source ?? null,
      };
    });

    return NextResponse.json({ data: { points } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
