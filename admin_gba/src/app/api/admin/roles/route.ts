import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: rows, error } = await sb
      .from('profiles')
      .select('id, email, first_name, last_name, role, avatar_url, created_at, last_seen_at')
      .in('role', ['admin', 'superadmin', 'super_admin'])
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const list = [];
    for (const r of rows || []) {
      const uid = (r as { id: string }).id;
      const { data: perm } = await sb.from('settings').select('value').eq('key', `admin_permissions_${uid}`).maybeSingle();
      list.push({ ...r, permissions: perm?.value ?? {} });
    }

    return NextResponse.json({ admins: list });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

const postSchema = z.object({
  user_id: z.string().uuid(),
  permissions: z.record(z.string(), z.record(z.string(), z.boolean())),
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

  const parsed = postSchema.safeParse(body);
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
    const { user_id, permissions } = parsed.data;
    await sb.from('settings').upsert(
      {
        key: `admin_permissions_${user_id}`,
        value: permissions,
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
      actionType: 'create',
      entityType: 'role',
      entityId: user_id,
      changes: { after: permissions },
      description: 'Création permissions admin',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
