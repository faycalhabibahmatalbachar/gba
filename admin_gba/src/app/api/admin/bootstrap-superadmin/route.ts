import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

/**
 * Bootstrap sécurisé: autorisé uniquement si aucun superadmin n'existe encore.
 * Promote l'admin courant en superadmin.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data: existing } = await sb
    .from('profiles')
    .select('id', { count: 'exact' })
    .in('role', ['superadmin', 'super_admin'])
    .limit(1);
  if ((existing || []).length > 0) {
    return NextResponse.json(
      { error: 'Un super-administrateur existe déjà. Action refusée.', code: 'SUPERADMIN_EXISTS' },
      { status: 403 },
    );
  }

  const { error } = await sb
    .from('profiles')
    .update({
      role: 'superadmin',
      is_suspended: false,
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
    })
    .eq('id', auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: authErr } = await sb.auth.admin.updateUserById(auth.userId, {
    app_metadata: { role: 'superadmin' },
  });
  const authWarning = authErr?.message;

  const actorRole = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole,
    actionType: 'permission_change',
    entityType: 'user',
    entityId: auth.userId,
    description: 'Bootstrap superadmin (premier compte)',
    status: 'success',
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    message: authWarning
      ? `Profil superadmin enregistré. Métadonnées Auth: ${authWarning} — vérifiez les droits service_role.`
      : 'Compte promu superadmin (profil + JWT). Reconnectez-vous pour rafraîchir la session.',
    auth_metadata_updated: !authWarning,
  });
}

