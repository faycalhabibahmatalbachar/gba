import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export type SuperAdminAuthResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: NextResponse };

/**
 * Vérifie que l'appelant est superadmin (JWT metadata ou profiles.role).
 */
export async function requireSuperAdmin(): Promise<SuperAdminAuthResult> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Server misconfigured: Supabase env missing' }, { status: 500 }),
    };
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* read-only */
        }
      },
    },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    const msg = authErr?.message || 'Unauthorized';
    if (/fetch failed|timeout|timed out|connect/i.test(msg)) {
      return { ok: false, response: NextResponse.json({ error: 'Supabase indisponible', code: 'SUPABASE_CONNECTIVITY' }, { status: 503 }) };
    }
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const metaRole =
    (user.user_metadata as { role?: string } | undefined)?.role ||
    (user.app_metadata as { role?: string } | undefined)?.role;

  if (metaRole === 'superadmin' || metaRole === 'super_admin') {
    return { ok: true, userId: user.id, email: user.email ?? null };
  }

  try {
    const sb = getServiceSupabase();
    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const r = profile?.role;
    if (r === 'superadmin' || r === 'super_admin') {
      return { ok: true, userId: user.id, email: user.email ?? null };
    }
  } catch {
    /* fallthrough */
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Accès réservé aux super-administrateurs.', code: 'SUPERADMIN_ONLY' },
      { status: 403 },
    ),
  };
}
