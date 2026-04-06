import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const PAGE = 50;

function decodeCursor(s: string | null): { c: string; i: string } | null {
  if (!s) return null;
  try {
    const j = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { c?: string; i?: string };
    if (j.c && j.i) return { c: j.c, i: j.i };
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = decodeCursor(searchParams.get('cursor'));
  const platform = searchParams.get('platform')?.trim();

  try {
    let q = sb
      .from('device_tokens')
      .select(
        'id, user_id, token, platform, device_model, locale, last_seen_at, last_active_at, is_valid, created_at',
      )
      .order('last_seen_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE + 1);

    if (platform) q = q.ilike('platform', `%${platform}%`);
    if (cursor) {
      q = q.or(`last_seen_at.lt.${cursor.c},and(last_seen_at.eq.${cursor.c},id.lt.${cursor.i})`);
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    let list = rows || [];
    const hasMore = list.length > PAGE;
    if (hasMore) list = list.slice(0, PAGE);

    const uids = [...new Set(list.map((r: { user_id: string }) => r.user_id))];
    const pmap = new Map<string, { first_name?: string; last_name?: string; email?: string; role?: string }>();

    if (uids.length > 0) {
      const { data: profs, error: pe } = await sb
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .in('id', uids);
      if (!pe && profs) {
        for (const p of profs as { id: string; first_name?: string; last_name?: string; email?: string; role?: string }[]) {
          pmap.set(p.id, p);
        }
      }
    }

    const enriched = list.map((r: Record<string, unknown>) => {
      const pr = pmap.get(String(r.user_id));
      const name = pr ? [pr.first_name, pr.last_name].filter(Boolean).join(' ') || pr.email || '—' : '—';
      const tok = String(r.token || '');
      return {
        id: r.id,
        user_id: r.user_id,
        contact_name: name,
        contact_email: pr?.email ?? null,
        role: pr?.role ?? null,
        platform: r.platform,
        token_preview: tok.length > 14 ? `${tok.slice(0, 12)}…` : tok,
        device_model: r.device_model,
        last_seen_at: r.last_seen_at,
        last_active_at: r.last_active_at,
        is_valid: r.is_valid,
        created_at: r.created_at,
      };
    });

    const last = list[list.length - 1] as { last_seen_at?: string; id?: string } | undefined;
    const nextCursor =
      hasMore && last?.last_seen_at && last?.id
        ? Buffer.from(JSON.stringify({ c: last.last_seen_at, i: last.id }), 'utf8').toString('base64url')
        : null;

    const { count: total } = await sb.from('device_tokens').select('id', { count: 'exact', head: true });
    const { count: valid } = await sb
      .from('device_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('is_valid', true);

    return NextResponse.json({
      data: { rows: enriched, nextCursor, kpis: { total: total ?? 0, valid: valid ?? 0 } },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
