import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { renderEmailTemplate, sendEmail } from '@/lib/email/email.service';

export const dynamic = 'force-dynamic';

export async function POST() {
  console.info('[email.test] handler start', {
    hasSmtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  });
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || auth.email || '';
  try {
    const sb = getServiceSupabase();
    const { data } = await sb.from('settings').select('value').eq('key', 'email_notification_prefs').maybeSingle();
    const v = (data?.value as Record<string, unknown>) || {};
    if (typeof v.admin_email === 'string' && v.admin_email.includes('@')) adminEmail = v.admin_email;
  } catch {
    /* ignore */
  }

  if (!adminEmail) {
    return NextResponse.json({ error: 'Aucun email cible (ADMIN_NOTIFICATION_EMAIL ou préférences).' }, { status: 422 });
  }

  const { subject, html, text } = renderEmailTemplate('generic', {
    subject: 'Test GBA Admin',
    title: 'Email de test',
    body: `Bonjour,<br/><br/>Ceci est un message de test envoyé depuis l’admin GBA (${new Date().toISOString()}).`,
  });

  const result = await sendEmail({
    to: adminEmail,
    subject,
    html,
    text,
    template: 'test',
    priority: 'low',
    triggeredByAction: 'email.test',
    triggeredByActorId: auth.userId,
  });

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error || 'Échec envoi' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, to: adminEmail, messageId: result.messageId });
}
