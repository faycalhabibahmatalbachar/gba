import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const KEY = 'password_policy';

const patchSchema = z.object({
  min_length: z.number().int().min(6).max(128).optional(),
  require_uppercase: z.boolean().optional(),
  require_number: z.boolean().optional(),
  require_special: z.boolean().optional(),
  max_age_days: z.number().int().min(0).max(3650).nullable().optional(),
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
    min_length: 10,
    require_uppercase: true,
    require_number: true,
    require_special: false,
    max_age_days: null as number | null,
  };
  const v = (data?.value as Record<string, unknown>) || {};
  const maxAge =
    v.max_age_days === undefined
      ? defaults.max_age_days
      : v.max_age_days === null
        ? null
        : Number(v.max_age_days);
  return NextResponse.json({
    data: {
      min_length: Number(v.min_length ?? defaults.min_length),
      require_uppercase: Boolean(v.require_uppercase ?? defaults.require_uppercase),
      require_number: Boolean(v.require_number ?? defaults.require_number),
      require_special: Boolean(v.require_special ?? defaults.require_special),
      max_age_days: maxAge,
    },
    hint: 'Appliquer côté Auth hooks / Edge (validate password) — cette route ne modifie pas Supabase Auth automatiquement.',
  });
}

export async function PATCH(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const cur = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
  const prev = (cur.data?.value as Record<string, unknown>) || {};
  const next = { ...prev, ...parsed.data };

  const { error } = await sb.from('settings').upsert(
    {
      key: KEY,
      value: next as Record<string, unknown>,
      updated_by: auth.userId,
    },
    { onConflict: 'key' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorRole = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole,
    actionType: 'update',
    entityType: 'setting',
    entityId: KEY,
    description: 'Mise à jour politique mot de passe (settings.password_policy)',
    changes: { before: prev, after: next },
  }).catch(() => null);

  return NextResponse.json({ ok: true, data: next });
}
