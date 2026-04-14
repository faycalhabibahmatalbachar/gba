import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { lookupGeoIp } from '@/lib/geoip/lookup';
import { labelIpKind } from '@/lib/security/ip-present';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const ip = new URL(req.url).searchParams.get('ip')?.trim() || '';
  const kind = labelIpKind(ip);
  if (kind.kind === 'localhost' || kind.kind === 'lan') {
    return NextResponse.json({
      type: 'local' as const,
      label: kind.label,
      country_code: null,
      country_name: null,
      city: null,
      lat: null,
      lng: null,
      is_local: true,
      is_vpn: false,
    });
  }
  if (!ip) {
    return NextResponse.json({ error: 'Paramètre ip requis' }, { status: 400 });
  }

  const g = await lookupGeoIp(ip);
  return NextResponse.json({
    type: 'public' as const,
    ip,
    country_code: null,
    country_name: g.country ?? null,
    lat: g.lat,
    lng: g.lng,
    city: g.city ?? null,
    source: g.source,
    is_local: false,
    is_vpn: false,
  });
}
