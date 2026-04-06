import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 20));

  if (q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    let query = sb.from('profiles').select('id, email, first_name, last_name, role').limit(limit);
    if (/^[0-9a-f-]{36}$/i.test(q)) query = query.eq('id', q);
    else query = query.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
