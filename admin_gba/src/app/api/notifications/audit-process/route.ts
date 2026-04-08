import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { emitAdminNotification } from '@/lib/email/notification-dispatcher';

export const dynamic = 'force-dynamic';

type AuditRow = {
  id: string;
  action_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_description: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

const PIPELINE = 'audit_email_alerts_v1';

export async function POST() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  let state: { last_processed_event_id?: string | null } | null = null;
  try {
    const stateRes = await sb.from('notification_dispatch_state').select('id,last_processed_event_id').eq('pipeline', PIPELINE).maybeSingle();
    state = stateRes.data || null;
  } catch {
    state = null;
  }

  let q = sb
    .from('audit_logs')
    .select('id, action_type, entity_type, entity_id, action_description, status, metadata')
    .order('created_at', { ascending: true })
    .limit(100);
  if (state?.last_processed_event_id) q = q.gt('id', state.last_processed_event_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as AuditRow[];
  let sent = 0;
  for (const row of rows) {
    let type: Parameters<typeof emitAdminNotification>[0]['type'] = 'audit_event';
    if (row.entity_type === 'order' && row.action_type === 'create') {
      const special = String((row.metadata || {}).special || '') === 'true';
      type = special ? 'order_special_created' : 'order_created';
    } else if (row.entity_type === 'order' && ['update', 'assign'].includes(String(row.action_type || ''))) {
      type = 'order_status_changed';
    } else if (row.entity_type === 'user' && row.action_type === 'create') {
      type = 'user_created';
    } else if (row.entity_type === 'message' && row.action_type === 'create') {
      type = 'message_created';
    } else if (row.entity_type === 'security') {
      type = 'security_alert';
    }

    const out = await emitAdminNotification({
      type,
      payload: {
        action: row.action_type || 'unknown',
        detail: row.action_description || `${row.entity_type || 'entity'}:${row.entity_id || ''}`,
        status: row.status || '',
      },
      entityId: row.entity_id || row.id,
      priority: row.status === 'failed' ? 'high' : 'normal',
      actorUserId: null,
    });
    if (out.sent) sent += 1;
  }

  const lastId = rows.length ? rows[rows.length - 1]?.id : state?.last_processed_event_id || null;
  if (lastId) {
    const up = await sb
      .from('notification_dispatch_state')
      .upsert({ pipeline: PIPELINE, last_processed_event_id: lastId, updated_at: new Date().toISOString() }, { onConflict: 'pipeline' });
    if (up.error) {
      console.warn('[audit-process] state upsert failed', up.error.message);
    }
  }

  return NextResponse.json({ ok: true, scanned: rows.length, sent, last_processed_event_id: lastId });
}
