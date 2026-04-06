import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { runSegmentCampaign } from '@/app/api/admin/push/_lib/run-segment-campaign';
import type { PushFilters } from '@/app/api/admin/push/_lib/segment-users';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  campaign_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) {
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 503 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { data: row, error } = await sb
    .from('push_campaigns')
    .select('title, body, image_url, target_filter, metadata')
    .eq('id', parsed.data.campaign_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 });

  const f = (row.target_filter || {}) as Record<string, unknown>;
  const filters: PushFilters = {
    role: typeof f.role === 'string' ? f.role : undefined,
    country: typeof f.country === 'string' ? f.country : undefined,
    platform: (f.platform as PushFilters['platform']) || undefined,
    valid_only: typeof f.valid_only === 'boolean' ? f.valid_only : undefined,
  };
  const meta = (row.metadata || {}) as { data?: Record<string, string> };

  try {
    const result = await runSegmentCampaign(sb, base, serviceKey, { userId: auth.userId, email: auth.email }, {
      title: `${String(row.title)} (relance)`,
      body: String(row.body || ''),
      imageUrl: row.image_url,
      data: meta.data,
      filters,
      scheduledAt: null,
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
