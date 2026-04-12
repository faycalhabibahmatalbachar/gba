import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

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

    const { data: rows, error } = await sb
      .from('admin_login_history')
      .select('id, created_at, success, ip_address, user_agent')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ items: rows || [] });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
