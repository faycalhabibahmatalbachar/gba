import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { loadUserSessionRows } from '@/app/api/users/_lib/user-sessions';

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

    const sessions = await loadUserSessionRows(sb, id);
    const active = sessions.filter((s) => !s.revoked_at);
    const history = sessions;

    return NextResponse.json({ active, history });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
