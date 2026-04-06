import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import ipaddr from 'ipaddr.js';

export type SecurityAccessValue = {
  blocked_countries: string[];
  max_admin_connections_per_hour: number;
  enforce_country_block: boolean;
  enforce_ip_allowlist: boolean;
  /** IPs autorisées en urgence (full_lockdown) — fusionnées avec ip_whitelist pour le contrôle. */
  emergency_allowlist_ips: string[];
};

export type GatePayload = {
  lockdownActive: boolean;
  access: SecurityAccessValue;
  whitelistCidrs: string[];
  blacklistCidrs: string[];
};

const DEFAULT_ACCESS: SecurityAccessValue = {
  blocked_countries: [],
  max_admin_connections_per_hour: 2000,
  enforce_country_block: false,
  enforce_ip_allowlist: false,
  emergency_allowlist_ips: [],
};

let gateCache: { at: number; payload: GatePayload } | null = null;
const GATE_TTL_MS = 20_000;

const rateBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 60 * 1000;

function parseAccess(raw: unknown): SecurityAccessValue {
  const v = (raw as Record<string, unknown>) || {};
  const bc = v.blocked_countries;
  const em = v.emergency_allowlist_ips;
  return {
    blocked_countries: Array.isArray(bc)
      ? bc.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
      : DEFAULT_ACCESS.blocked_countries,
    max_admin_connections_per_hour: Math.min(
      10_000,
      Math.max(1, Number(v.max_admin_connections_per_hour ?? DEFAULT_ACCESS.max_admin_connections_per_hour)),
    ),
    enforce_country_block: Boolean(v.enforce_country_block ?? DEFAULT_ACCESS.enforce_country_block),
    enforce_ip_allowlist: Boolean(v.enforce_ip_allowlist ?? DEFAULT_ACCESS.enforce_ip_allowlist),
    emergency_allowlist_ips: Array.isArray(em)
      ? em.map((x) => String(x).trim()).filter(Boolean)
      : DEFAULT_ACCESS.emergency_allowlist_ips,
  };
}

function lockdownFromValue(raw: unknown): boolean {
  const v = raw as Record<string, unknown> | null | undefined;
  if (!v || typeof v !== 'object') return false;
  return Boolean(v.active === true);
}

export function getClientIp(request: Request): string {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  const xr = request.headers.get('x-real-ip')?.trim();
  if (xr) return xr;
  return '';
}

export function getClientCountry(request: Request): string | null {
  const cf = request.headers.get('cf-ipcountry')?.trim().toUpperCase();
  if (cf && cf !== 'XX') return cf;
  const vc = request.headers.get('x-vercel-ip-country')?.trim().toUpperCase();
  if (vc && vc !== 'XX') return vc;
  return null;
}

function isPrivateOrLocalIp(ip: string): boolean {
  try {
    const a = ipaddr.parse(ip);
    const r = a.range();
    return r === 'private' || r === 'loopback' || r === 'uniqueLocal' || r === 'linkLocal';
  } catch {
    return false;
  }
}

/** True si l’IP est dans le réseau CIDR (texte Postgres / notation standard). */
export function ipMatchesCidr(clientIp: string, cidrText: string): boolean {
  if (!clientIp || !cidrText) return false;
  try {
    const addr = ipaddr.process(clientIp);
    const ref = ipaddr.parseCIDR(cidrText.trim());
    return addr.match(ref);
  } catch {
    return false;
  }
}

function ipAllowedByList(clientIp: string, cidrs: string[]): boolean {
  if (!clientIp) return false;
  for (const c of cidrs) {
    if (ipMatchesCidr(clientIp, c)) return true;
  }
  return false;
}

/** Normalise une IP ou CIDR pour ipMatchesCidr (IPv4 → /32, IPv6 → /128 si besoin). */
function normalizeIpOrCidr(entry: string): string {
  const t = entry.trim();
  if (!t) return '';
  if (t.includes('/')) return t;
  try {
    const a = ipaddr.parse(t);
    const kind = a.kind();
    return kind === 'ipv6' ? `${t}/128` : `${t}/32`;
  } catch {
    return '';
  }
}

function emergencyIpsAsCidrs(ips: string[]): string[] {
  return ips.map(normalizeIpOrCidr).filter(Boolean);
}

