import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { renderEmailTemplate, sendEmail } from '@/lib/email/email.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  to: z.string().email().optional(),
  template: z.enum(['test_basic', 'security_alert', 'invitation']).optional().default('test_basic'),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {}
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const to = parsed.data.to || auth.email;
  if (!to) return NextResponse.json({ error: 'Email cible manquant' }, { status: 422 });
  const tplName = parsed.data.template;
  const tpl =
    tplName === 'security_alert'
      ? renderEmailTemplate('security_alert', { headline: 'Test sécurité', detail: 'Test SMTP', meta: 'admin test' })
      : renderEmailTemplate('generic', {
          subject: tplName === 'invitation' ? 'Invitation GBA' : 'Test email GBA',
          title: 'Test configuration email',
          body: `Test envoye le ${new Date().toISOString()}`,
        });
  const started = Date.now();
  const result = await sendEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
    template: `test_${tplName}`,
    triggeredByAction: 'admin_test_email',
    triggeredByActorId: auth.userId,
  });
  return NextResponse.json({
    ok: result.success,
    to,
    messageId: result.messageId || null,
    latency_ms: Date.now() - started,
    error: result.error || null,
  });
}
