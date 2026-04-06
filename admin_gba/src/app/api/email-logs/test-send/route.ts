import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { renderEmailTemplate, sendEmail } from '@/lib/email/email.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  to: z.string().email(),
});

/** Test Resend / journal email_logs — superadmin uniquement. */
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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const tpl = renderEmailTemplate('security_alert', {
    headline: 'TEST CONFIG EMAIL',
    detail: 'Ceci est un email de test depuis le panneau admin (journal des emails).',
    meta: `demandé par ${auth.email || auth.userId}`,
  });

  const sent = await sendEmail({
    to: parsed.data.to,
    subject: tpl.subject,
    html: tpl.html,
    template: 'email_test',
    triggeredByAction: 'admin_test_send',
    triggeredByEntityId: 'email_logs',
    triggeredByActorId: auth.userId,
  });

  if (!sent.success) {
    return NextResponse.json({ ok: false, error: sent.error || 'Échec envoi' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: sent.messageId });
}
