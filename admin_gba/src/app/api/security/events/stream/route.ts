import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { humanizeAuditEvent } from '@/lib/security/humanize-audit-event';

export const dynamic = 'force-dynamic';

const PAGE = 50;

export async function GET(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor')?.trim();

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    let q = sb
      .from('audit_logs')
      .select(
        'id, created_at, user_email, action_type, entity_type, entity_id, entity_name, action_description, status, metadata',
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE + 1);

    if (cursor) {
      try {
        const j = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { c?: string; i?: string };
        if (j.c && j.i) {
          q = q.or(`created_at.lt.${j.c},and(created_at.eq.${j.c},id.lt.${j.i})`);
        }
      } catch {
        /* ignore */
      }
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    let list = (rows || []) as Record<string, unknown>[];
    const hasMore = list.length > PAGE;
    if (hasMore) list = list.slice(0, PAGE);
    const last = list[list.length - 1] as { created_at?: string; id?: string } | undefined;
    const nextCursor =
      hasMore && last?.created_at && last?.id
        ? Buffer.from(JSON.stringify({ c: last.created_at, i: last.id }), 'utf8').toString('base64url')
        : null;

    const data = list.map((r) => {
      const human_label = humanizeAuditEvent({
        action_type: String(r.action_type || ''),
        entity_type: String(r.entity_type || ''),
        entity_name: r.entity_name as string | null,
        entity_id: r.entity_id as string | null,
        user_email: r.user_email as string | null,
        action_description: r.action_description as string | null,
        status: r.status as string | null,
        created_at: r.created_at as string | null,
      });
      return {
        id: r.id,
        created_at: r.created_at,
        human_label,
        action_type: r.action_type,
        entity_type: r.entity_type,
        user_email: r.user_email,
        status: r.status,
      };
    });

    return NextResponse.json({ data, nextCursor });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
