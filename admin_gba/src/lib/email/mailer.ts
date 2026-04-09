import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export type MailProvider = 'smtp' | 'resend' | 'none';

export type MailSendInput = {
  from: string;
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

export type MailSendOutput = {
  provider: MailProvider;
  messageId?: string;
};

function maskSecret(v: string): string {
  if (!v) return 'missing';
  if (v.length <= 8) return '****';
  return `${v.slice(0, 4)}****${v.slice(-4)}`;
}

export function getMailer() {
  const resendKey = process.env.RESEND_API_KEY?.trim() || '';
  const providerPref = (process.env.EMAIL_PROVIDER?.trim().toLowerCase() || 'auto') as
    | 'auto'
    | 'smtp'
    | 'resend';
  const host =
    process.env.SMTP_HOST?.trim() ||
    process.env.BREVO_SMTP_HOST?.trim() ||
    'smtp-relay.brevo.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim() || process.env.BREVO_SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS?.trim() || process.env.BREVO_SMTP_PASS?.trim() || '';
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const timeout = Number(process.env.SMTP_TIMEOUT_MS || 15000);

  const hasSmtp = Boolean(host && port && user && pass);
  const hasResend = Boolean(resendKey);

  if ((providerPref === 'resend' || providerPref === 'auto') && hasResend) {
    const resend = new Resend(resendKey);
    console.info('[mailer] Resend detected', { key: maskSecret(resendKey) });
    return {
      provider: 'resend' as const,
      async send(input: MailSendInput): Promise<MailSendOutput> {
        const out = await resend.emails.send({
          from: input.from,
          to: input.to,
          cc: input.cc && input.cc.length ? input.cc : undefined,
          replyTo: input.replyTo,
          subject: input.subject,
          html: input.html,
          ...(input.text?.trim() ? { text: input.text } : {}),
          attachments:
            input.attachments && input.attachments.length
              ? input.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content.toString('base64'),
                  content_type: a.contentType || 'application/octet-stream',
                }))
              : undefined,
        });
        if (out.error) throw new Error(out.error.message || 'Resend error');
        return { provider: 'resend', messageId: out.data?.id || undefined };
      },
    };
  }

  if (!hasSmtp) {
    console.warn('[mailer] SMTP config missing', {
      host: Boolean(host),
      port: Boolean(port),
      user: Boolean(user),
      pass: maskSecret(pass),
    });
    throw new Error('Email non configure : ajoutez RESEND_API_KEY ou SMTP_* dans .env.local');
  }

  console.info('[mailer] SMTP detected', { host, port, user: maskSecret(user) });
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: String(process.env.SMTP_POOL || '').toLowerCase() === 'true',
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 3),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 50),
    socketTimeout: timeout,
    connectionTimeout: timeout,
  });

  return {
    provider: 'smtp' as const,
    async send(input: MailSendInput): Promise<MailSendOutput> {
      const info = await transporter.sendMail({
        from: input.from,
        to: input.to.join(','),
        cc: input.cc && input.cc.length ? input.cc.join(',') : undefined,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
        ...(input.text?.trim() ? { text: input.text } : {}),
        attachments:
          input.attachments && input.attachments.length
            ? input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType,
              }))
            : undefined,
      });
      return { provider: 'smtp', messageId: info.messageId || undefined };
    },
  };
}
