import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { runSegmentCampaign } from '@/app/api/admin/push/_lib/run-segment-campaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const filtersSchema = z.object({
  role: z.string().optional(),
  country: z.string().optional(),
  platform: z.enum(['ios', 'android', 'all']).optional(),
  valid_only: z.boolean().optional(),
});

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional().nullable(),
  data: z.record(z.string(), z.string()).optional(),
  filters: filtersSchema.optional().default({}),
  scheduledAt: z.string().datetime().optional().nullable(),
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
    return NextResponse.json({ error: 'Validation', details: parsed.error.flatten() }, { status: 422 });
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

  const { title, body: msgBody, imageUrl, data, filters, scheduledAt } = parsed.data;

  try {
    const result = await runSegmentCampaign(sb, base, serviceKey, { userId: auth.userId, email: auth.email }, {
      title,
      body: msgBody,
      imageUrl,
      data,
      filters: {
        role: filters.role,
        country: filters.country,
        platform: filters.platform,
        valid_only: filters.valid_only,
      },
      scheduledAt,
    });

    return NextResponse.json({
      data: {
        job_id: result.job_id,
        estimated_devices: result.estimated_devices,
        processed_users: result.processed_users,
        capped: result.capped,
        status: result.status,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
