import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { data, error } = await sb
    .from('drivers')
    .select('id, user_id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uids = (data || []).map((d) => d.user_id).filter(Boolean) as string[];
  const { data: profs } = uids.length
    ? await sb.from('profiles').select('id, first_name, last_name').in('id', uids)
    : { data: [] as { id: string; first_name?: string | null; last_name?: string | null }[] };
  const pMap = new Map((profs || []).map((p) => [p.id, p]));

  const items = (data || []).map((d) => {
    const p = pMap.get(d.user_id || '');
    const label =
      [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
      d.name ||
      String(d.user_id).slice(0, 8);
    return { driver_id: d.user_id, label };
  });
  return NextResponse.json({ data: items });
}

