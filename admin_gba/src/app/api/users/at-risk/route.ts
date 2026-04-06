import { NextResponse } from 'next/server';
import { subDays } from 'date-fns';
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

  const cutoff = subDays(new Date(), 30);

  const { data: profiles, error: e1 } = await sb
    .from('profiles')
    .select('id, email, first_name, last_name, last_seen_at, created_at, role')
    .or('role.is.null,role.eq.client,role.eq.user')
    .order('last_seen_at', { ascending: true, nullsFirst: true })
    .limit(400);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const inactive30d = (profiles || []).filter((p) => {
    if (!p.last_seen_at) return true;
    return new Date(p.last_seen_at) < cutoff;
  });

  const { data: cartRows, error: e2 } = await sb
    .from('cart_items')
    .select('user_id, id, quantity, created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const abandonedCarts = (cartRows || []).filter((r: { created_at?: string }) => {
    const t = r.created_at ? new Date(r.created_at).getTime() : 0;
    return Date.now() - t > 24 * 60 * 60 * 1000;
  });

  return NextResponse.json({
    inactive30d: inactive30d.slice(0, 80),
    abandonedCarts,
  });
}
