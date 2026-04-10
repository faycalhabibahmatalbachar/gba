import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { getConnectionScheduleDenialMessage } from '@/lib/security/connection-schedule';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const sb = getServiceSupabase();
    const msg = await getConnectionScheduleDenialMessage(sb, auth.email);
    if (msg) return NextResponse.json({ allowed: false, error: msg });
    return NextResponse.json({ allowed: true });
  } catch {
    return NextResponse.json({ allowed: true });
  }
}
