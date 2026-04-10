import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { isOutboundEmailEnabled, renderEmailTemplate, sendEmail } from '@/lib/email/email.service';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { data: profile, error: pe } = await sb.from('profiles').select('email').eq('id', id).maybeSingle();
  if (pe || !profile?.email) {
    return NextResponse.json({ error: 'Profil ou email introuvable' }, { status: 404 });
  }

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await sb.from('audit_logs').insert({
      user_id: auth.userId,
      user_email: auth.email,
      user_role: 'admin',
      action_type: 'permission_change',
      action_description: 'Lien de réinitialisation mot de passe généré',
      entity_type: 'user',
      entity_id: id,
      metadata: {},
      status: 'success',
    } as never);
  } catch {
    /* optional */
  }

  const actionLink = data.properties?.action_link ?? null;

  let email_sent = false;
  let email_error: string | null = null;
  if (actionLink && isOutboundEmailEnabled()) {
    const email = String(profile.email || '').trim();
    const tpl = renderEmailTemplate('password_recovery', { recovery_link: actionLink });
    const sent = await sendEmail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      template: 'password_recovery',
      triggeredByAction: 'user_password_reset',
      triggeredByEntityId: id,
      triggeredByActorId: auth.userId,
    });
    email_sent = sent.success;
    email_error = sent.error ?? null;
  }

  return NextResponse.json({
    ok: true,
    action_link: actionLink,
    email_sent,
    email_error,
  });
}
