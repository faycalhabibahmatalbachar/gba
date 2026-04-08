import { getServiceSupabase } from '@/lib/supabase/service-role';
import { getMailer } from '@/lib/email/mailer';

export type EmailPriority = 'high' | 'normal' | 'low';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  template: string;
  priority?: EmailPriority;
  replyTo?: string;
  cc?: string | string[];
  attachments?: { url: string; name?: string; type?: string }[];
  triggeredByAction?: string;
  triggeredByEntityId?: string;
  triggeredByActorId?: string | null;
};

/** Resend gratuit sans domaine : `onboarding@resend.dev` (destinataires limités au compte Resend). */
const DEFAULT_FROM_EMAIL = 'onboarding@resend.dev';
const DEFAULT_FROM_NAME = 'GBA';

export function buildEmailFromHeader(): string {
  const addr = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM_EMAIL;
  const name = process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_FROM_NAME;
  return `${name} <${addr}>`;
}

function wrapBrandHtml(title: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
<tr><td style="background:#6C47FF;padding:20px 24px;color:#fff;">
<table><tr><td style="width:44px;height:44px;background:#fff;border-radius:10px;text-align:center;font-weight:bold;color:#6C47FF;font-size:20px;">G</td>
<td style="padding-left:12px;"><div style="font-size:18px;font-weight:bold;">GBA</div><div style="font-size:12px;opacity:.9;">Administration</div></td></tr></table>
</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 12px;font-size:18px;color:#18181b;">${title}</h1>
<div style="font-size:14px;line-height:1.6;color:#3f3f46;">${inner}</div>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;">
GBA · ${new Date().getFullYear()} · Notification automatique
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function renderEmailTemplate(
  template: string,
  data: Record<string, string | number | undefined | null>,
): { subject: string; html: string } {
  const safe = (k: string) => String(data[k] ?? '—');
  switch (template) {
    case 'security_alert':
      return {
        subject: `[GBA Sécurité] ${safe('headline')}`,
        html: wrapBrandHtml(
          'Alerte sécurité',
          `<p><strong>${safe('headline')}</strong></p><p>${safe('detail')}</p><p style="font-size:12px;color:#71717a;">${safe('meta')}</p>`,
        ),
      };
    case 'new_order_placed':
      return {
        subject: `Nouvelle commande ${safe('order_ref')}`,
        html: wrapBrandHtml(
          'Nouvelle commande',
          `<p>Commande <strong>${safe('order_ref')}</strong></p><p>Client : ${safe('customer')}</p><p>Montant : <strong>${safe('amount')}</strong> XOF</p>`,
        ),
      };
    default:
      return {
        subject: safe('subject') || 'Notification GBA',
        html: wrapBrandHtml(safe('title') || 'Notification', `<p>${safe('body')}</p>`),
      };
  }
}

export async function sendEmail(input: SendEmailInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.info('[email] route start', {
    hasSmtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    hasResend: Boolean(process.env.RESEND_API_KEY),
  });
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const primary = recipients[0];
  if (!primary) return { success: false, error: 'Destinataire manquant' };
  const cc = input.cc ? (Array.isArray(input.cc) ? input.cc : [input.cc]) : undefined;
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const startedAt = Date.now();

  let logId: string | null = null;
  try {
    const sb = getServiceSupabase();
    const { data: logRow, error: le } = await sb
      .from('email_logs')
      .insert({
        template_name: input.template,
        to_email: recipients.join(', '),
        subject: input.subject,
        body_html: input.html,
        attachments: attachments.length ? attachments : null,
        status: 'pending',
        triggered_by_action: input.triggeredByAction ?? null,
        triggered_by_entity_id: input.triggeredByEntityId ?? null,
        triggered_by_actor_id: input.triggeredByActorId ?? null,
        provider: null,
        retry_count: 0,
      })
      .select('id')
      .single();
    if (!le && logRow?.id) logId = logRow.id as string;
  } catch {
    /* log table peut être absente avant migration */
  }

  try {
    const mailAttachments: { filename: string; content: Buffer; contentType?: string }[] = [];
    for (const att of attachments) {
      if (!att?.url) continue;
      try {
        const r = await fetch(att.url);
        if (!r.ok) continue;
        const ab = await r.arrayBuffer();
        mailAttachments.push({
          filename: att.name?.trim() || 'piece-jointe',
          content: Buffer.from(ab),
          contentType: att.type || r.headers.get('content-type') || 'application/octet-stream',
        });
      } catch {
        // Keep sending the email even if one attachment fails to fetch.
      }
    }
    const mailer = getMailer();
    const out = await mailer.send({
      from: buildEmailFromHeader(),
      to: recipients,
      cc: cc && cc.length ? cc : undefined,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      attachments: mailAttachments.length ? mailAttachments : undefined,
    });
    if (logId) {
      try {
        const sb = getServiceSupabase();
        await sb
          .from('email_logs')
          .update({
            status: 'sent',
            message_id: out.messageId ?? null,
            provider: out.provider,
            provider_message_id: out.messageId ?? null,
            retry_count: 0,
            retryable: false,
            latency_ms: Date.now() - startedAt,
            sent_at: new Date().toISOString(),
          })
          .eq('id', logId);
      } catch {}
    }
    return { success: true, messageId: out.messageId };
  } catch (e) {
    const lastErr = e instanceof Error ? e.message : String(e);
    const retryable = /timeout|timed out|econn|enotfound|fetch failed|connect/i.test(lastErr);
    const failedProvider = process.env.RESEND_API_KEY ? 'resend' : 'smtp';
    if (logId) {
      try {
        const sb = getServiceSupabase();
        await sb
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: `${failedProvider}: ${lastErr}`,
            provider: failedProvider,
            retry_count: 1,
            retryable,
            latency_ms: Date.now() - startedAt,
            sent_at: new Date().toISOString(),
          })
          .eq('id', logId);
      } catch {}
    }
    return { success: false, error: lastErr };
  }
}
