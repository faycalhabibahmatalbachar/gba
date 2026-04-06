import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

function randomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const postSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128).optional(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  role: z.enum(['client', 'driver', 'admin', 'superadmin']).default('client'),
  sendInvite: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
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

  const p = parsed.data;
  if (p.role === 'superadmin') {
    return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const password = p.password ?? randomPassword();

  try {
    if (p.sendInvite) {
      const { error: invErr } = await sb.auth.admin.inviteUserByEmail(p.email, {
        data: { first_name: p.firstName, last_name: p.lastName, role: p.role },
      });
      if (invErr) {
        return NextResponse.json({ error: invErr.message }, { status: 400 });
      }
      const role = await fetchActorRole(auth.userId);
      await writeAuditLog({
        actorUserId: auth.userId,
        actorEmail: auth.email,
        actorRole: role,
        actionType: 'create',
        entityType: 'user',
        description: 'Invitation utilisateur',
        changes: { after: { email: p.email, role: p.role } },
      });
      return NextResponse.json({ success: true, invited: true });
    }

    const { data: created, error: authError } = await sb.auth.admin.createUser({
      email: p.email,
      password,
      email_confirm: true,
      user_metadata: { first_name: p.firstName, last_name: p.lastName, role: p.role },
    });

    if (authError || !created.user) {
      return NextResponse.json({ error: authError?.message || 'Auth erreur' }, { status: 400 });
    }

    const uid = created.user.id;

    const { error: profErr } = await sb.from('profiles').upsert(
      {
        id: uid,
        email: p.email,
        first_name: p.firstName,
        last_name: p.lastName,
        phone: p.phone ?? null,
        city: p.city ?? null,
        country: p.country ?? null,
        role: p.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'user',
      entityId: uid,
      description: 'Création utilisateur admin',
      changes: {
        after: { email: p.email, role: p.role, firstName: p.firstName, lastName: p.lastName },
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: uid, email: p.email },
      temporaryPassword: p.password ? undefined : password,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
