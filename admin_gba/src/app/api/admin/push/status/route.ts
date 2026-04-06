import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const jobId = new URL(req.url).searchParams.get('jobId')?.trim();
  if (!jobId) return NextResponse.json({ error: 'jobId requis' }, { status: 400 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { data, error } = await sb
    .from('push_campaigns')
    .select(
      'id, title, status, sent_count, delivered_count, failed_count, invalid_count, total_targeted, error_detail, created_at, scheduled_at, completed_at',
    )
    .eq('id', jobId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 });

  const total = data.total_targeted ?? 0;
  const sent = data.sent_count ?? 0;
  const delivered = data.delivered_count ?? 0;
  const failed = data.failed_count ?? 0;
  const invalid = data.invalid_count ?? 0;

  return NextResponse.json({
    data: {
      id: data.id,
      status: data.status,
      sent,
      delivered,
      failed,
      invalid,
      total,
      error_detail: data.error_detail,
      created_at: data.created_at,
      scheduled_at: data.scheduled_at,
      completed_at: data.completed_at,
    },
  });
}
