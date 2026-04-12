import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * Aperçu user_behavior + paramètres reco — utile quand l’app mobile n’envoie pas encore de signaux.
 */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

    const [ubCount, ubSample, reco] = await Promise.all([
      sb.from('user_behavior').select('id', { count: 'exact', head: true }).gte('created_at', since7d),
      sb
        .from('user_behavior')
        .select('id, user_id, product_id, action, duration_seconds, source, created_at')
        .order('created_at', { ascending: false })
        .limit(12),
      sb.from('recommendation_settings').select('algorithm, is_active, recommendation_count').limit(1).maybeSingle(),
    ]);

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://<project>.supabase.co';

    return NextResponse.json({
      data: {
        user_behavior_last_7d_count: ubCount.count ?? 0,
        user_behavior_sample: ubSample.data || [],
        recommendation_settings: reco.data || null,
        ingest_example: {
          method: 'POST',
          table: 'user_behavior',
          note: 'Depuis l’app authentifiée (RLS) ou via Edge Function service role.',
          curl_template: `curl -X POST '${baseUrl}/rest/v1/user_behavior' \\
  -H "apikey: <anon_or_service>" \\
  -H "Authorization: Bearer <user_jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"user_id":"<uuid>","product_id":"<uuid>","action":"view","source":"app","duration_seconds":12}'`,
        },
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
