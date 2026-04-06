import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

function esc(s: string) {
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
  const role = searchParams.get('role') || 'all';
  const q = searchParams.get('q')?.trim() || '';

  const { data: profiles, error } = await sb
    .from('profiles')
    .select(
      'id, email, first_name, last_name, phone, role, city, is_suspended, last_seen_at, created_at, loyalty_points',
    )
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = profiles || [];
  if (role !== 'all') {
    if (role === 'client' || role === 'user') {
      rows = rows.filter((r: { role?: string | null }) => !r.role || r.role === 'client' || r.role === 'user');
    } else {
      rows = rows.filter((r: { role?: string | null }) => r.role === role);
    }
  }
  if (q) {
    const ql = q.toLowerCase();
    rows = rows.filter(
      (r: { email?: string; first_name?: string; last_name?: string; phone?: string; id: string }) =>
        r.id.toLowerCase().includes(ql) ||
        (r.email || '').toLowerCase().includes(ql) ||
        (r.first_name || '').toLowerCase().includes(ql) ||
        (r.last_name || '').toLowerCase().includes(ql) ||
        (r.phone || '').toLowerCase().includes(ql),
    );
  }

  const ids = rows.map((r: { id: string }) => r.id);
  const spentMap: Record<string, number> = {};
  const orderCountMap: Record<string, number> = {};
  if (ids.length) {
    const { data: ords } = await sb.from('orders').select('user_id, total_amount').in('user_id', ids).limit(50000);
    for (const o of ords || []) {
      const u = (o as { user_id: string }).user_id;
      orderCountMap[u] = (orderCountMap[u] || 0) + 1;
      spentMap[u] = (spentMap[u] || 0) + Number((o as { total_amount: number | null }).total_amount || 0);
    }
  }

  const tokCounts: Record<string, number> = {};
  if (ids.length) {
    const { data: toks } = await sb.from('device_tokens').select('user_id').in('user_id', ids);
    for (const t of toks || []) {
      const u = (t as { user_id: string }).user_id;
      tokCounts[u] = (tokCounts[u] || 0) + 1;
    }
  }

  const header = [
    'id',
    'email',
    'first_name',
    'last_name',
    'phone',
    'role',
    'city',
    'is_suspended',
    'loyalty_points',
    'orders_count',
    'total_spent',
    'device_tokens_count',
    'last_seen_at',
    'created_at',
  ];
  const lines = [header.join(',')];
  for (const r of rows as Record<string, unknown>[]) {
    const id = String(r.id);
    lines.push(
      [
        esc(id),
        esc(String(r.email ?? '')),
        esc(String(r.first_name ?? '')),
        esc(String(r.last_name ?? '')),
        esc(String(r.phone ?? '')),
        esc(String(r.role ?? '')),
        esc(String(r.city ?? '')),
        String(r.is_suspended ? 'true' : 'false'),
        String(r.loyalty_points ?? 0),
        String(orderCountMap[id] || 0),
        String(spentMap[id] || 0),
        String(tokCounts[id] || 0),
        esc(String(r.last_seen_at ?? '')),
        esc(String(r.created_at ?? '')),
      ].join(','),
    );
  }

  const csv = lines.join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
