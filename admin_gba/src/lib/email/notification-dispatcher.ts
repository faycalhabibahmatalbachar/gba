import { getServiceSupabase } from '@/lib/supabase/service-role';
import { renderEmailTemplate, sendEmail } from '@/lib/email/email.service';

export type NotificationEventType =
  | 'order_created'
  | 'order_special_created'
  | 'order_status_changed'
  | 'user_created'
  | 'message_created'
  | 'security_alert'
  | 'audit_event';

type Prefs = {
  notifications_enabled?: boolean;
  admin_email?: string | null;
  cc_emails?: string | null;
  notify_new_order?: boolean;
  notify_special_order?: boolean;
  notify_order_status_changed?: boolean;
  notify_new_user?: boolean;
  notify_new_message?: boolean;
  notify_security?: boolean;
  notify_all_audit_events?: boolean;
  recipient_allowlist?: string[] | null;
  recipient_denylist?: string[] | null;
  min_priority?: 'high' | 'normal' | 'low';
  dedup_window_sec?: number;
};

type EmitInput = {
  type: NotificationEventType;
  payload: Record<string, unknown>;
  actorUserId?: string | null;
  entityId?: string | null;
  priority?: 'high' | 'normal' | 'low';
};

const KEY = 'email_notification_prefs';

function parseCsv(v: string | null | undefined): string[] {
  return (v || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.includes('@'));
}

function shouldNotify(type: NotificationEventType, p: Prefs): boolean {
  if (p.notifications_enabled === false) return false;
  if (type === 'order_created') return p.notify_new_order !== false;
  if (type === 'order_special_created') return p.notify_special_order !== false;
  if (type === 'order_status_changed') return p.notify_order_status_changed !== false;
  if (type === 'user_created') return p.notify_new_user !== false;
  if (type === 'message_created') return p.notify_new_message !== false;
  if (type === 'security_alert') return p.notify_security !== false;
  if (type === 'audit_event') return p.notify_all_audit_events === true;
  return true;
}

function priorityValue(v: 'high' | 'normal' | 'low'): number {
  if (v === 'high') return 3;
  if (v === 'normal') return 2;
  return 1;
}

function dedupKey(type: NotificationEventType, entityId: string | null | undefined): string {
  return `${type}:${entityId || 'none'}`;
}

export async function emitAdminNotification(input: EmitInput): Promise<{ sent: boolean; reason?: string }> {
  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return { sent: false, reason: 'service_role_missing' };
  }

  let prefs: Prefs = {};
  try {
    const { data } = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
    prefs = (data?.value as Prefs) || {};
  } catch {
    prefs = {};
  }
  if (!shouldNotify(input.type, prefs)) return { sent: false, reason: 'disabled_by_prefs' };
  const incoming = input.priority || 'normal';
  const minPriority = prefs.min_priority || 'low';
  if (priorityValue(incoming) < priorityValue(minPriority)) return { sent: false, reason: 'below_priority' };

  const adminEmail = (prefs.admin_email || process.env.ADMIN_NOTIFICATION_EMAIL || '').trim();
  if (!adminEmail) return { sent: false, reason: 'missing_admin_email' };

  const allow = prefs.recipient_allowlist || [];
  const deny = prefs.recipient_denylist || [];
  if (allow.length > 0 && !allow.includes(adminEmail)) return { sent: false, reason: 'not_in_allowlist' };
  if (deny.includes(adminEmail)) return { sent: false, reason: 'in_denylist' };

  const windowSec = Math.max(30, Number(prefs.dedup_window_sec || 120));
  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const { count } = await sb
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('triggered_by_action', dedupKey(input.type, input.entityId))
      .gte('created_at', since);
    if ((count || 0) > 0) return { sent: false, reason: 'dedup' };
  } catch {
    /* ignore */
  }
  try {
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await sb
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('template_name', `event_${input.type}`)
      .gte('created_at', hourAgo);
    if ((count || 0) >= 60) return { sent: false, reason: 'rate_limit_hourly' };
  } catch {
    /* ignore */
  }

  const map = (() => {
    if (input.type === 'order_created' || input.type === 'order_special_created') {
      return renderEmailTemplate('new_order_placed', {
        order_ref: String(input.payload.order_number || input.entityId || 'N/A'),
        customer: String(input.payload.customer_name || 'Client'),
        amount: String(input.payload.total_amount || '0'),
      });
    }
    if (input.type === 'order_status_changed') {
      return renderEmailTemplate('generic', {
        subject: `[GBA] Changement statut commande`,
        title: 'Commande mise à jour',
        body: `Commande <b>${String(input.payload.order_number || input.entityId || '')}</b> : statut <b>${String(input.payload.status || 'inconnu')}</b>.`,
      });
    }
    if (input.type === 'user_created') {
      return renderEmailTemplate('generic', {
        subject: '[GBA] Nouvel utilisateur',
        title: 'Nouveau compte créé',
        body: `Utilisateur <b>${String(input.payload.email || input.entityId || '')}</b> créé (role: ${String(input.payload.role || 'client')}).`,
      });
    }
    if (input.type === 'message_created') {
      return renderEmailTemplate('generic', {
        subject: '[GBA] Nouveau message',
        title: 'Nouveau message reçu',
        body: `Conversation ${String(input.payload.conversation_id || '')}.`,
      });
    }
    if (input.type === 'security_alert') {
      return renderEmailTemplate('security_alert', {
        headline: String(input.payload.headline || 'Alerte sécurité'),
        detail: String(input.payload.detail || 'Voir le tableau sécurité admin.'),
        meta: String(input.payload.meta || ''),
      });
    }
    return renderEmailTemplate('generic', {
      subject: `[GBA] Audit ${String(input.payload.action || 'event')}`,
      title: 'Événement audit',
      body: String(input.payload.detail || 'Nouvel événement'),
    });
  })();

  const cc = parseCsv(prefs.cc_emails || null);
  const result = await sendEmail({
    to: adminEmail,
    cc,
    subject: map.subject,
    html: map.html,
    template: `event_${input.type}`,
    priority: input.priority || 'normal',
    triggeredByAction: dedupKey(input.type, input.entityId),
    triggeredByEntityId: input.entityId || undefined,
    triggeredByActorId: input.actorUserId || undefined,
  });
  return result.success ? { sent: true } : { sent: false, reason: result.error || 'send_failed' };
}
