/**
 * Registre des templates HTML (fichiers dans ./html/).
 * Variables courantes : {{subject}}, {{title}}, {{body}}, {{cta_url}}, {{cta_label}}
 */
export const EMAIL_TEMPLATE_IDS = [
  'welcome',
  'order_confirmation',
  'order_shipped',
  'password_reset',
  'invite_admin',
  'delivery_update',
  'payment_received',
  'review_request',
  'cart_abandoned',
  'promo_news',
  'account_suspended',
  'account_reactivated',
  'driver_assigned',
  'refund_processed',
  'subscription_renewal',
  'newsletter',
  'security_alert',
  'push_digest',
  'invoice_ready',
  'support_ticket',
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export function templateFileName(id: EmailTemplateId): string {
  return `${id}.html`;
}
