import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAuditRow } from '@/lib/audit/normalize-audit-row';
import { applyAuditLogFilters } from '@/app/api/audit/_lib/apply-filters';

export const dynamic = 'force-dynamic';

async function attachActorProfiles(
  sb: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const ids = [
    ...new Set(
      rows
        .map((r) => r.user_id as string | undefined)
        .filter((x): x is string => typeof x === 'string' && x.length > 10),
    ),
  ];
  if (ids.length === 0) return rows;
  const { data: profs } = await sb
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, role, email')
    .in('id', ids.slice(0, 200));
  const map = new Map((profs || []).map((p) => [String((p as { id: string }).id), p as Record<string, unknown>]));
  return rows.map((r) => {
    const uid = r.user_id as string | undefined;
    const p = uid ? map.get(uid) : undefined;
    if (!p) return r;
    const fn = String(p.first_name || '').trim();
    const ln = String(p.last_name || '').trim();
    const name = [fn, ln].filter(Boolean).join(' ') || String(p.email || r.user_email || '');
    return {
      ...r,
      actor_display_name: name,
      actor_avatar_url: p.avatar_url ?? null,
      actor_profile_role: p.role ?? r.user_role,
    };
  });
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const offset = (page - 1) * limit;

  const entityType = searchParams.get('entity_type')?.trim();
  const entityId = searchParams.get('entity_id')?.trim();
  const actionType = searchParams.get('action_type')?.trim();
  const connections =
    searchParams.get('connections') === '1' || searchParams.get('connections') === 'true';
  const actorId = searchParams.get('actor_id')?.trim();
  const status = searchParams.get('status')?.trim();
  const from = searchParams.get('from')?.trim();
  const to = searchParams.get('to')?.trim();
  const ip = searchParams.get('ip')?.trim();
  const qRaw = searchParams.get('q')?.trim() ?? searchParams.get('search')?.trim();
  const search = qRaw ? qRaw.slice(0, 200) : undefined;

  const cursor = searchParams.get('cursor');
  const paginateCursor = searchParams.get('paginate') === 'cursor';

  const filterPayload = {
    entityType,
    entityId,
    actionType,
    connections: connections || null,
    actorId,
    status,
    from,
    to,
    ip,
    search,
  };

  try {
    if (paginateCursor) {
      const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
      const fetchLimit = pageSize + 1;

      let q = sb
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(fetchLimit);

      if (cursor) {
        try {
          const j = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { c?: string; i?: string };
          if (j.c && j.i) {
            q = q.or(`created_at.lt.${j.c},and(created_at.eq.${j.c},id.lt.${j.i})`);
          }
        } catch {
          /* ignore bad cursor */
        }
      }

      q = applyAuditLogFilters(q, filterPayload);

      const { data: rows, error, count } = await q;
      if (error) throw error;

      let list = (rows || []) as Record<string, unknown>[];
      const hasMore = list.length > pageSize;
      if (hasMore) list = list.slice(0, pageSize);
      const last = list[list.length - 1] as { created_at?: string; id?: string } | undefined;
      const nextCursor =
        hasMore && last?.created_at && last?.id
          ? Buffer.from(JSON.stringify({ c: last.created_at, i: last.id }), 'utf8').toString('base64url')
          : null;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayCount } = await sb
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());
      const { count: failCount } = await sb
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed');

      let normalized = list.map(normalizeAuditRow);
      normalized = await attachActorProfiles(sb, normalized);

      return NextResponse.json({
        logs: normalized,
        data: normalized,
        nextCursor,
        meta: { total: count ?? normalized.length, page: 1, limit: normalized.length },
        kpis: {
          actions_today: todayCount ?? 0,
          failures: failCount ?? 0,
        },
      });
    }

    let q = sb.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    q = applyAuditLogFilters(q, filterPayload);
    q = q.range(offset, offset + limit - 1);

    const { data: rows, error, count } = await q;
    if (error) throw error;

    let normalized = ((rows || []) as Record<string, unknown>[]).map(normalizeAuditRow);
    normalized = await attachActorProfiles(sb, normalized);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await sb
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());
    const { count: failCount } = await sb
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed');

    return NextResponse.json({
      logs: normalized,
      data: normalized,
      nextCursor: null,
      meta: { total: count ?? 0, page, limit },
      kpis: {
        actions_today: todayCount ?? 0,
        failures: failCount ?? 0,
      },
    });
  } catch (e) {
    console.error('[api/audit]', e);
    return NextResponse.json(
      { error: String((e as Error).message), data: [], logs: [], meta: { total: 0, page: 1, limit } },
      { status: 500 },
    );
  }
}
