import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const KEY = 'security_session_policy';

const patchSchema = z.object({
  max_session_hours: z.number().min(1).max(168).optional(),
  single_session: z.boolean().optional(),
  idle_timeout_minutes: z.number().min(5).max(1440).optional(),
  max_login_attempts: z.number().min(3).max(20).optional(),
  lockout_duration_minutes: z.number().min(5).max(10080).optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data, error } = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
  if (error) {
    return NextResponse.json({ data: {}, error: error.message }, { status: 200 });
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
