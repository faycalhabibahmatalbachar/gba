import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { normalizeAuditRow } from '@/lib/audit/normalize-audit-row';
import { applyAuditLogFilters } from '@/app/api/audit/_lib/apply-filters';

export const dynamic = 'force-dynamic';

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
  const actorId = searchParams.get('actor_id')?.trim();
  const status = searchParams.get('status')?.trim();
  const from = searchParams.get('from')?.trim();
  const to = searchParams.get('to')?.trim();
  const ip = searchParams.get('ip')?.trim();

  const cursor = searchParams.get('cursor');
  const paginateCursor = searchParams.get('paginate') === 'cursor';

  const filterPayload = { entityType, entityId, actionType, actorId, status, from, to, ip };

  try {
    if (paginateCursor) {
      let q = sb
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(101);

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
      const hasMore = list.length > 100;
      if (hasMore) list = list.slice(0, 100);
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

      const normalized = list.map(normalizeAuditRow);

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

    const normalized = ((rows || []) as Record<string, unknown>[]).map(normalizeAuditRow);

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
