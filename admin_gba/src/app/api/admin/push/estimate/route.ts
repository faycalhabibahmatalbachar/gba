import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { countEligibleUsers, type PushFilters } from '@/app/api/admin/push/_lib/segment-users';

export const dynamic = 'force-dynamic';

const filtersSchema = z.object({
  role: z.string().optional(),
  country: z.string().optional(),
  platform: z.enum(['ios', 'android', 'all']).optional(),
  valid_only: z.coerce.boolean().optional(),
});

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const raw = new URL(req.url).searchParams.get('filters');
  let filters: PushFilters = {};
  if (raw) {
    try {
      const j = JSON.parse(raw) as unknown;
      const p = filtersSchema.safeParse(j);
      if (p.success) filters = p.data;
    } catch {
      return NextResponse.json({ error: 'filters JSON invalide' }, { status: 400 });
    }
  }

  try {
    const count = await countEligibleUsers(sb, filters);
    return NextResponse.json({ data: { count } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
