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
  const toEmail = searchParams.get('to')?.trim();
  const qSubj = searchParams.get('q')?.trim();
  const fromIso = searchParams.get('from')?.trim();
  const toIso = searchParams.get('to')?.trim();

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
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
    });
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return NextResponse.json({ error: 'Table email_logs absente — appliquer la migration SQL.', data: [] }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
