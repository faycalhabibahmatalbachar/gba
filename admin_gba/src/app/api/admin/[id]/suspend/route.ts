import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  suspension_reason: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
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
    const { data: before } = await sb.from('profiles').select('id, role, is_suspended').eq('id', id).maybeSingle();
    if (!before) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const role = String(before.role || '').toLowerCase();
    if (role === 'superadmin' || role === 'super_admin') {
      return NextResponse.json({ error: 'Suspension interdite pour ce rôle' }, { status: 400 });
    }

    const { error } = await sb
      .from('profiles')
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by: auth.userId,
        suspension_reason: parsed.data.suspension_reason ?? 'Suspendu (centre de commandement)',
      })
      .eq('id', id);
    if (error) throw error;

    const actorRole = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: actorRole,
      actionType: 'status_change',
      entityType: 'user',
      entityId: id,
      changes: { before: { is_suspended: before.is_suspended }, after: { is_suspended: true } },
      description: 'Suspension compte admin',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
