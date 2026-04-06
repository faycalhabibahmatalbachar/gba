import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  permissions: z.record(z.string(), z.record(z.string(), z.boolean())),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ roleId: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { roleId: userId } = await ctx.params;
  if (!z.string().uuid().safeParse(userId).success) {
    return NextResponse.json({ error: 'UUID invalide' }, { status: 400 });
  }

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

  try {
    const { data: before } = await sb.from('settings').select('value').eq('key', `admin_permissions_${userId}`).maybeSingle();

    await sb.from('settings').upsert(
      {
        key: `admin_permissions_${userId}`,
        value: parsed.data.permissions,
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
      },
      { onConflict: 'key' },
    );

    const actorRole = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: actorRole,
      actionType: 'update',
      entityType: 'role',
      entityId: userId,
      changes: {
        before: { permissions: before?.value },
        after: { permissions: parsed.data.permissions },
      },
      description: 'Mise à jour permissions admin',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
