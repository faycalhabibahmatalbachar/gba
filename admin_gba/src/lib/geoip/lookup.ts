import ipaddr from 'ipaddr.js';

function hashToLatLng(seed: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const lat = 12 + ((h % 1000) / 1000) * 8;
  const lng = 14 + (((h >> 8) % 1000) / 1000) * 10;
  return { lat, lng };
}

export type GeoSource = 'ipinfo' | 'ipwho' | 'hash' | 'off';

type CachedGeo = { lat: number; lng: number; country?: string; city?: string; src: GeoSource };
const cache = new Map<string, CachedGeo>();
const MAX_CACHE = 2000;

function cacheSet(ip: string, v: CachedGeo) {
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(ip, v);
}

function isPublicUnicast(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip.trim());
    return addr.range() === 'unicast';
  } catch {
    return false;
  }
}

const TIMEOUT_MS = Math.min(8000, Math.max(800, parseInt(process.env.GEOIP_TIMEOUT_MS || '1500', 10) || 1500));

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { Accept: 'application/json', ...init?.headers } });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type GeoLookupResult = {
  lat: number;
  lng: number;
  country?: string;
  city?: string;
  source: GeoSource;
};

/**
 * Ordre : GEOIP_PROVIDER (ipinfo | ipwho | off) ; ipinfo nécessite IPINFO_TOKEN.
 * Timeouts courts pour éviter de bloquer les routes API derrière réseaux filtrants.
 */
export async function lookupGeoIp(ip: string): Promise<GeoLookupResult> {
  const trimmed = ip.trim();
  if (!trimmed) {
    const { lat, lng } = hashToLatLng('');
    return { lat, lng, source: 'hash' };
  }

  const provider = (process.env.GEOIP_PROVIDER || 'ipwho').toLowerCase();
  if (provider === 'off') {
    const { lat, lng } = hashToLatLng(trimmed);
    return { lat, lng, source: 'off' };
  }

  if (!isPublicUnicast(trimmed)) {
    const { lat, lng } = hashToLatLng(trimmed);
    return { lat, lng, source: 'hash' };
  }

  const hit = cache.get(trimmed);
  if (hit) {
    const { src, ...rest } = hit;
    return { ...rest, source: src };
  }

  const tryIpinfo = async (): Promise<GeoLookupResult | null> => {
    const token = process.env.IPINFO_TOKEN?.trim();
    if (!token) return null;
    const j = await fetchJson(`https://ipinfo.io/${encodeURIComponent(trimmed)}/json?token=${encodeURIComponent(token)}`);
    if (!j) return null;
    const loc = typeof j.loc === 'string' ? j.loc.split(',') : null;
    const lat = loc && loc[0] ? parseFloat(loc[0]) : NaN;
    const lng = loc && loc[1] ? parseFloat(loc[1]) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const out = {
      lat,
      lng,
      country: typeof j.country === 'string' ? j.country : undefined,
      city: typeof j.city === 'string' ? j.city : undefined,
    };
    cacheSet(trimmed, { ...out, src: 'ipinfo' });
    return { ...out, source: 'ipinfo' };
  };

  const tryIpwho = async (): Promise<GeoLookupResult | null> => {
    const j = await fetchJson(
      `https://ipwho.is/${encodeURIComponent(trimmed)}?fields=ip,success,message,country,city,latitude,longitude`,
    );
    if (!j || j.success !== true) return null;
    const lat = Number(j.latitude);
    const lng = Number(j.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const out = {
      lat,
      lng,
      country: typeof j.country === 'string' ? j.country : undefined,
      city: typeof j.city === 'string' ? j.city : undefined,
    };
    cacheSet(trimmed, { ...out, src: 'ipwho' });
    return { ...out, source: 'ipwho' };
  };

  try {
    if (provider === 'ipinfo') {
      const a = await tryIpinfo();
      if (a) return a;
      const b = await tryIpwho();
      if (b) return b;
    } else {
      const a = await tryIpwho();
      if (a) return a;
      const b = await tryIpinfo();
      if (b) return b;
    }
  } catch {
    /* fallthrough */
  }

  const { lat, lng } = hashToLatLng(trimmed);
  return { lat, lng, source: 'hash' };
}

export { hashToLatLng };
