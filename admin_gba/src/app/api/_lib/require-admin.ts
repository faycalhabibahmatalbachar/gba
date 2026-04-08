import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export type AdminAuthResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: NextResponse };

/**
 * Verifies the requester is authenticated and has admin role on profiles (or JWT metadata).
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
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
          /* ignore when read-only */
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
    const isNet = /fetch failed|timeout|timed out|connect/i.test(msg);
    if (isNet) {
      return { ok: false, response: NextResponse.json({ error: 'Supabase indisponible', code: 'SUPABASE_CONNECTIVITY' }, { status: 503 }) };
    }
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const metaRole =
    (user.user_metadata as { role?: string } | undefined)?.role ||
    (user.app_metadata as { role?: string } | undefined)?.role;

  if (metaRole === 'admin' || metaRole === 'superadmin' || metaRole === 'super_admin') {
    return { ok: true, userId: user.id, email: user.email ?? null };
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const r = profile?.role;
  const allowed = r === 'admin' || r === 'superadmin' || r === 'super_admin';
  if (profErr || !allowed) {
    if (profErr && /fetch failed|timeout|timed out|connect/i.test(profErr.message || '')) {
      return { ok: false, response: NextResponse.json({ error: 'Supabase indisponible', code: 'SUPABASE_CONNECTIVITY' }, { status: 503 }) };
    }
    return { ok: false, response: NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, email: user.email ?? null };
}
