import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['promotional', 'transactional', 'alert', 'system']).default('transactional'),
  title_template: z.string().min(1).max(200),
  body_template: z.string().min(1).max(2000),
  image_url: z.string().url().optional().nullable(),
  variables: z.array(z.string()).optional().default([]),
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
      .from('push_templates')
      .select(
        'id, name, category, title_template, body_template, image_url, data_json, variables, last_used_at, created_at, updated_at',
      )
      .order('updated_at', { ascending: false });

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

  try {
    const { data, error } = await sb
      .from('push_templates')
      .insert({
        name: parsed.data.name,
        category: parsed.data.category,
        title_template: parsed.data.title_template,
        body_template: parsed.data.body_template,
        image_url: parsed.data.image_url ?? null,
        variables: parsed.data.variables,
        data_json: {},
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
      description: `Template push: ${parsed.data.name}`,
    });

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
