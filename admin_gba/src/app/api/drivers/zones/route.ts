import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const geoJsonSchema = z.object({
  type: z.string(),
}).passthrough();

const postSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().max(32).optional().default('#6C47FF'),
  geojson: geoJsonSchema,
  is_active: z.boolean().optional().default(true),
});

export async function GET() {
  const auth = await requireAdminPermission('drivers', 'read');
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data, error } = await sb
      .from('delivery_zones')
      .select('id, name, color, geojson, is_active, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminPermission('drivers', 'create');
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

  try {
    const { data, error } = await sb
      .from('delivery_zones')
      .insert({
        name: parsed.data.name,
        color: parsed.data.color,
        geojson: parsed.data.geojson as Record<string, unknown>,
        is_active: parsed.data.is_active,
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
      entityType: 'delivery',
      entityId: data?.id,
      description: `Zone livraison: ${parsed.data.name}`,
    });

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
