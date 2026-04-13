import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { evaluateAdminGate, loadGatePayload } from '@/lib/security/admin-middleware-gate';

const LOGIN = '/login';

type PermMatrix = Record<string, Record<string, boolean>> | null;
type PermCacheEntry = { exp: number; isSuper: boolean; matrix: PermMatrix };
const permissionCache = new Map<string, PermCacheEntry>();
const PERM_TTL_MS = 5 * 60 * 1000;

function permCached(userId: string): PermCacheEntry | null {
  const e = permissionCache.get(userId);
  if (!e || Date.now() > e.exp) return null;
  return e;
}

function permSet(userId: string, data: { isSuper: boolean; matrix: PermMatrix }) {
  permissionCache.set(userId, { ...data, exp: Date.now() + PERM_TTL_MS });
}

function matrixAllows(matrix: PermMatrix, scope: string): boolean {
  if (!matrix) return true;
  return Boolean(matrix[scope]?.read);
}

const ROUTE_RULES: { test: (p: string) => boolean; scope: string }[] = [
  { test: (p) => p.startsWith('/orders'), scope: 'orders' },
  { test: (p) => p.startsWith('/products/categories'), scope: 'categories' },
  { test: (p) => p.startsWith('/products'), scope: 'products' },
  { test: (p) => p.startsWith('/deliveries'), scope: 'orders' },
  { test: (p) => p.startsWith('/drivers'), scope: 'drivers' },
  { test: (p) => p.startsWith('/users'), scope: 'users' },
  { test: (p) => p.startsWith('/messages'), scope: 'messages' },
  { test: (p) => p.startsWith('/notifications'), scope: 'notifications' },
  { test: (p) => p.startsWith('/analytics'), scope: 'reports' },
  { test: (p) => p.startsWith('/reviews'), scope: 'products' },
  { test: (p) => p.startsWith('/inventory'), scope: 'products' },
  { test: (p) => p.startsWith('/cms'), scope: 'settings' },
  { test: (p) => p.startsWith('/reports'), scope: 'reports' },
  { test: (p) => p.startsWith('/audit'), scope: 'security' },
  { test: (p) => p.startsWith('/security'), scope: 'security' },
  { test: (p) => p.startsWith('/monitoring'), scope: 'settings' },
  { test: (p) => p.startsWith('/banners'), scope: 'settings' },
  { test: (p) => p.startsWith('/email-logs'), scope: 'settings' },
  { test: (p) => p.startsWith('/settings'), scope: 'settings' },
];

function extractIp(request: NextRequest): string | null {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip')?.trim() || null;
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === LOGIN || pathname.startsWith(`${LOGIN}/`);
  const isRecoveryPage =
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/auth/update-password' ||
    pathname.startsWith('/auth/update-password/') ||
    pathname === '/auth/error' ||
    pathname.startsWith('/auth/error/');
  const isApi = pathname.startsWith('/api/');
  const isPublic = isLoginPage || isRecoveryPage || pathname.startsWith('/_next') || isApi;

  if (!user && !isPublic) {
    const u = request.nextUrl.clone();
    u.pathname = LOGIN;
    u.searchParams.set('next', pathname + (request.nextUrl.search || ''));
    return NextResponse.redirect(u);
  }

  if (user && isLoginPage) {
    const gateErr = request.nextUrl.searchParams.get('error');
    if (!gateErr) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return supabaseResponse;
  }

  /* Page mot de passe oublié (clients / deep link web) — pas de gate admin */
  if (isRecoveryPage) {
    return supabaseResponse;
  }

  if (user) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      try {
        const sbAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const payload = await loadGatePayload(sbAdmin);
        const applyHourlyRateLimit = isApi;
        const decision = await evaluateAdminGate({
          sb: sbAdmin,
          user,
          request,
          payload,
          applyHourlyRateLimit,
        });

        if (!decision.ok) {
          if (decision.code === 'IP_NOT_WHITELISTED') {
            const ip = extractIp(request);
            if (ip) {
              const profile = await sbAdmin.from('profiles').select('role,email').eq('id', user.id).maybeSingle();
              const role = String(profile.data?.role || '');
              const email = String(profile.data?.email || user.email || '');
              const trustedEmail = String(process.env.ADMIN_NOTIFICATION_EMAIL || '').trim().toLowerCase();
              const canRecover =
                role === 'superadmin' ||
                role === 'super_admin' ||
                (trustedEmail && email.toLowerCase() === trustedEmail);
              if (canRecover) {
                const cur = await sbAdmin.from('settings').select('value').eq('key', 'security_access').maybeSingle();
                const v = (cur.data?.value || {}) as Record<string, unknown>;
                const existing = Array.isArray(v.emergency_allowlist_ips)
                  ? v.emergency_allowlist_ips.map((x) => String(x))
                  : [];
                if (!existing.includes(ip)) {
                  await sbAdmin.from('settings').upsert(
                    {
                      key: 'security_access',
                      value: { ...v, emergency_allowlist_ips: [...existing, ip], emergency_recovery_at: new Date().toISOString() },
                    },
                    { onConflict: 'key' },
                  );
                }
                return NextResponse.next({ request });
              }
            }
          }
          if (isApi) {
            return NextResponse.json(
              { error: decision.message, code: decision.code },
              { status: decision.status },
            );
          }
          const nextUrl = request.nextUrl.clone();
          nextUrl.pathname = LOGIN;
          nextUrl.searchParams.set('error', decision.code.toLowerCase());
          nextUrl.searchParams.set('reason', decision.message);
          return NextResponse.redirect(nextUrl);
        }
      } catch {
        /* ne pas bloquer le site si lecture settings échoue */
      }
    }
  }

  /* Matrice permissions pages (settings.admin_permissions_<id>) — superadmin : tout. */
  if (user && !isApi && pathname !== '/403' && !isLoginPage && !isRecoveryPage) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && supabaseUrl) {
      const metaRole =
        (user.user_metadata as { role?: string } | undefined)?.role ||
        (user.app_metadata as { role?: string } | undefined)?.role;
      let isSuper = metaRole === 'superadmin' || metaRole === 'super_admin';

      const cached = permCached(user.id);
      let matrix: PermMatrix = null;
      if (cached) {
        isSuper = cached.isSuper;
        matrix = cached.matrix;
      } else {
        const sb = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
        const role = String(prof?.role || '').toLowerCase();
        isSuper = role === 'superadmin' || role === 'super_admin';
        if (!isSuper) {
          const { data: row } = await sb
            .from('settings')
            .select('value')
            .eq('key', `admin_permissions_${user.id}`)
            .maybeSingle();
          const v = row?.value;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            matrix = v as Record<string, Record<string, boolean>>;
          }
        }
        permSet(user.id, { isSuper, matrix });
      }

      if (!isSuper) {
        if (pathname === '/' || pathname === '/dashboard') {
          return supabaseResponse;
        }
        for (const rule of ROUTE_RULES) {
          if (rule.test(pathname)) {
            if (!matrixAllows(matrix, rule.scope)) {
              const denied = request.nextUrl.clone();
              denied.pathname = '/403';
              denied.searchParams.set('from', pathname);
              return NextResponse.redirect(denied);
            }
            break;
          }
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
