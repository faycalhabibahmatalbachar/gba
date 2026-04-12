import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

/** Même forme que `PATCH /api/admin/[id]/permissions` (matrix + accès pages). */
const matrixSchema = z.record(z.string(), z.record(z.string(), z.boolean()));
const pageAccessSchema = z.record(z.string(), z.boolean());

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  role: z.enum(['admin', 'superadmin']),
  permissions: matrixSchema.optional(),
  page_access: pageAccessSchema.optional(),
});

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
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
    const { email, password, first_name, last_name, role, permissions, page_access } = parsed.data;

    const { data: created, error: ce } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role },
    });

    if (ce || !created.user) {
      return NextResponse.json({ error: ce?.message || 'Création auth échouée' }, { status: 400 });
    }

    const uid = created.user.id;

    const { error: pe } = await sb.from('profiles').upsert(
      {
        id: uid,
        email,
        first_name,
        last_name,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (pe) {
      await sb.auth.admin.deleteUser(uid);
      return NextResponse.json({ error: pe.message }, { status: 400 });
    }

    if (permissions && Object.keys(permissions).length) {
      await sb.from('settings').upsert(
        {
          key: `admin_permissions_${uid}`,
          value: permissions as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
          updated_by: auth.userId,
        },
        { onConflict: 'key' },
      );
    }

    if (page_access && Object.keys(page_access).length) {
      await sb.from('settings').upsert(
        {
          key: `admin_page_access_${uid}`,
          value: page_access as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
          updated_by: auth.userId,
        },
        { onConflict: 'key' },
      );
    }

    const actorRole = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: actorRole,
      actionType: 'create',
      entityType: 'user',
      entityId: uid,
      entityName: email,
      changes: { after: { role, permissions, page_access } },
      description: 'Création compte admin',
    });

    return NextResponse.json({ ok: true, user_id: uid });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
