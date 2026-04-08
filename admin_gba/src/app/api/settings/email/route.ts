import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const KEY = 'email_notification_prefs';

const patchSchema = z.object({
  notifications_enabled: z.boolean().optional(),
  admin_email: z.string().email().optional().nullable(),
  cc_emails: z.string().max(2000).optional().nullable(),
  from_name: z.string().max(120).optional().nullable(),
  notify_new_order: z.boolean().optional(),
  notify_special_order: z.boolean().optional(),
  notify_order_status_changed: z.boolean().optional(),
  notify_new_user: z.boolean().optional(),
  notify_new_message: z.boolean().optional(),
  notify_security: z.boolean().optional(),
  notify_all_audit_events: z.boolean().optional(),
  email_provider: z.enum(['auto', 'smtp', 'resend']).optional(),
  reply_to: z.string().email().optional().nullable(),
  bcc_emails: z.string().max(2000).optional().nullable(),
  recipient_allowlist: z.array(z.string().email()).max(200).optional().nullable(),
  recipient_denylist: z.array(z.string().email()).max(200).optional().nullable(),
  dedup_window_sec: z.number().int().min(30).max(86400).optional(),
  min_priority: z.enum(['high', 'normal', 'low']).optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ data: {}, error: 'Service role manquant' }, { status: 503 });
  }

  const { data, error } = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
  if (error) {
    return NextResponse.json({ data: {}, note: error.message });
  }

  return NextResponse.json({ data: (data?.value as Record<string, unknown>) || {} });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data: cur } = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
  const prev = (cur?.value as Record<string, unknown>) || {};
  const next = { ...prev, ...parsed.data };

  const { error } = await sb.from('settings').upsert({ key: KEY, value: next }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data: next });
}