export async function loadGatePayload(sb: SupabaseClient): Promise<GatePayload> {
  const now = Date.now();
  if (gateCache && now - gateCache.at < GATE_TTL_MS) return gateCache.payload;

  const [settingsRes, wlRes, blRes] = await Promise.all([
    sb.from('settings').select('key, value').in('key', ['security_emergency_lockdown', 'security_access']),
    sb.from('ip_whitelist').select('ip_cidr, is_active, expires_at').eq('is_active', true),
    sb.from('ip_blacklist').select('ip_cidr, expires_at'),
  ]);

  const settingsRows = (settingsRes.data || []) as { key: string; value: unknown }[];
  const byKey = new Map(settingsRows.map((r) => [r.key, r.value]));
  const lockdownActive = lockdownFromValue(byKey.get('security_emergency_lockdown'));
  const access = parseAccess(byKey.get('security_access'));

  const isoNow = new Date().toISOString();
  const whitelistCidrs = (wlRes.data || [])
    .filter((r: { expires_at?: string | null }) => !r.expires_at || String(r.expires_at) > isoNow)
    .map((r: { ip_cidr: string }) => String(r.ip_cidr));

  const blacklistCidrs = (blRes.data || [])
    .filter((r: { expires_at?: string | null }) => !r.expires_at || String(r.expires_at) > isoNow)
    .map((r: { ip_cidr: string }) => String(r.ip_cidr));

  const payload: GatePayload = {
    lockdownActive,
    access,
    whitelistCidrs,
    blacklistCidrs,
  };
  gateCache = { at: now, payload };
  return payload;
}

function metaSuperAdmin(user: User): boolean {
  const mr = (user.user_metadata as { role?: string } | undefined)?.role;
  const ar = (user.app_metadata as { role?: string } | undefined)?.role;
  return mr === 'superadmin' || mr === 'super_admin' || ar === 'superadmin' || ar === 'super_admin';
}

export async function isSuperAdmin(sb: SupabaseClient, user: User): Promise<boolean> {
  if (metaSuperAdmin(user)) return true;
  const { data } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const r = data?.role;
  return r === 'superadmin' || r === 'super_admin';
}

export type GateDecision =
  | { ok: true }
  | { ok: false; status: 403 | 429; code: string; message: string };

export async function evaluateAdminGate(opts: {
  sb: SupabaseClient;
  user: User;
  request: Request;
  payload: GatePayload;
  /** Si false, le plafond requêtes/heure n’est pas appliqué (évite RSC / assets). */
  applyHourlyRateLimit?: boolean;
}): Promise<GateDecision> {
  const { sb, user, request, payload, applyHourlyRateLimit = false } = opts;
  const ip = getClientIp(request);
  const country = getClientCountry(request);

  if (payload.lockdownActive) {
    const sup = await isSuperAdmin(sb, user);
    if (!sup) {
      return {
        ok: false,
        status: 403,
        code: 'LOCKDOWN',
        message: 'Verrouillage d’urgence actif — accès réservé aux super-administrateurs.',
      };
    }
  }

  if (ip && payload.blacklistCidrs.length && ipAllowedByList(ip, payload.blacklistCidrs)) {
    return { ok: false, status: 403, code: 'IP_BLACKLIST', message: 'Adresse IP refusée (liste noire).' };
  }

  if (payload.access.enforce_ip_allowlist) {
    const emergencyCidrs = emergencyIpsAsCidrs(payload.access.emergency_allowlist_ips);
    const effectiveWhitelist = [...payload.whitelistCidrs, ...emergencyCidrs];
    if (effectiveWhitelist.length > 0) {
      if (!ip || !ipAllowedByList(ip, effectiveWhitelist)) {
        return {
          ok: false,
          status: 403,
          code: 'IP_NOT_WHITELISTED',
          message: 'IP non autorisée (liste blanche activée).',
        };
      }
    }
  }

  if (payload.access.enforce_country_block && payload.access.blocked_countries.length > 0) {
    if (country && payload.access.blocked_countries.includes(country)) {
      return {
        ok: false,
        status: 403,
        code: 'COUNTRY_BLOCKED',
        message: `Pays ${country} bloqué par la politique d’accès.`,
      };
    }
    if (!country && ip && !isPrivateOrLocalIp(ip)) {
      return {
        ok: false,
        status: 403,
        code: 'COUNTRY_UNKNOWN',
        message: 'Pays indéterminé — impossible de valider le blocage géographique.',
      };
    }
  }

  const maxH = payload.access.max_admin_connections_per_hour;
  if (applyHourlyRateLimit && maxH > 0 && user.id) {
    const sup = await isSuperAdmin(sb, user);
    if (!sup) {
      const t = Date.now();
      const key = user.id;
      const prev = rateBuckets.get(key) || [];
      const recent = prev.filter((x) => t - x < RATE_WINDOW_MS);
      if (recent.length >= maxH) {
        return {
          ok: false,
          status: 429,
          code: 'RATE_LIMIT',
          message: `Plafond de ${maxH} requêtes administrateur par heure dépassé.`,
        };
      }
      recent.push(t);
      rateBuckets.set(key, recent);
    }
  }

  return { ok: true };
}
