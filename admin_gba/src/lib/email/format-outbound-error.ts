/** User-facing message when transactional email is blocked by env flag. */
export function formatOutboundEmailError(raw: string): string {
  if (raw === 'outbound_email_disabled') {
    return 'Envoi désactivé : définissez ENABLE_OUTBOUND_EMAIL=true sur le serveur (Vercel) et configurez SMTP ou RESEND_API_KEY.';
  }
  return raw;
}
