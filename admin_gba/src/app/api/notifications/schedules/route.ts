import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { pushFiltersSchema } from '@/app/api/notifications/_lib/push-filters-schema';
import { computeNextScheduleRun, normalizePgTime } from '@/app/api/notifications/_lib/compute-next-schedule-run';

export const dynamic = 'force-dynamic';

const timeRe = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const postSchema = z
  .object({
    name: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
    image_url: z.string().url().nullable().optional(),
    filters: pushFiltersSchema.default({}),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    day_of_week: z.number().int().min(1).max(7).nullable().optional(),
    day_of_month: z.number().int().min(1).max(31).nullable().optional(),
    send_time: z.string().regex(timeRe),
    recipient_emails: z.array(z.string().email()).default([]),
    format: z.enum(['push']).default('push'),
    active: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    if (val.frequency === 'weekly' && (val.day_of_week == null || val.day_of_week < 1)) {
      ctx.addIssue({ code: 'custom', message: 'day_of_week requis (1–7) pour hebdomadaire', path: ['day_of_week'] });
    }
    if (val.frequency === 'monthly' && (val.day_of_month == null || val.day_of_month < 1)) {
      ctx.addIssue({ code: 'custom', message: 'day_of_month requis (1–31) pour mensuel', path: ['day_of_month'] });
    }
  });

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data, error } = await sb
      .from('push_notification_schedules')
      .select(
        'id, name, title, body, image_url, filters, frequency, day_of_week, day_of_month, send_time, recipient_emails, format, active, next_run_at, last_run_at, created_at, created_by',
      )
      .order('next_run_at', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const st = normalizePgTime(parsed.data.send_time);
  const next = computeNextScheduleRun(parsed.data.frequency, st, new Date(), {
    frDayOfWeek: parsed.data.frequency === 'weekly' ? (parsed.data.day_of_week ?? 1) : null,
    dayOfMonth: parsed.data.frequency === 'monthly' ? (parsed.data.day_of_month ?? 1) : null,
  });

  try {
    const { data, error } = await sb
      .from('push_notification_schedules')
      .insert({
        name: parsed.data.name,
        title: parsed.data.title,
        body: parsed.data.body,
        image_url: parsed.data.image_url ?? null,
        filters: parsed.data.filters as Record<string, unknown>,
        frequency: parsed.data.frequency,
        day_of_week: parsed.data.frequency === 'weekly' ? (parsed.data.day_of_week ?? 1) : null,
        day_of_month: parsed.data.frequency === 'monthly' ? (parsed.data.day_of_month ?? 1) : null,
        send_time: st,
        recipient_emails: parsed.data.recipient_emails,
        format: parsed.data.format,
        active: parsed.data.active,
        next_run_at: next.toISOString(),
        created_by: auth.userId,
      })
      .select('id')
      .single();

    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'notification',
      entityId: data?.id,
      description: `Planification push: ${parsed.data.name}`,
    });

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
