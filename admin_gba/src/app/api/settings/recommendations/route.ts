import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  algorithm: z.enum(['collaborative', 'content_based', 'hybrid', 'trending', 'manual']).optional(),
  weights: z.record(z.string(), z.number()).optional(),
  min_interactions_threshold: z.number().min(0).max(1000).optional(),
  recommendation_count: z.number().min(6).max(48).optional(),
  refresh_interval_hours: z.number().min(1).max(168).optional(),
  exclude_out_of_stock: z.boolean().optional(),
  boost_new_products: z.boolean().optional(),
  boost_new_product_days: z.number().min(1).max(365).optional(),
  is_active: z.boolean().optional(),
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

  const { data, error } = await sb.from('recommendation_settings').select('*').limit(1).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message, hint: 'Appliquez la migration 20260415100000_security_recommendations_behavior.sql' }, { status: 503 });
  }

  return NextResponse.json({ data: data || null });
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

  const { data: row } = await sb.from('recommendation_settings').select('id').limit(1).maybeSingle();
  if (!row?.id) {
    return NextResponse.json({ error: 'Table recommendation_settings vide — exécutez la migration SQL.' }, { status: 503 });
  }

  const upd = { ...parsed.data, updated_by: auth.userId };
  const { data, error } = await sb.from('recommendation_settings').update(upd).eq('id', row.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}
