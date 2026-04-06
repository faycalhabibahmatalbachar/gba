import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  is_valid: z.boolean(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; tokenId: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: userId, tokenId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data: before } = await sb
    .from('device_tokens')
    .select('id, user_id, is_valid')
    .eq('id', tokenId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!before) return NextResponse.json({ error: 'Token introuvable' }, { status: 404 });

  const { data: after, error } = await sb
    .from('device_tokens')
    .update({ is_valid: parsed.data.is_valid, updated_at: new Date().toISOString() })
    .eq('id', tokenId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'update',
    entityType: 'user',
    entityId: userId,
    description: 'Mise à jour device token',
    changes: { before: before as Record<string, unknown>, after: after as Record<string, unknown> },
    metadata: { device_token_id: tokenId },
  });

  return NextResponse.json({ ok: true, data: after });
}
