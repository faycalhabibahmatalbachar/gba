import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const PAGE = 20;

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

  try {
    let q = sb
      .from('push_campaigns')
      .select(
        'id, title, body, image_url, status, target_filter, sent_count, delivered_count, failed_count, total_targeted, created_at, scheduled_at, completed_at, created_by, error_detail',
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE + 1);

    if (cursor) {
      q = q.or(`created_at.lt.${cursor.c},and(created_at.eq.${cursor.c},id.lt.${cursor.i})`);
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    let list = rows || [];
    const hasMore = list.length > PAGE;
    if (hasMore) list = list.slice(0, PAGE);
    const last = list[list.length - 1] as { created_at?: string; id?: string } | undefined;
    const nextCursor =
      hasMore && last?.created_at && last?.id
        ? Buffer.from(JSON.stringify({ c: last.created_at, i: last.id }), 'utf8').toString('base64url')
        : null;

    return NextResponse.json({ data: { campaigns: list, nextCursor } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
