import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { humanizeAuditEvent } from '@/lib/security/humanize-audit-event';
import { writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';
const CACHE_TTL_MS = 30_000;
let overviewCache: { expiresAt: number; payload: unknown } | null = null;

function adminRole(u: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  const a = u.app_metadata?.role ?? u.user_metadata?.role;
  return typeof a === 'string' ? a : '';
}

type ScoreDetail = {
  id: string;
  label: string;
  points_max: number;
  points_earned: number;
  fix_hint: string;
};

function buildScoreDetails(params: {
  cov2: number;
  failed24: number;
  blacklistN: number;
  wlN: number;
  singleSessionOk: boolean;
  passwordStrict: boolean;
  tokensOk: boolean;
}): { score: number; level: 'secure' | 'warning' | 'critical'; details: ScoreDetail[] } {
  const details: ScoreDetail[] = [];

  let pts = 0;
  const add = (d: ScoreDetail) => {
    pts += d.points_earned;
    details.push(d);
  };

  const p2fa = Math.round(params.cov2 * 25);
  add({
    id: '2fa',
    label: 'Couverture 2FA administrateurs',
    points_max: 25,
    points_earned: p2fa,
    fix_hint: 'Section Politique · activer 2FA obligatoire',
  });

  const pSess = params.singleSessionOk ? 15 : 0;
  add({
    id: 'single_session',
    label: 'Politique session unique (réduction surface)',
    points_max: 15,
    points_earned: pSess,
    fix_hint: 'Authentification & sessions · activer session unique',
  });

  const pFail = params.failed24 === 0 ? 15 : params.failed24 <= 4 ? 8 : 0;
  add({
    id: 'login_failures',
    label: 'Tentatives de connexion (24h)',
    points_max: 15,
    points_earned: pFail,
    fix_hint: 'Surveillance · analyser les tentatives',
  });

  const pPwd = params.passwordStrict ? 15 : 7;
  add({
    id: 'password_policy',
    label: 'Politique mot de passe stricte',
    points_max: 15,
    points_earned: pPwd,
    fix_hint: 'Politique de sécurité · renforcer exigences MDP',
  });

  const pWl = params.wlN > 0 ? 10 : 0;
  add({
    id: 'whitelist',
    label: 'Liste blanche IP configurée (réseau maîtrisé)',
    points_max: 10,
    points_earned: pWl,
    fix_hint: 'Contrôle d’accès · ajouter IPs légitimes',
  });

  const pTok = params.tokensOk ? 10 : 5;
  add({
    id: 'tokens',
    label: 'Intégrations / secrets suivis',
    points_max: 10,
    points_earned: pTok,
    fix_hint: 'API & tokens · vérifier les clés',
  });

  const pBl = params.blacklistN <= 100 ? 10 : 5;
  add({
    id: 'blacklist_sanity',
    label: 'Listes noires sous contrôle',
    points_max: 10,
    points_earned: pBl,
    fix_hint: 'Contrôle d’accès · nettoyer les entrées obsolètes',
  });

  let score = Math.min(100, pts);
  if (params.blacklistN > 80) score = Math.max(0, score - 5);
  const level = score >= 75 ? 'secure' : score >= 45 ? 'warning' : 'critical';

  return { score, level, details };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  if (overviewCache && Date.now() < overviewCache.expiresAt) {
    return NextResponse.json(overviewCache.payload);
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = new Date(Date.now() - 86400000).toISOString();

  const [
    usersRes,
    failedHist,
    failedAudit,
    ipRes,
    wlRes,
    recentAudit,
    secSettings,
    pwdRow,
  ] = await Promise.all([
    sb.auth.admin.listUsers({ perPage: 1000 }),
    sb.from('admin_login_history').select('id', { count: 'exact', head: true }).eq('success', false).gte('created_at', since),
    sb
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action_type', 'login')
      .eq('status', 'failed')
      .gte('created_at', since),
    sb.from('ip_blacklist').select('id', { count: 'exact', head: true }),
    sb.from('ip_whitelist').select('id', { count: 'exact', head: true }),
    sb
      .from('audit_logs')
      .select(
        'id, created_at, user_email, action_type, entity_type, entity_id, entity_name, action_description, status',
      )
      .order('created_at', { ascending: false })
      .limit(10),
    sb.from('settings').select('value').eq('key', 'security_session_policy').maybeSingle(),
    sb.from('settings').select('value').eq('key', 'password_policy').maybeSingle(),
  ]);

  const users = usersRes.data?.users ?? [];
  const admins = users.filter((u) => {
    const r = adminRole(u).toLowerCase();
    return r === 'admin' || r === 'superadmin' || r === 'super_admin';
  });

  const now = Date.now();
  const activeSessions = admins.filter((u) => {
    if (!u.last_sign_in_at) return false;
    const hoursAgo = (now - new Date(u.last_sign_in_at).getTime()) / 3600000;
    return hoursAgo < 24;
  }).length;

  const verified2FA = admins.filter((u) => u.factors && u.factors.length > 0).length;
  const coverage2fa = admins.length > 0 ? Math.round((verified2FA / admins.length) * 100) : 0;
  const cov2 = admins.length > 0 ? verified2FA / admins.length : 1;

  const failed24 = Math.max(failedHist.count ?? 0, failedAudit.count ?? 0);
  const blacklistN = ipRes.count ?? 0;
  const whitelistN = wlRes.count ?? 0;

  const sessionVal = (secSettings.data?.value || {}) as Record<string, unknown>;
  const singleSessionOk = Boolean(sessionVal.single_session === true);

  const pwdVal = (pwdRow.data?.value || {}) as Record<string, unknown>;
  const passwordStrict =
    Number(pwdVal.min_length ?? 0) >= 12 &&
    Boolean(pwdVal.require_uppercase) &&
    Boolean(pwdVal.require_number) &&
    Boolean(pwdVal.require_special);

  const { score, level, details } = buildScoreDetails({
    cov2,
    failed24,
    blacklistN,
    wlN: whitelistN,
    singleSessionOk,
    passwordStrict,
    tokensOk: true,
  });

  const recent_events = (recentAudit.data || []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id,
      created_at: row.created_at,
      human_label: humanizeAuditEvent({
        action_type: String(row.action_type || ''),
        entity_type: String(row.entity_type || ''),
        entity_name: row.entity_name as string | null,
        entity_id: row.entity_id as string | null,
        user_email: row.user_email as string | null,
        action_description: row.action_description as string | null,
        status: row.status as string | null,
      }),
      action_type: row.action_type,
    };
  });

  const active_alerts: { level: 'critique' | 'attention' | 'info'; text: string; action: string }[] = [];
  if (failed24 >= 5) {
    active_alerts.push({
      level: 'critique',
      text: `${failed24} échecs de connexion sur 24h`,
      action: 'Voir tentatives',
    });
  } else if (failed24 > 0) {
    active_alerts.push({
      level: 'attention',
      text: `${failed24} échec(s) de connexion récent(s)`,
      action: 'Analyser',
    });
  }
  if (admins.length - verified2FA > 0) {
    active_alerts.push({
      level: 'attention',
      text: `${admins.length - verified2FA} admin(s) sans 2FA`,
      action: 'Politique 2FA',
    });
  }
  if (blacklistN > 0 && failed24 < 5) {
    active_alerts.push({
      level: 'info',
      text: `${blacklistN} entrée(s) sur liste noire IP`,
      action: 'Voir blacklist',
    });
  }

  const payload = {
    active_sessions: activeSessions,
    sessions_count: activeSessions,
    failed_24h: failed24,
    login_failures_24h: failed24,
    blocked_ips: blacklistN,
    blacklist_count: blacklistN,
    whitelist_count: whitelistN,
    coverage_2fa: coverage2fa,
    total_admins: admins.length,
    tokens_expired_hint: 0,
    admins_without_2fa: admins.length - verified2FA,
    security_score: score,
    score_level: level,
    score_details: details,
    active_alerts: active_alerts.slice(0, 3),
    recent_events: recent_events.slice(0, 5),
    generated_at: new Date().toISOString(),
  };

  overviewCache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actionType: 'view',
    entityType: 'report',
    entityId: 'security_overview',
    description: 'Consultation synthèse sécurité',
    status: 'success',
  });
  return NextResponse.json(payload);
}
