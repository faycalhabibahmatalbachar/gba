import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  path: z.string().min(1).max(2000),
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'view',
      entityType: 'setting',
      description: 'Accès page refusé (middleware)',
      metadata: { denied_path: parsed.data.path, kind: 'read_denied' },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
