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
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data, error } = await sb
    .from('platform_settings')
    .select('key, value, category, description, updated_at')
    .order('category', { ascending: true });

  if (error) {
    return NextResponse.json({ data: [], grouped: {}, error: error.message }, { status: 200 });
  }

  const grouped = (data || []).reduce(
    (acc, row) => {
      const cat = row.category || 'general';
      if (!acc[cat]) acc[cat] = {};
      acc[cat][row.key] = row.value;
      return acc;
    },
    {} as Record<string, Record<string, unknown>>,
  );

  return NextResponse.json({ data: data ?? [], grouped });
}
