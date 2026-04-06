'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  Ban,
  Bell,
  CheckCircle2,
  FileDown,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Skull,
  Sparkles,
  Video,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/custom/PageHeader';
import { MapWrapper } from '@/components/ui/custom/MapWrapper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { cn } from '@/lib/utils';
import { SecurityAccessSection } from './SecurityAccessSection';
import { SecurityChartsBlock } from './SecurityChartsBlock';
import { SecurityAuditRealtime, type LiveAuditRow } from './SecurityAuditRealtime';

type Overview = {
  active_sessions?: number;
  failed_24h?: number;
  blocked_ips?: number;
  coverage_2fa?: number;
  admins_without_2fa?: number;
  tokens_expired_hint?: number;
};

type ScoreRes = { score: number; level: 'secure' | 'warning' | 'critical'; breakdown?: Record<string, number> };

type SessionRow = {
  id: string;
  user_id: string;
  email?: string | null;
  started_at?: string | null;
  last_active_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  is_active?: boolean;
  hours_ago?: number;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
  city?: string | null;
};

type LoginAttempt = {
  email?: string | null;
  ip?: string | null;
  ip_address?: string | null;
  success?: boolean;
  created_at?: string | null;
};

type GeoPoint = {
  lat: number;
  lng: number;
  status: 'normal' | 'blocked' | 'unusual' | string;
  ip?: string | null;
  email?: string | null;
  at?: string;
  country?: string | null;
  city?: string | null;
  geo_source?: string | null;
};

async function j<T>(r: Response): Promise<T> {
  const x = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(typeof x.error === 'string' ? x.error : r.statusText);
  return x;
}

