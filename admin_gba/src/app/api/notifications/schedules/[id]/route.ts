import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { pushFiltersSchema } from '@/app/api/notifications/_lib/push-filters-schema';
import { computeNextScheduleRun, normalizePgTime } from '@/app/api/notifications/_lib/compute-next-schedule-run';

export const dynamic = 'force-dynamic';

const timeRe = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(2000).optional(),
  image_url: z.string().url().nullable().optional(),
  filters: pushFiltersSchema.optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  day_of_week: z.number().int().min(1).max(7).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  send_time: z.string().regex(timeRe).optional(),
  recipient_emails: z.array(z.string().email()).optional(),
  format: z.enum(['push']).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { data: existing, error: exErr } = await sb
    .from('push_notification_schedules')
    .select(
      'frequency, day_of_week, day_of_month, send_time, active',
    )
    .eq('id', id)
    .maybeSingle();

  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const upd: Record<string, unknown> = { ...parsed.data };
  Object.keys(upd).forEach((k) => upd[k] === undefined && delete upd[k]);

  const freq = (parsed.data.frequency ?? existing.frequency) as 'daily' | 'weekly' | 'monthly';
  const stRaw = parsed.data.send_time ?? String(existing.send_time ?? '09:00:00');
  const st = normalizePgTime(stRaw);
  const dow = parsed.data.day_of_week ?? existing.day_of_week;
  const dom = parsed.data.day_of_month ?? existing.day_of_month;

  const scheduleChanged =
    parsed.data.frequency !== undefined ||
    parsed.data.send_time !== undefined ||
    parsed.data.day_of_week !== undefined ||
    parsed.data.day_of_month !== undefined;

  if (scheduleChanged && (parsed.data.active !== false)) {
    upd.next_run_at = computeNextScheduleRun(freq, st, new Date(), {
      frDayOfWeek: dow as number | null,
      dayOfMonth: dom as number | null,
    }).toISOString();
  }
  if (parsed.data.send_time !== undefined) upd.send_time = st;

  if (Object.keys(upd).length === 0) {
    return NextResponse.json({ data: { ok: true } });
  }

  try {
    const { error } = await sb.from('push_notification_schedules').update(upd).eq('id', id);
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'update',
      entityType: 'notification',
      entityId: id,
      description: 'Mise à jour planification push',
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { error } = await sb.from('push_notification_schedules').delete().eq('id', id);
    if (error) throw error;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'delete',
      entityType: 'notification',
      entityId: id,
      description: 'Suppression planification push',
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
