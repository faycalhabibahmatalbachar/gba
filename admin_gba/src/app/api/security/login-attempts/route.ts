import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { emitAdminNotification } from '@/lib/email/notification-dispatcher';
import { writeAuditLog } from '@/lib/audit/server-audit';
import { labelIpKind } from '@/lib/security/ip-present';

export const dynamic = 'force-dynamic';

function extractIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || null;
  return req.headers.get('x-real-ip')?.trim() || null;
}

export async function GET(req: Request) {
  const auth = await requireSuperAdmin();
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

    const ipSeen = new Set<string>();
    const humanized = rows.map((r) => {
      const ip = String((r as { ip_address?: string | null }).ip_address || '');
      const kind = labelIpKind(ip);
      const key = ip || 'none';
      const firstSeen = !ipSeen.has(key);
      ipSeen.add(key);
      const success = Boolean((r as { success?: boolean }).success);
      return {
        ...r,
        result_human: success ? '✓ Connexion réussie' : '✗ Identifiants invalides',
        ip_label: kind.label,
        ip_is_unusual: firstSeen && kind.kind === 'public',
      };
    });
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actionType: 'view',
      entityType: 'report',
      entityId: 'security_login_attempts',
      description: 'Consultation tentatives de connexion',
    });
    return NextResponse.json({ data: humanized, source: hist.data?.length ? 'admin_login_history' : 'audit_logs' });
  } catch (e) {
    const msg = String((e as Error).message);
    const isNet = /fetch failed|timeout|timed out|connect/i.test(msg);
    return NextResponse.json({ error: msg, code: isNet ? 'SUPABASE_CONNECTIVITY' : 'INTERNAL' }, { status: isNet ? 503 : 500 });
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

  if (error) {
    const msg = error.message || 'Erreur';
    const isNet = /timeout|timed out|connect|fetch failed/i.test(msg);
    return NextResponse.json({ error: msg, code: isNet ? 'SUPABASE_CONNECTIVITY' : 'DB_ERROR' }, { status: isNet ? 503 : 500 });
  }

  if (!success && email) {
    const at = new Date().toISOString();
    void emitAdminNotification({
      type: 'security_alert',
      entityId: `login_fail:${email}:${ip || 'unknown'}`,
      payload: {
        headline: 'Échec de connexion admin',
        detail: `Tentative pour ${email}.`,
        meta: `IP: ${ip || '—'} · UA: ${userAgent || '—'} · ${at}`,
      },
      priority: 'normal',
    });
  }

  return NextResponse.json({ ok: true, reason: body.reason ?? null });
}
