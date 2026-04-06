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
    return NextResponse.json({ error: 'Service role missing' }, { status: 503 });
  }

  const { data: profile } = await sb.from('profiles').select('role, first_name, last_name').eq('id', auth.userId).maybeSingle();
  const role = profile?.role ?? 'admin';
  const isSuperAdmin = role === 'superadmin' || role === 'super_admin';

  return NextResponse.json({
    userId: auth.userId,
    email: auth.email,
    role,
    isSuperAdmin,
  });
}
