import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function extractIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || null;
  return req.headers.get('x-real-ip')?.trim() || null;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(20, Number(searchParams.get('limit') || 200)));

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const hist = await sb
      .from('admin_login_history')
      .select('id, email, ip_address, success, user_agent, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    const auditFallback =
      hist.error || !(hist.data?.length)
        ? await sb
            .from('audit_logs')
            .select('id, user_email, metadata, status, created_at, action_type')
            .eq('action_type', 'login')
            .order('created_at', { ascending: false })
            .limit(limit)
        : { data: [] as Record<string, unknown>[], error: null };

    const rows =
      hist.data && hist.data.length > 0
        ? hist.data
        : (auditFallback.data || []).map((r) => {
            const m = (r.metadata || {}) as Record<string, unknown>;
            return {
              id: r.id,
              email: r.user_email,
              ip_address: m.ip,
              success: r.status === 'success',
              user_agent: m.user_agent,
              created_at: r.created_at,
              user_id: null,
            };
          });

    return NextResponse.json({ data: rows, source: hist.data?.length ? 'admin_login_history' : 'audit_logs' });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

/** Enregistre une tentative de connexion (succès / échec) côté client login. */
export async function POST(req: Request) {
  let body: {
    email?: string;
    success?: boolean;
    reason?: string | null;
    user_agent?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const email = (body.email || '').trim().toLowerCase() || null;
  const success = body.success === true;
  const userAgent = (body.user_agent || '').trim() || req.headers.get('user-agent') || null;
  const ip = extractIp(req);

  let userId: string | null = null;
  if (success) {
    try {
      const s = await createSupabaseServerClient();
      const {
        data: { user },
      } = await s.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  const { error } = await sb.from('admin_login_history').insert({
    email,
    ip_address: ip,
    success,
    user_agent: userAgent,
    user_id: userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reason: body.reason ?? null });
}
