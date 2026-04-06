import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

function esc(s: string) {
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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
    .from('orders')
    .select(
      'id, order_number, created_at, status, total_amount, user_id, customer_name, shipping_city, shipping_country, payment_provider',
    )
    .order('created_at', { ascending: false })
    .limit(8000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    'id',
    'order_number',
    'created_at',
    'status',
    'total_amount',
    'user_id',
    'customer_name',
    'shipping_city',
    'shipping_country',
    'payment_provider',
  ];
  const lines = [header.join(',')];
  for (const r of data || []) {
    const row = r as Record<string, unknown>;
    lines.push(
      [
        esc(String(row.id)),
        esc(String(row.order_number ?? '')),
        esc(String(row.created_at ?? '')),
        esc(String(row.status ?? '')),
        String(row.total_amount ?? ''),
        esc(String(row.user_id ?? '')),
        esc(String(row.customer_name ?? '')),
        esc(String(row.shipping_city ?? '')),
        esc(String(row.shipping_country ?? '')),
        esc(String(row.payment_provider ?? '')),
      ].join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
