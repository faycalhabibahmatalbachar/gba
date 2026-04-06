import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { countEligibleUsers, type PushFilters } from '@/app/api/admin/push/_lib/segment-users';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { pushFiltersSchema } from '@/app/api/notifications/_lib/push-filters-schema';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  filters: pushFiltersSchema.default({}),
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
      .from('notification_segments')
      .select('id, name, description, filters, estimated_devices, last_estimated_at, created_at, created_by')
      .order('created_at', { ascending: false });

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

  const filters = parsed.data.filters as PushFilters;
  const now = new Date().toISOString();

  try {
    const estimated = await countEligibleUsers(sb, filters);

    const { data, error } = await sb
      .from('notification_segments')
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        filters: filters as Record<string, unknown>,
        estimated_devices: estimated,
        last_estimated_at: now,
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
      description: `Segment notification: ${parsed.data.name}`,
    });

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
