#!/usr/bin/env node
/**
 * Prints whether Resend / SMTP env vars are set (masked). Does not send email.
 * Usage: node scripts/check-email-env.mjs
 * Or:    npm run check:email-env
 */

const mask = (v) => {
  if (!v) return '(vide)';
  if (v.length <= 8) return '****';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
};

const resend = process.env.RESEND_API_KEY?.trim();
const host =
  process.env.SMTP_HOST?.trim() ||
  process.env.BREVO_SMTP_HOST?.trim() ||
  'smtp-relay.brevo.com (défaut mailer)';
const user =
  process.env.SMTP_USER?.trim() || process.env.BREVO_SMTP_USER?.trim() || '';
const pass =
  process.env.SMTP_PASS?.trim() || process.env.BREVO_SMTP_PASS?.trim() || '';
const provider = (process.env.EMAIL_PROVIDER || 'auto').trim();

console.log('EMAIL_PROVIDER:', provider);
console.log('RESEND_API_KEY:', mask(resend || ''));
console.log('SMTP_HOST:', host);
console.log('SMTP_USER:', mask(user));
console.log('SMTP_PASS:', pass ? mask(pass) : '(vide)');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || '(vide → défaut app)');

const hasResend = Boolean(resend);
const hasSmtp = Boolean(user && pass);
let ready = false;
if (provider === 'resend' && hasResend) ready = true;
else if (provider === 'smtp' && hasSmtp) ready = true;
else if (provider === 'auto' && (hasResend || hasSmtp)) ready = true;

console.log('');
if (ready) {
  console.log('OK: au moins un canal (Resend ou SMTP) est configurable pour getMailer().');
  process.exit(0);
}
console.error(
  'MANQUE: définir RESEND_API_KEY et/ou SMTP_USER+SMTP_PASS (voir .env.example).',
);
process.exit(1);
