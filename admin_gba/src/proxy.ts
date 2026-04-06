import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { evaluateAdminGate, loadGatePayload } from '@/lib/security/admin-middleware-gate';

const LOGIN = '/login';

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
  const isApi = pathname.startsWith('/api/');
  const isPublic = isLoginPage || pathname.startsWith('/_next') || isApi;

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

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
