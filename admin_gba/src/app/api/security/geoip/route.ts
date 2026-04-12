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
      lat: null,
      lng: null,
      country: null,
      city: null,
    });
  }
  if (!ip) {
    return NextResponse.json({ error: 'Paramètre ip requis' }, { status: 400 });
  }

  const g = await lookupGeoIp(ip);
  return NextResponse.json({
    type: 'public' as const,
    ip,
    lat: g.lat,
    lng: g.lng,
    country: g.country ?? null,
    city: g.city ?? null,
    source: g.source,
  });
}
