import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { humanizeAuditEvent } from '@/lib/security/humanize-audit-event';
import { writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '50')));
  const cursor = url.searchParams.get('cursor');
  const type = (url.searchParams.get('type') || '').trim();
  const dateFrom = (url.searchParams.get('date_from') || '').trim();
  const dateTo = (url.searchParams.get('date_to') || '').trim();

  let q = sb
    .from('audit_logs')
    .select('id, created_at, user_id, user_email, action_type, entity_type, entity_id, entity_name, action_description, status, metadata')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt('created_at', cursor);
  if (type) q = q.eq('action_type', type);
  if (dateFrom) q = q.gte('created_at', dateFrom);
  if (dateTo) q = q.lte('created_at', dateTo);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      ...row,
      human_description: humanizeAuditEvent({
        action_type: String(row.action_type || ''),
        entity_type: String(row.entity_type || ''),
        entity_name: (row.entity_name as string | null | undefined) ?? null,
        entity_id: (row.entity_id as string | null | undefined) ?? null,
        user_email: (row.user_email as string | null | undefined) ?? null,
        action_description: (row.action_description as string | null | undefined) ?? null,
        status: (row.status as string | null | undefined) ?? null,
      }),
    };
  });

  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actionType: 'view',
    entityType: 'report',
    entityId: 'security_events',
    description: 'Consultation flux sécurité complet',
    status: 'success',
  });

  const lastCreatedAt =
    rows.length > 0 ? String((rows[rows.length - 1] as Record<string, unknown>).created_at || '') : null;

  return NextResponse.json({
    data: rows,
    meta: {
      next_cursor: lastCreatedAt,
      limit,
    },
  });
}
