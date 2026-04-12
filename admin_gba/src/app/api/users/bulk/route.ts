import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(80),
  action: z.enum(['suspend', 'reactivate', 'delete']),
  suspension_reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 422 });
  }

  const { user_ids, action, suspension_reason } = parsedBody.data;

  const auth =
    action === 'delete' ? await requireSuperAdmin() : await requireAdminPermission('users', 'update');
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const actorId = auth.userId;

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, email, role')
    .in('id', user_ids);

  const rows = profiles || [];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Aucun profil trouvé pour les identifiants fournis' }, { status: 404 });
  }

  const errors: string[] = [];
  let ok = 0;

  for (const row of rows) {
    const id = String(row.id);
    if (id === actorId) {
      errors.push(`${id}: action impossible sur votre propre compte`);
      continue;
    }
    const role = String(row.role || '').toLowerCase();
    if (['admin', 'superadmin', 'super_admin'].includes(role)) {
      errors.push(`${id}: compte administrateur — gérer depuis l’onglet Admins`);
      continue;
    }

    try {
      if (action === 'suspend') {
        const { error } = await sb
          .from('profiles')
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_by: actorId,
            suspension_reason: suspension_reason?.trim() || 'Suspension lot (admin)',
          })
          .eq('id', id);
        if (error) throw error;
        ok += 1;
      } else if (action === 'reactivate') {
        const { error } = await sb
          .from('profiles')
          .update({
            is_suspended: false,
            suspended_at: null,
            suspended_by: null,
            suspension_reason: null,
          })
          .eq('id', id);
        if (error) throw error;
        ok += 1;
      } else {
        const { error: delErr } = await sb.auth.admin.deleteUser(id);
        if (delErr) throw new Error(delErr.message);
        ok += 1;
      }
    } catch (e) {
      errors.push(`${id}: ${(e as Error).message}`);
    }
  }

  const role = await fetchActorRole(actorId);
  await writeAuditLog({
    actorUserId: actorId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: action === 'delete' ? 'delete' : 'update',
    entityType: 'user',
    entityId: actorId,
    description: `Action lot utilisateurs: ${action} (${ok} réussite(s))`,
    changes: { after: { action, requested: user_ids.length, ok, errors } },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    processed: ok,
    failed: errors.length,
    errors: errors.length ? errors : undefined,
  });
}
