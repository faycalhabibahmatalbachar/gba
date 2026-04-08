import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { sendEmail } from '@/lib/email/email.service';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const sb = getServiceSupabase();
  const { data, error } = await sb.from('email_logs').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const sb = getServiceSupabase();
  const { data, error } = await sb.from('email_logs').select('*').eq('id', id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
  const sent = await sendEmail({
    to: String(data.to_email || '').split(',').map((x) => x.trim()).filter(Boolean),
    subject: String(data.subject || 'Email'),
    html: String(data.body_html || data.html || '<p>Email</p>'),
    attachments: Array.isArray(data.attachments)
      ? (data.attachments as { url?: string; name?: string; type?: string }[])
          .filter((a) => typeof a?.url === 'string')
          .map((a) => ({ url: String(a.url), name: a.name, type: a.type }))
      : [],
    template: String(data.template_name || 'manual'),
    triggeredByAction: 'email_logs_resend',
    triggeredByEntityId: id,
    triggeredByActorId: auth.userId,
  });
  return NextResponse.json({ ok: sent.success, messageId: sent.messageId, error: sent.error || null });
}
