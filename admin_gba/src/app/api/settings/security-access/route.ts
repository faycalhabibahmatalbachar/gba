import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const KEY = 'security_access';

const bodySchema = z.object({
  blocked_countries: z.array(z.string().min(2).max(3)).optional(),
  max_admin_connections_per_hour: z.number().int().min(1).max(10000).optional(),
  enforce_country_block: z.boolean().optional(),
  enforce_ip_allowlist: z.boolean().optional(),
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const defaults = {
    blocked_countries: [] as string[],
    max_admin_connections_per_hour: 2000,
    enforce_country_block: false,
    enforce_ip_allowlist: false,
  };
  const v = (data?.value as Record<string, unknown>) || {};
  return NextResponse.json({
    data: {
      blocked_countries: Array.isArray(v.blocked_countries) ? v.blocked_countries : defaults.blocked_countries,
      max_admin_connections_per_hour: Number(v.max_admin_connections_per_hour ?? defaults.max_admin_connections_per_hour),
      enforce_country_block: Boolean(v.enforce_country_block ?? defaults.enforce_country_block),
      enforce_ip_allowlist: Boolean(v.enforce_ip_allowlist ?? defaults.enforce_ip_allowlist),
    },
  });
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const cur = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
  const prev = (cur.data?.value as Record<string, unknown>) || {};

  const next = {
    ...prev,
    ...parsed.data,
    updated_at_note: 'Appliqué par middleware Next (lockdown, pays, liste IP, plafond API)',
  };

  const { error } = await sb.from('settings').upsert(
    {
      key: KEY,
      value: next as unknown as Record<string, unknown>,
      updated_by: auth.userId,
    },
    { onConflict: 'key' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: next });
}
