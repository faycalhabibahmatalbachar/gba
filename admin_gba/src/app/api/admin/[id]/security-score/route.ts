import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** Même logique heuristique que /profile — endpoint dédié si le client préfère un GET léger. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: profile } = await sb.from('profiles').select('role').eq('id', id).maybeSingle();
    const r = String(profile?.role || '').toLowerCase();
    if (!['admin', 'superadmin', 'super_admin'].includes(r)) {
      return NextResponse.json({ error: 'Profil admin requis' }, { status: 400 });
    }

    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    let loginsOk30 = 0;
    let loginFails30 = 0;
    let last_sign_in_at: string | null = null;
    try {
      const { data: au } = await sb.auth.admin.getUserById(id);
      last_sign_in_at = au.user?.last_sign_in_at ?? null;
    } catch {
      /* ignore */
    }
    try {
      const { data: hist } = await sb
        .from('admin_login_history')
        .select('success')
        .eq('user_id', id)
        .gte('created_at', since30);
      for (const h of hist || []) {
        if ((h as { success?: boolean }).success === false) loginFails30++;
        else loginsOk30++;
      }
    } catch {
      /* table absente */
    }

    const hasRecentLogin = last_sign_in_at
      ? new Date(last_sign_in_at).getTime() > Date.now() - 30 * 86400000
      : false;
    let score = 40;
    const details: { label: string; pts: number }[] = [];
    if (hasRecentLogin) {
      details.push({ label: 'Connexion récente (< 30 j)', pts: 20 });
      score += 20;
    }
    if (loginFails30 === 0) {
      details.push({ label: 'Aucun échec de connexion (30 j)', pts: 15 });
      score += 15;
    } else {
      const pen = Math.min(15, loginFails30 * 3);
      details.push({ label: 'Échecs de connexion (30 j)', pts: -pen });
      score -= pen;
    }
    if (loginsOk30 >= 5) {
      details.push({ label: 'Activité de connexion régulière', pts: 15 });
      score += 15;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    return NextResponse.json({
      security_score: score,
      security_score_details: details,
      logins_ok_30d: loginsOk30,
      logins_fail_30d: loginFails30,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
