import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/audit/server-audit';
import { renderEmailTemplate, sendEmail } from '@/lib/email/email.service';
import { emitAdminNotification } from '@/lib/email/notification-dispatcher';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum([
    'lockdown_flag',
    'unlock_lockdown',
    'revoke_sessions_all',
    'full_lockdown',
    'rotate_tokens_emergency',
    'log_only',
  ]),
  reason: z.string().min(3).max(500),
});

/**
 * Actions d’urgence — réservées superadmin.
 * lockdown_flag : écrit settings.security_emergency_lockdown (clé JSON dans public.settings si table présente).
 * revoke_sessions_all : ferme toutes les lignes user_sessions actives.
 */
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const now = new Date().toISOString();
  let fullLockdownEmailNote: string | undefined;

  try {
    if (parsed.data.action === 'lockdown_flag') {
      await sb.from('settings').upsert(
        {
          key: 'security_emergency_lockdown',
          value: { active: true, at: now, reason: parsed.data.reason, by: auth.userId },
        },
        { onConflict: 'key' },
      );
    }

    if (parsed.data.action === 'unlock_lockdown') {
      await sb.from('settings').upsert(
        {
          key: 'security_emergency_lockdown',
          value: { active: false, at: now, reason: parsed.data.reason, by: auth.userId },
        },
        { onConflict: 'key' },
      );
    }

    if (parsed.data.action === 'revoke_sessions_all') {
      await sb.from('user_sessions').update({ ended_at: now }).is('ended_at', null);
    }

    if (parsed.data.action === 'full_lockdown') {
      const callerIp =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip')?.trim() ||
        null;
      await sb.from('settings').upsert(
        {
          key: 'security_emergency_lockdown',
          value: { active: true, at: now, reason: parsed.data.reason, by: auth.userId, mode: 'full_lockdown' },
        },
        { onConflict: 'key' },
      );
      await sb.from('user_sessions').update({ ended_at: now }).is('ended_at', null);
      await sb
        .from('profiles')
        .update({ is_suspended: true, suspended_at: now, suspended_by: auth.userId, suspension_reason: 'Emergency lockdown' })
        .eq('role', 'admin');

      const cur = await sb.from('settings').select('value').eq('key', 'security_access').maybeSingle();
      const prev = (cur.data?.value as Record<string, unknown>) || {};
      const allow = callerIp ? [callerIp] : [];
      await sb.from('settings').upsert(
        {
          key: 'security_access',
          value: {
            ...prev,
            enforce_ip_allowlist: true,
            emergency_allowlist_ips: allow,
            emergency_at: now,
          },
          updated_by: auth.userId,
        },
        { onConflict: 'key' },
      );

      const { data: superAdmins } = await sb
        .from('profiles')
        .select('email, first_name, last_name')
        .in('role', ['superadmin', 'super_admin'])
        .not('email', 'is', null)
        .limit(50);
      const emails = (superAdmins || [])
        .map((r) => String((r as { email?: string | null }).email || '').trim())
        .filter(Boolean);
      let emailOutcome: { attempted: boolean; success: boolean; error?: string } = {
        attempted: false,
        success: false,
      };
      if (emails.length) {
        const tpl = renderEmailTemplate('security_alert', {
          headline: 'VERROUILLAGE D’URGENCE ACTIVÉ',
          detail: `Un verrouillage global a été déclenché. Motif: ${parsed.data.reason}`,
          meta: `acteur=${auth.email || auth.userId} · date=${now}`,
        });
        emailOutcome.attempted = true;
        const sent = await sendEmail({
          to: emails,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          template: 'security_alert',
          triggeredByAction: 'full_lockdown',
          triggeredByEntityId: 'security_emergency',
          triggeredByActorId: auth.userId,
        });
        emailOutcome.success = sent.success;
        emailOutcome.error = sent.error;
      }
      if (!emails.length) {
        fullLockdownEmailNote = 'Aucun email superadmin en base — alerte email non envoyée.';
      } else if (!emailOutcome.success) {
        fullLockdownEmailNote = `Alerte email non délivrée (${emailOutcome.error || 'voir journal email_logs / SMTP'}).`;
      } else {
        fullLockdownEmailNote = 'Emails d’alerte envoyés aux superadmins.';
      }
    }

    await writeAuditLog({
      actorUserId: auth.userId,
      actionType: 'permission_change',
      entityType: 'setting',
      entityId: 'security_emergency',
      description: `Urgence sécurité: ${parsed.data.action} — ${parsed.data.reason}`,
      status: 'success',
      metadata: { action: parsed.data.action },
    });
    await emitAdminNotification({
      type: 'security_alert',
      payload: {
        headline: `Urgence sécurité: ${parsed.data.action}`,
        detail: parsed.data.reason,
        meta: `actor=${auth.email || auth.userId} at=${now}`,
      },
      actorUserId: auth.userId,
      entityId: 'security_emergency',
      priority: 'high',
    });

    return NextResponse.json({
      ok: true,
      action: parsed.data.action,
      message:
        parsed.data.action === 'lockdown_flag'
          ? 'Drapeau lockdown enregistré (settings.security_emergency_lockdown). Le middleware Next.js refuse désormais l’accès aux non super-admins.'
          : parsed.data.action === 'unlock_lockdown'
            ? 'Verrouillage d’urgence désactivé (security_emergency_lockdown.active = false).'
            : parsed.data.action === 'revoke_sessions_all'
              ? 'Sessions applicatives (user_sessions) clôturées. Les refresh tokens Supabase Auth ne sont pas révoqués automatiquement.'
              : parsed.data.action === 'full_lockdown'
                ? `Verrouillage total exécuté: lockdown actif, sessions clôturées, admins suspendus, liste blanche urgence (IP appelant) fusionnée. ${fullLockdownEmailNote || ''}`
                : parsed.data.action === 'rotate_tokens_emergency'
                  ? 'Rotation d’urgence journalisée. Régénérez les clés depuis Supabase/Firebase puis redéployez.'
                  : 'Événement journalisé.',
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
