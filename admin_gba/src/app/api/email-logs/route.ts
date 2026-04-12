import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '80', 10) || 80));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
  const status = searchParams.get('status')?.trim();
  const template = searchParams.get('template')?.trim();
  const toEmail = searchParams.get('toEmail')?.trim() || searchParams.get('to')?.trim();
  const qSubj = searchParams.get('q')?.trim();
  const provider = searchParams.get('provider')?.trim();
  const retryable = searchParams.get('retryable')?.trim();
  const fromIso = searchParams.get('from')?.trim();
  const toIso = searchParams.get('toDate')?.trim();
  const mode = searchParams.get('mode')?.trim();

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    if (mode === 'stats') {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const since = monthStart.toISOString();
      const [all, sent, failed, pending] = await Promise.all([
        sb.from('email_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
        sb.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', since),
        sb.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since),
        sb.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('created_at', since),
      ]);
      const total = all.count || 0;
      const success = sent.count || 0;
      return NextResponse.json({
        total_month: total,
        success_rate: total ? Math.round((success / total) * 100) : 0,
        failed_month: failed.count || 0,
        pending_month: pending.count || 0,
      });
    }

    let q = sb.from('email_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (status && ['pending', 'sent', 'failed'].includes(status)) {
      q = q.eq('status', status);
    }
    if (template) {
      q = q.ilike('template_name', `%${template}%`);
    }
    if (toEmail) {
      q = q.ilike('to_email', `%${toEmail}%`);
    }
    if (qSubj) {
      const safe = qSubj.replace(/[%*,]/g, '').slice(0, 120);
      if (safe) q = q.or(`subject.ilike.%${safe}%,error_message.ilike.%${safe}%`);
    }
    if (provider && ['smtp', 'resend', 'mock'].includes(provider)) {
      q = q.eq('provider', provider);
    }
    if (retryable === 'true') q = q.eq('retryable', true);
    if (retryable === 'false') q = q.eq('retryable', false);
    if (fromIso) {
      q = q.gte('created_at', fromIso);
    }
    if (toIso) {
      q = q.lte('created_at', toIso);
    }
    q = q.range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    return NextResponse.json({
      data: data ?? [],
      count: count ?? null,
      offset,
      limit,
      resend_configured: Boolean(process.env.RESEND_API_KEY),
      smtp_configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
      provider_mode: process.env.EMAIL_PROVIDER || 'auto',
    });
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return NextResponse.json({ error: 'Table email_logs absente — appliquer la migration SQL.', data: [] }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
