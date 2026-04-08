import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { sendEmail } from '@/lib/email/email.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  to: z.array(z.string().email()).min(1).max(200),
  subject: z.string().min(1).max(200),
  body_html: z.string().min(1).max(200000),
  attachments: z.array(z.object({ url: z.string().url(), name: z.string().optional() })).optional().default([]),
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const sent = await sendEmail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    html: parsed.data.body_html,
    attachments: parsed.data.attachments.map((a) => ({ url: a.url, name: a.name })),
    template: 'manual_admin',
    triggeredByAction: 'admin_send_email',
    triggeredByActorId: auth.userId,
  });
  return NextResponse.json({ ok: sent.success, messageId: sent.messageId, error: sent.error || null });
}
