import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    admin_response: z.string().min(1).max(4000).optional(),
    moderation_status: z.enum(['approved', 'pending', 'rejected']).optional(),
  })
  .refine((b) => b.admin_response !== undefined || b.moderation_status !== undefined, {
    message: 'Au moins un champ requis',
  });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.admin_response !== undefined) {
    updates.admin_response = parsed.data.admin_response;
    updates.admin_response_at = new Date().toISOString();
    updates.moderated_by = auth.userId;
    updates.moderation_status = 'approved';
  }
  if (parsed.data.moderation_status !== undefined) {
    updates.moderation_status = parsed.data.moderation_status;
    updates.moderated_by = auth.userId;
  }

  const { data, error } = await sb.from('reviews').update(updates).eq('id', id).select('id').single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'update',
    entityType: 'review',
    entityId: id,
    description: 'Réponse admin sur avis',
    changes: { after: updates as unknown as Record<string, unknown> },
  });

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { error } = await sb.from('reviews').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
