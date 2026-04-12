import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 40));
  const cursor = searchParams.get('cursor');
  const action = searchParams.get('action')?.trim();
  const entity = searchParams.get('entity')?.trim();

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: profile } = await sb.from('profiles').select('role').eq('id', id).maybeSingle();
    const r = String(profile?.role || '').toLowerCase();
    if (!['admin', 'superadmin', 'super_admin'].includes(r)) {
      return NextResponse.json({ error: 'Profil admin requis' }, { status: 400 });
    }

    let q = sb
      .from('audit_logs')
      .select(
        'id, created_at, action_type, entity_type, entity_id, entity_name, action_description, changes, metadata, status, error_message, user_email',
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (action) q = q.eq('action_type', action);
    if (entity) q = q.eq('entity_type', entity);
    if (cursor) {
      q = q.lt('created_at', cursor);
    }

    const { data: rows, error } = await q;
    if (error) throw error;
    const list = (rows || []) as Record<string, unknown>[];
    const hasMore = list.length > limit;
    const slice = hasMore ? list.slice(0, limit) : list;
    const next_cursor = hasMore && slice.length ? String(slice[slice.length - 1].created_at) : null;

    return NextResponse.json({ items: slice, next_cursor });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
