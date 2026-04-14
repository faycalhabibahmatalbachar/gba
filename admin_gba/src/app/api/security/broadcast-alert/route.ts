import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const res = await fetch(new URL('/api/security/alerts/broadcast', req.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actionType: 'send_notification',
    entityType: 'notification',
    entityId: 'security_broadcast_alert',
    description: 'Diffusion alerte sécurité via BFF',
    status: res.ok ? 'success' : 'failed',
  });

  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return NextResponse.json({ error: text }, { status: res.status });
  }
}