export function SecurityCommandCenter() {
  const qc = useQueryClient();
  const auditFeedRef = React.useRef<HTMLDivElement>(null);
  const [policy, setPolicy] = React.useState({
    max_session_hours: 24,
    single_session: false,
    idle_timeout_minutes: 60,
    max_login_attempts: 5,
    lockout_duration_minutes: 30,
  });
  const [emergencyOpen, setEmergencyOpen] = React.useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = React.useState(false);
  const [emergencyReason, setEmergencyReason] = React.useState('');
  const [liveAudit, setLiveAudit] = React.useState<LiveAuditRow[]>([]);
  const [mapFilter, setMapFilter] = React.useState<'all' | 'normal' | 'blocked' | 'unusual'>('all');

  const appendLive = React.useCallback((row: LiveAuditRow) => {
    setLiveAudit((prev) => [...prev.slice(-60), row]);
  }, []);

  const overviewQ = useQuery({
    queryKey: ['security-overview'],
    queryFn: async () => j<Overview>(await fetch('/api/security/overview', { credentials: 'include' })),
    refetchInterval: 30_000,
  });

  const scoreQ = useQuery({
    queryKey: ['security-score'],
    queryFn: async () => j<ScoreRes>(await fetch('/api/security/score', { credentials: 'include' })),
    refetchInterval: 30_000,
  });

  const sessionsQ = useQuery({
    queryKey: ['security-sessions'],
    queryFn: async () => {
      const r = await fetch('/api/security/sessions', { credentials: 'include' });
      const x = (await r.json()) as { data?: SessionRow[] };
      if (!r.ok) throw new Error('Sessions');
      return x.data ?? [];
    },
    refetchInterval: 30_000,
  });

  const loginsQ = useQuery({
    queryKey: ['security-login-attempts'],
    queryFn: async () => {
      const r = await fetch('/api/security/login-attempts?limit=80', { credentials: 'include' });
      const x = (await r.json()) as { data?: LoginAttempt[] };
      if (!r.ok) throw new Error('Login attempts');
      return x.data ?? [];
    },
    refetchInterval: 60_000,
  });

  const geoQ = useQuery({
    queryKey: ['security-geoip'],
    queryFn: async () => {
      const r = await fetch('/api/security/geoip-events', { credentials: 'include' });
      const x = (await r.json()) as { data?: { points?: GeoPoint[] } };
      if (!r.ok) throw new Error('Geo');
      return x.data?.points ?? [];
    },
    refetchInterval: 120_000,
  });

  const auditFeedQ = useQuery({
    queryKey: ['security-audit-feed'],
    queryFn: async () => {
      const r = await fetch('/api/audit?limit=40', { credentials: 'include' });
      const x = (await r.json()) as { logs?: Record<string, unknown>[] };
      if (!r.ok) throw new Error('Audit');
      return x.logs ?? [];
    },
    refetchInterval: 15_000,
  });

  const suspiciousQ = useQuery({
    queryKey: ['security-suspicious'],
    queryFn: async () => {
      const r = await fetch('/api/security/suspicious', { credentials: 'include' });
      const x = (await r.json()) as { data?: { flagged?: { ip: string; failures: number }[] } };
      if (!r.ok) throw new Error('Suspicious');
      return x.data?.flagged ?? [];
    },
    refetchInterval: 60_000,
  });

  const meQ = useQuery({
    queryKey: ['admin-me-security'],
    queryFn: async () => {
      const r = await fetch('/api/admin/me', { credentials: 'include' });
      if (!r.ok) return { isSuperAdmin: false as boolean };
      return r.json() as { isSuperAdmin?: boolean };
    },
    staleTime: 60_000,
  });

  const behaviorQ = useQuery({
    queryKey: ['security-behavior-insights'],
    queryFn: async () => {
      const r = await fetch('/api/security/behavior-insights', { credentials: 'include' });
      const x = (await r.json()) as { data?: Record<string, unknown>; error?: string };
      if (!r.ok) throw new Error(x.error || 'Insights');
      return x.data ?? {};
    },
    staleTime: 120_000,
  });

  const secretsMetaQ = useQuery({
    queryKey: ['secrets-metadata'],
    queryFn: async () => {
      const r = await fetch('/api/settings/secrets-metadata', { credentials: 'include' });
      const x = (await r.json()) as { data?: Record<string, boolean>; note?: string; error?: string };
      if (!r.ok) throw new Error(x.error || 'Secrets');
      return x;
    },
    staleTime: 120_000,
  });

  const pwdPolQ = useQuery({
    queryKey: ['password-policy'],
    queryFn: async () => {
      const r = await fetch('/api/settings/password-policy', { credentials: 'include' });
      const x = (await r.json()) as { data?: Record<string, unknown>; error?: string };
      if (!r.ok) throw new Error(x.error || 'Policy');
      return x.data ?? {};
    },
  });

  const [pwdDraft, setPwdDraft] = React.useState({
    min_length: 10,
    require_uppercase: true,
    require_number: true,
    require_special: false,
    max_age_days: null as number | null,
  });

  React.useEffect(() => {
    const d = pwdPolQ.data as Record<string, unknown> | undefined;
    if (!d || typeof d !== 'object') return;
    setPwdDraft({
      min_length: Number(d.min_length ?? 10),
      require_uppercase: Boolean(d.require_uppercase),
      require_number: Boolean(d.require_number),
      require_special: Boolean(d.require_special),
      max_age_days: d.max_age_days === null || d.max_age_days === undefined ? null : Number(d.max_age_days),
    });
  }, [pwdPolQ.data]);

  const rotateSecretMut = useMutation({
    mutationFn: async (secret: 'service_role' | 'fcm' | 'anon_key' | 'custom') => {
      const r = await fetch('/api/settings/secrets-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ secret, note: emergencyReason.trim() || undefined }),
      });
      const t = await r.text();
      let body: { error?: string; message?: string };
      try {
        body = JSON.parse(t) as { error?: string; message?: string };
      } catch {
        body = { error: t };
      }
      if (!r.ok) throw new Error(body.error || t);
      return body;
    },
    onSuccess: (b) => toast.success(b.message || 'Journalisé'),
    onError: (e: Error) => toast.error(e.message),
  });

  const savePwdMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/settings/password-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pwdDraft),
      });
      return j<{ ok?: boolean }>(r);
    },
    onSuccess: () => {
      toast.success('Politique MDP enregistrée (settings.password_policy)');
      void qc.invalidateQueries({ queryKey: ['password-policy'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bootstrapSuperMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/bootstrap-superadmin', {
        method: 'POST',
        credentials: 'include',
      });
      const j = (await r.json()) as { error?: string; message?: string };
      if (!r.ok) throw new Error(j.error || 'Bootstrap refusé');
      return j;
    },
    onSuccess: (x) => {
      toast.success(x.message || 'Compte promu superadmin');
      void qc.invalidateQueries({ queryKey: ['admin-me-security'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mergedAuditFeed = React.useMemo(() => {
    const base = auditFeedQ.data ?? [];
    const fromLive = liveAudit.map((e) => ({
      id: e.id,
      action_type: e.action_type,
      created_at: e.created_at,
      user_email: e.user_email,
      metadata: e.metadata,
      status: e.status,
    }));
    const seen = new Set<string>();
    const out: Record<string, unknown>[] = [];
    for (const row of [...fromLive, ...base]) {
      const id = String((row as { id?: string }).id ?? '');
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      out.push(row as Record<string, unknown>);
    }
    return out.slice(0, 80);
  }, [auditFeedQ.data, liveAudit]);

  React.useLayoutEffect(() => {
    const el = auditFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mergedAuditFeed]);

  const policyQ = useQuery({
    queryKey: ['security-session-policy'],
    queryFn: async () => {
      const r = await fetch('/api/settings/security', { credentials: 'include' });
      const x = (await r.json()) as { data?: Record<string, unknown> };
      if (!r.ok) throw new Error('Policy');
      return x.data || {};
    },
  });

  React.useEffect(() => {
    const d = policyQ.data;
    if (!d || typeof d !== 'object') return;
    setPolicy((prev) => ({
      max_session_hours: Number(d.max_session_hours ?? prev.max_session_hours),
      single_session: Boolean(d.single_session ?? prev.single_session),
      idle_timeout_minutes: Number(d.idle_timeout_minutes ?? prev.idle_timeout_minutes),
      max_login_attempts: Number(d.max_login_attempts ?? prev.max_login_attempts),
      lockout_duration_minutes: Number(d.lockout_duration_minutes ?? prev.lockout_duration_minutes),
    }));
  }, [policyQ.data]);

  const savePolicy = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/settings/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(policy),
      });
      return j<{ ok?: boolean }>(r);
    },
    onSuccess: () => {
      toast.success('Politique de session enregistrée');
      void qc.invalidateQueries({ queryKey: ['security-session-policy'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeUser = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/security/sessions/${userId}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success('Sessions applicatives clôturées pour cet admin');
      void qc.invalidateQueries({ queryKey: ['security-sessions'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emergencyMut = useMutation({
    mutationFn: async (action: 'lockdown_flag' | 'revoke_sessions_all' | 'full_lockdown' | 'rotate_tokens_emergency') => {
      const r = await fetch('/api/security/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, reason: emergencyReason.trim() || 'Urgence console sécurité' }),
      });
      const t = await r.text();
      let body: { error?: string; message?: string };
      try {
        body = JSON.parse(t) as { error?: string; message?: string };
      } catch {
        body = { error: t };
      }
      if (!r.ok) throw new Error(body.error || t);
      return body;
    },
    onSuccess: (b) => {
      toast.success(b.message || 'Action exécutée');
      setEmergencyOpen(false);
      setRevokeAllOpen(false);
      setEmergencyReason('');
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ov = overviewQ.data;
  const isSuperAdmin = meQ.data?.isSuperAdmin === true;
  const level = scoreQ.data?.level || 'secure';
  const barClass =
    level === 'secure'
      ? 'bg-emerald-600'
      : level === 'warning'
        ? 'bg-amber-500'
        : 'bg-red-600';

  const mapMarkers = React.useMemo(() => {
    const pts = (geoQ.data || []).filter((p) => mapFilter === 'all' || p.status === mapFilter);
    return pts.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      color: p.status === 'blocked' ? '#ef4444' : p.status === 'normal' ? '#22c55e' : '#f97316',
      pulse: p.status !== 'normal',
      label: `${p.email || '—'}<br/>${p.ip || ''}${p.country ? `<br/>${p.country}${p.city ? ` · ${p.city}` : ''}` : ''}<br/>${p.at ? String(p.at).slice(0, 19) : ''}${p.geo_source ? `<br/><span style="opacity:.7">${p.geo_source}</span>` : ''}`,
    }));
  }, [geoQ.data, mapFilter]);

  const behaviorActionCounts = React.useMemo(() => {
    const sample = (behaviorQ.data as { user_behavior_sample?: { action?: string }[] })?.user_behavior_sample ?? [];
    const m: Record<string, number> = {};
    for (const row of sample) {
      const a = String(row.action || 'autre');
      m[a] = (m[a] || 0) + 1;
    }
    return m;
  }, [behaviorQ.data]);

  function renderAuditIcon(action: string, status: string) {
    if (status === 'failed') return <Ban className="h-3.5 w-3.5 text-red-500" />;
    if (action.includes('permission')) return <Shield className="h-3.5 w-3.5 text-violet-500" />;
    if (action.includes('status')) return <Activity className="h-3.5 w-3.5 text-blue-500" />;
    if (action.includes('login')) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    return <Sparkles className="h-3.5 w-3.5 text-slate-500" />;
  }

  const alerts: { level: string; text: string; action: string }[] = [];
  if ((ov?.failed_24h ?? 0) > 5) {
    alerts.push({
      level: 'critique',
      text: `${ov?.failed_24h} échecs de connexion sur 24h`,
      action: 'Consulter tentatives / audit',
    });
  }
  if ((ov?.admins_without_2fa ?? 0) > 0) {
    alerts.push({
      level: 'attention',
      text: `${ov?.admins_without_2fa} admin(s) sans 2FA`,
      action: 'Forcer adoption 2FA (process interne)',
    });
  }
  if ((ov?.blocked_ips ?? 0) > 0) {
    alerts.push({
      level: 'info',
      text: `${ov?.blocked_ips} entrée(s) sur liste noire IP`,
      action: 'Voir table ip_blacklist',
    });
  }

  return (
    <div className="space-y-6 pb-10">
      <SecurityAuditRealtime onEvent={appendLive} />
      <PageHeader
        title="Centre de sécurité"
        subtitle="Vue opérationnelle : alertes, sessions, politique, carte connexions, actions d’urgence (superadmin)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/audit"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <Shield className="h-3.5 w-3.5" /> Audit
            </Link>
            <a
              href="/api/security/report-pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF urgence
            </a>
            <Link
              href="/notifications?tab=composer&src=security"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <Bell className="h-3.5 w-3.5" /> Notifier
            </Link>
            <Button variant="outline" size="sm" type="button" onClick={() => void qc.invalidateQueries()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {/* SECTION 1 — Centre d’alertes */}
      <div
        className={cn(
          'sticky top-0 z-30 flex flex-col gap-2 rounded-xl border px-4 py-3 shadow-sm backdrop-blur-md',
          level === 'secure' && 'border-emerald-500/40 bg-emerald-500/10',
          level === 'warning' && 'border-amber-500/40 bg-amber-500/10',
          level === 'critical' && 'border-red-500/50 bg-red-500/10',
        )}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          {level === 'secure' ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : level === 'warning' ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-red-600" />
          )}
          <span>
            {level === 'secure' && '🟢 SÉCURISÉ'}
            {level === 'warning' && '🟡 ATTENTION'}
            {level === 'critical' && '🔴 ALERTE CRITIQUE'}
          </span>
          <span className="text-muted-foreground font-normal">
            Score {scoreQ.data?.score ?? '—'}/100 · polling 30s
          </span>
          <div className="ml-auto h-2 w-32 overflow-hidden rounded-full bg-background/80">
            <div className={cn('h-full transition-all', barClass)} style={{ width: `${scoreQ.data?.score ?? 0}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7 text-xs">
          <Metric label="Sessions actives 24h" value={ov?.active_sessions} />
          <Metric
            label="Échecs login 24h"
            value={ov?.failed_24h}
            danger={(ov?.failed_24h ?? 0) > 5}
          />
          <Metric label="IPs blacklist" value={ov?.blocked_ips} />
          <Metric label="Couverture 2FA" value={ov?.coverage_2fa != null ? `${ov.coverage_2fa}%` : undefined} />
          <Metric label="Admins sans 2FA" value={ov?.admins_without_2fa} />
          <Metric label="Tokens exp. (hint)" value={ov?.tokens_expired_hint} />
          <Metric label="Whitelist IPs" value={scoreQ.data?.breakdown?.whitelist_size} />
        </div>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Alertes actives (synthèse)</h3>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune alerte heuristique pour l’instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2">Niveau</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2">Action suggérée</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.text} className="border-b border-border/60">
                    <td className="py-2 pr-2 font-medium">{a.level}</td>
                    <td className="py-2 pr-2">{a.text}</td>
                    <td className="py-2">{a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(suspiciousQ.data?.length ?? 0) > 0 ? (
        <Card className="border-red-500/40 bg-red-950/25 p-4">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Activité suspecte (≥3 échecs / IP / 1h)</h3>
          <ul className="text-xs space-y-1 font-mono">
            {(suspiciousQ.data || []).map((x) => (
              <li key={x.ip}>
                {x.ip} — {x.failures} échecs —{' '}
                <Link href="/security#blacklist-ip" className="underline text-primary">
                  bloquer
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* SECTION 2 — Authentification */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5" /> Authentification & sessions
        </h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left">Connexion</th>
                  <th className="px-3 py-2 text-left">Dernière activité</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Pays</th>
                  <th className="px-3 py-2 text-left">Navigateur / OS</th>
                  <th className="px-3 py-2 text-left">Device</th>
                  <th className="px-3 py-2 text-left">État</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessionsQ.isLoading
                  ? [...Array(4)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="p-2">
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  : (sessionsQ.data || []).map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-[10px]">
                          {s.started_at || s.last_active_at ? String(s.started_at || s.last_active_at).slice(0, 19) : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[10px]">
                          {s.last_active_at ? String(s.last_active_at).slice(0, 19) : '—'}
                        </td>
                        <td className="px-3 py-2">{s.email || s.user_id?.slice(0, 8)}</td>
                        <td className="px-3 py-2 font-mono text-[10px]">{s.ip_address || '—'}</td>
                        <td className="px-3 py-2 text-[10px]">
                          {s.country || '—'}
                          {s.city ? <span className="text-muted-foreground"> · {s.city}</span> : null}
                        </td>
                        <td className="px-3 py-2 max-w-[140px] text-[10px] leading-tight">
                          <div className="truncate">{s.browser || '—'}</div>
                          <div className="truncate text-muted-foreground">{s.os || '—'}</div>
                        </td>
                        <td className="px-3 py-2 max-w-[100px] truncate text-[10px]">{s.device_type || '—'}</td>
                        <td className="px-3 py-2">
                          {s.is_active ? (
                            <span className="text-emerald-600 font-medium">Actif</span>
                          ) : (
                            <span className="text-muted-foreground">{s.hours_ago != null ? `Il y a ${s.hours_ago}h` : '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            type="button"
                            onClick={() => revokeUser.mutate(s.user_id)}
                            disabled={revokeUser.isPending}
                          >
                            Révoquer
                          </Button>
                        </td>
                      </tr>
                    ))}
                {!sessionsQ.isLoading && !(sessionsQ.data || []).length ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      Aucune session admin listée.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Politique de session → PATCH /api/settings/security</h3>
          {policyQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div>
                <Label>Durée max (h)</Label>
                <Input
                  type="number"
                  value={policy.max_session_hours}
                  onChange={(e) => setPolicy((p) => ({ ...p, max_session_hours: +e.target.value || 1 }))}
                />
              </div>
              <div>
                <Label>Timeout inactivité (min)</Label>
                <Input
                  type="number"
                  value={policy.idle_timeout_minutes}
                  onChange={(e) => setPolicy((p) => ({ ...p, idle_timeout_minutes: +e.target.value || 5 }))}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={policy.single_session}
                  onCheckedChange={(c) => setPolicy((p) => ({ ...p, single_session: c }))}
                />
                <span className="text-xs">Single session</span>
              </div>
              <div>
                <Label>Max tentatives avant lockout</Label>
                <Input
                  type="number"
                  value={policy.max_login_attempts}
                  onChange={(e) => setPolicy((p) => ({ ...p, max_login_attempts: +e.target.value || 3 }))}
                />
              </div>
              <div>
                <Label>Durée verrouillage (min)</Label>
                <Input
                  type="number"
                  value={policy.lockout_duration_minutes}
                  onChange={(e) => setPolicy((p) => ({ ...p, lockout_duration_minutes: +e.target.value || 5 }))}
                />
              </div>
              <div className="flex items-end">
                <Button size="sm" type="button" onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Tentatives de connexion (extrait)</h3>
          <div className="max-h-56 overflow-y-auto overflow-x-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Email</th>
                  <th className="py-1 pr-2">IP</th>
                  <th className="py-1">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {(loginsQ.data || []).map((l, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1 pr-2 whitespace-nowrap">{l.created_at ? String(l.created_at).slice(0, 19) : '—'}</td>
                    <td className="py-1 pr-2">{l.email || '—'}</td>
                    <td className="py-1 pr-2 font-mono">{l.ip_address || l.ip || '—'}</td>
                    <td className="py-1">{l.success === false ? <span className="text-red-600">Échec</span> : 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loginsQ.data?.length && !loginsQ.isLoading ? (
              <p className="text-muted-foreground py-4">Aucune donnée (table admin_login_history ou audit).</p>
            ) : null}
          </div>
        </Card>
      </section>

      {/* SECTION 3 — Contrôle d’accès */}
      <section className="space-y-3" id="blacklist-ip">
        <h2 className="text-lg font-semibold">Contrôle d’accès</h2>
        <SecurityAccessSection />
      </section>

      {/* SECTION 4 — Surveillance */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Video className="h-5 w-5" /> Surveillance temps réel
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 overflow-hidden">
            <h3 className="text-sm font-semibold mb-2">Carte connexions admin (24 h)</h3>
            {geoQ.isLoading ? (
              <Skeleton className="h-[280px] w-full min-h-[280px] min-w-0" />
            ) : (
              <div className="h-[280px] w-full min-h-[280px] min-w-0">
                <MapWrapper height={280} markers={mapMarkers} />
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              {(
                [
                  { id: 'all' as const, label: 'Tous', dot: 'bg-slate-400' },
                  { id: 'normal' as const, label: 'Normal', dot: 'bg-emerald-500' },
                  { id: 'blocked' as const, label: 'Bloqué (échec)', dot: 'bg-red-500' },
                  { id: 'unusual' as const, label: 'Inhabituel', dot: 'bg-orange-500' },
                ] as const
              ).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setMapFilter(x.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors',
                    mapFilter === x.id
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30'
                      : 'border-border text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', x.dot)} />
                  {x.label}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Flux sécurité (polling + Realtime si activé)</h3>
            <div ref={auditFeedRef} className="max-h-[280px] space-y-2 overflow-y-auto text-xs font-mono">
              {mergedAuditFeed.map((log) => {
                const m = (log.metadata || {}) as Record<string, unknown>;
                const ip = String(m.ip || m.ip_address || '');
                const action = String(log.action_type || log.action || '');
                const status = String(log.status || 'success');
                const desc =
                  action === 'permission_change'
                    ? 'Changement de permission'
                    : action === 'status_change'
                      ? 'Changement de statut'
                      : action === 'login'
                        ? 'Tentative de connexion'
                        : action || 'Événement';
                return (
                  <div key={String(log.id)} className="rounded border border-border/60 bg-muted/20 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {renderAuditIcon(action, status)}
                      <span className="font-medium">{desc}</span>
                      <span className={cn('ml-auto text-[10px]', status === 'failed' ? 'text-red-500' : 'text-emerald-600')}>
                        {status === 'failed' ? 'échec' : 'ok'}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {String(log.created_at || '').slice(0, 19)}
                      {ip ? <span className="text-blue-600 dark:text-blue-400"> · {ip}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        <SecurityChartsBlock />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" /> Comportement & recommandations (aperçu)
        </h2>
        <Card className="p-4 space-y-4 text-xs">
          {behaviorQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  Événements <span className="font-mono">user_behavior</span> (7 j) :{' '}
                  <span className="text-foreground tabular-nums">
                    {Number((behaviorQ.data as { user_behavior_last_7d_count?: number })?.user_behavior_last_7d_count ?? 0)}
                  </span>
                </p>
                {(behaviorQ.data as { recommendation_settings?: { algorithm?: string; is_active?: boolean } | null })
                  ?.recommendation_settings ? (
                  <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px]">
                    Algo :{' '}
                    {String(
                      (behaviorQ.data as { recommendation_settings?: { algorithm?: string } }).recommendation_settings
                        ?.algorithm || '—',
                    )}{' '}
                    ·{' '}
                    {(behaviorQ.data as { recommendation_settings?: { is_active?: boolean } }).recommendation_settings
                      ?.is_active
                      ? 'actif'
                      : 'inactif'}
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground">
                Aperçu sur l’échantillon récent (12 lignes). Sans envoi depuis l’app, les totaux restent bas.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(['view', 'add_to_cart', 'purchase', 'wishlist'] as const).map((act) => {
                  const n = behaviorActionCounts[act] ?? 0;
                  const max = Math.max(1, ...Object.values(behaviorActionCounts));
                  const pct = Math.round((n / max) * 100);
                  const labels: Record<string, string> = {
                    view: 'Vues',
                    add_to_cart: 'Panier',
                    purchase: 'Achats',
                    wishlist: 'Favoris',
                  };
                  return (
                    <div key={act} className="rounded-lg border border-border/80 bg-muted/20 p-2">
                      <div className="text-[10px] text-muted-foreground">{labels[act]}</div>
                      <div className="text-lg font-semibold tabular-nums">{n}</div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ingestion : POST REST <span className="font-mono">/rest/v1/user_behavior</span> avec JWT utilisateur (voir doc
                mobile / Edge Function).
              </p>
            </>
          )}
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="p-4 text-sm space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4" /> API & tokens (statut)
          </div>
          {secretsMetaQ.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <ul className="text-xs space-y-2">
              <li className="flex justify-between gap-2 border-b border-border/50 pb-1">
                <span className="text-muted-foreground">URL Supabase</span>
                <span className={secretsMetaQ.data?.data?.supabase_url_configured ? 'text-emerald-600' : 'text-destructive'}>
                  {secretsMetaQ.data?.data?.supabase_url_configured ? 'OK' : 'manquant'}
                </span>
              </li>
              <li className="flex justify-between gap-2 border-b border-border/50 pb-1">
                <span className="text-muted-foreground">Service role (serveur)</span>
                <span className={secretsMetaQ.data?.data?.service_role_configured ? 'text-emerald-600' : 'text-amber-600'}>
                  {secretsMetaQ.data?.data?.service_role_configured ? 'configuré' : 'absent'}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-muted-foreground">FCM / Firebase admin</span>
                <span
                  className={
                    secretsMetaQ.data?.data?.fcm_or_firebase_admin_configured ? 'text-emerald-600' : 'text-muted-foreground'
                  }
                >
                  {secretsMetaQ.data?.data?.fcm_or_firebase_admin_configured ? 'configuré' : 'non détecté'}
                </span>
              </li>
            </ul>
          )}
          <p className="text-[10px] text-muted-foreground">
            Aucune clé exposée. Rotation : consoles fournisseurs + variables hébergeur, puis boutons « Journaliser rotation »
            ci-dessous.
          </p>
          {isSuperAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => rotateSecretMut.mutate('service_role')}
                disabled={rotateSecretMut.isPending}
              >
                Journaliser rotation service role
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => rotateSecretMut.mutate('fcm')}
                disabled={rotateSecretMut.isPending}
              >
                Journaliser rotation FCM
              </Button>
            </div>
          ) : (
            <p className="text-[10px] text-amber-700 dark:text-amber-400">Déclaration de rotation : superadmin uniquement.</p>
          )}
        </Card>
        <Card className="p-4 text-sm space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <Shield className="h-4 w-4" /> Politique MDP (settings.password_policy)
          </div>
          {pwdPolQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <div>
                <Label>Longueur min.</Label>
                <Input
                  type="number"
                  min={6}
                  max={128}
                  value={pwdDraft.min_length}
                  onChange={(e) => setPwdDraft((p) => ({ ...p, min_length: +e.target.value || 6 }))}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div>
                <Label>Expiration (jours, vide = aucune)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="vide"
                  value={pwdDraft.max_age_days ?? ''}
                  onChange={(e) =>
                    setPwdDraft((p) => ({
                      ...p,
                      max_age_days: e.target.value === '' ? null : +e.target.value,
                    }))
                  }
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={pwdDraft.require_uppercase}
                  onCheckedChange={(c) => setPwdDraft((p) => ({ ...p, require_uppercase: c }))}
                  disabled={!isSuperAdmin}
                />
                <span>Majuscule requise</span>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={pwdDraft.require_number}
                  onCheckedChange={(c) => setPwdDraft((p) => ({ ...p, require_number: c }))}
                  disabled={!isSuperAdmin}
                />
                <span>Chiffre requis</span>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={pwdDraft.require_special}
                  onCheckedChange={(c) => setPwdDraft((p) => ({ ...p, require_special: c }))}
                  disabled={!isSuperAdmin}
                />
                <span>Caractère spécial requis</span>
              </div>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Application effective : hooks Auth / Edge (cette UI centralise la configuration).
          </p>
          {isSuperAdmin ? (
            <Button size="sm" type="button" onClick={() => savePwdMut.mutate()} disabled={savePwdMut.isPending}>
              Enregistrer la politique
            </Button>
          ) : null}
        </Card>
      </section>

      {isSuperAdmin ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
            <Skull className="h-5 w-5" /> Actions d’urgence (superadmin)
          </h2>
          <Card className="border-red-900/40 bg-red-950/20 p-4 space-y-3">
            <div>
              <Label>Motif (audit)</Label>
              <Input
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                placeholder="Raison obligatoire pour la traçabilité"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" type="button" onClick={() => emergencyMut.mutate('full_lockdown')}>
                VERROUILLAGE D'URGENCE
              </Button>
              <Button variant="destructive" size="sm" type="button" onClick={() => setRevokeAllOpen(true)}>
                RÉVOQUER TOUTES LES SESSIONS
              </Button>
              <Button variant="destructive" size="sm" type="button" onClick={() => emergencyMut.mutate('rotate_tokens_emergency')}>
                ROTATION D'URGENCE DES TOKENS
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Le drapeau lockdown est lu par le middleware Next. Les refresh tokens Supabase ne sont pas révoqués par la
              clôture <span className="font-mono">user_sessions</span>.
            </p>
          </Card>
        </section>
      ) : (
        <section className="rounded-lg border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldOff className="h-4 w-4 text-amber-600" />
            Actions d’urgence (lockdown, révocation sessions) : réservées aux super-administrateurs.
          </div>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => bootstrapSuperMut.mutate()}
            disabled={bootstrapSuperMut.isPending}
          >
            {bootstrapSuperMut.isPending ? 'Promotion...' : 'Créer / promouvoir ce compte en superadmin (bootstrap)'}
          </Button>
        </section>
      )}

      <ConfirmModal
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
        title="Verrouillage d’urgence"
        description="Active le drapeau lockdown en base. Le middleware Next refuse l’accès aux comptes non super-admin."
        confirmationPhrase="URGENCE"
        confirmLabel="Activer"
        onConfirm={() => emergencyMut.mutate('lockdown_flag')}
        variant="destructive"
      />
      <ConfirmModal
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
        title="Révoquer toutes les sessions applicatives"
        description="Clôture toutes les lignes user_sessions ouvertes. Ne révoque pas automatiquement les refresh tokens Supabase."
        confirmationPhrase="REVOQUER"
        confirmLabel="Exécuter"
        onConfirm={() => emergencyMut.mutate('revoke_sessions_all')}
        variant="destructive"
      />
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value?: string | number | null; danger?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-border/60 bg-background/60 px-2 py-1.5', danger && 'border-red-500/50')}>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums', danger && 'text-red-600')}>
        {value === undefined || value === null ? '—' : value}
      </div>
    </div>
  );
}
