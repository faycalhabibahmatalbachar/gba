import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

/**
 * Métadonnées uniquement — jamais les secrets bruts. La rotation réelle se fait dans Supabase / FCM / vault.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasFcm =
    Boolean(process.env.FCM_SERVER_KEY) ||
    Boolean(process.env.FIREBASE_ADMIN_JSON) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  return NextResponse.json({
    data: {
      supabase_url_configured: Boolean(url),
      service_role_configured: hasService,
      fcm_or_firebase_admin_configured: hasFcm,
    },
    note: 'Aucune clé ni empreinte exposée ici. Rotation = dashboard Supabase / Firebase + variables hébergeur, puis journaliser via « Rotation déclarée ».',
  });
}

const rotateSchema = z.object({
  secret: z.enum(['service_role', 'fcm', 'anon_key', 'custom']),
  note: z.string().max(500).optional(),
});

/** Journalise une demande de rotation ; ne régénère pas les clés (impossible sans API fournisseur). */
export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = rotateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const actorRole = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole,
    actionType: 'permission_change',
    entityType: 'setting',
    entityId: `secret_rotation_${parsed.data.secret}`,
    description: `Demande de rotation secret (${parsed.data.secret}) — exécuter dans Supabase / console cloud`,
    metadata: { secret: parsed.data.secret, note: parsed.data.note ?? null },
    status: 'success',
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    message:
      'Rotation déclarée (audit). Statut : à finaliser côté Supabase / Firebase et variables hébergeur, puis redéploiement.',
  });
}
