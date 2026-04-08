'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Mail, Send, Sliders, Activity, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { parseApiJson } from '@/lib/fetch-api-json';

type Row = {
  id: string;
  template_name: string;
  to_email: string;
  subject: string;
  status: string;
  provider?: string | null;
  latency_ms?: number | null;
  error_message?: string | null;
  created_at?: string;
};

function emailStatusLabel(s: string): string {
  const k = String(s || '').toLowerCase();
  const m: Record<string, string> = {
    sent: 'Envoyé',
    failed: 'Échec',
    pending: 'En attente',
    bounced: 'Rebond',
    cancelled: 'Annulé',
  };
  return m[k] || s;
}

function providerLabel(p?: string | null): string {
  const k = String(p || '').toLowerCase();
  if (k === 'resend') return 'Resend';
  if (k === 'smtp') return 'SMTP';
  if (k === 'mock') return 'Simulé';
  return p || '—';
}

type TabId = 'journal' | 'politiques' | 'plateforme';

export function EmailLogsPage() {
  const [tab, setTab] = React.useState<TabId>('journal');
  const [offset, setOffset] = React.useState(0);
  const [q, setQ] = React.useState('');
  const [toEmail, setToEmail] = React.useState('');
  const [provider, setProvider] = React.useState('all');
  const [status, setStatus] = React.useState('all');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [to, setTo] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [bodyHtml, setBodyHtml] = React.useState('<p></p>');
  const [attachments, setAttachments] = React.useState<{ url: string; name: string }[]>([]);
  const limit = 80;

  const health = useQuery({
    queryKey: ['admin-health-email'],
    queryFn: async () => {
      const r = await fetch('/api/admin/health', { credentials: 'include' });
      return parseApiJson<{ services?: { service: string; status: 'ok' | 'error'; provider: string; error?: string }[] }>(r);
    },
    refetchInterval: 30000,
  });

  const connectivity = useQuery({
    queryKey: ['system-connectivity'],
    queryFn: async () => {
      const r = await fetch('/api/system/connectivity', { credentials: 'include' });
      const x = await parseApiJson<{ data?: Record<string, unknown> }>(r);
      if (!r.ok) throw new Error((x as { error?: string }).error || 'Connectivité indisponible');
      return x.data ?? {};
    },
    refetchInterval: 120_000,
    enabled: tab === 'plateforme',
  });

  const logs = useQuery({
    queryKey: ['email-logs-v2', offset, q, toEmail, provider, status],
    queryFn: async () => {
      const u = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (q.trim()) u.set('q', q.trim());
      if (toEmail.trim()) u.set('toEmail', toEmail.trim());
      if (provider !== 'all') u.set('provider', provider);
      if (status !== 'all') u.set('status', status);
      const r = await fetch(`/api/email-logs?${u.toString()}`, { credentials: 'include' });
      const x = await parseApiJson<{ data: Row[]; count: number; error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Erreur');
      return x;
    },
    enabled: tab === 'journal',
  });

  const stats = useQuery({
    queryKey: ['email-logs-stats'],
    queryFn: async () => {
      const r = await fetch('/api/email-logs?mode=stats', { credentials: 'include' });
      const x = await parseApiJson<{
        total_month: number;
        success_rate: number;
        failed_month: number;
        pending_month: number;
        error?: string;
      }>(r);
      if (!r.ok) throw new Error(x.error || 'Erreur stats');
      return x;
    },
    enabled: tab === 'journal',
  });

  const detail = useQuery({
    queryKey: ['email-log-detail', detailId],
    enabled: Boolean(detailId),
    queryFn: async () => {
      const r = await fetch(`/api/email-logs/${detailId}`, { credentials: 'include' });
      const x = await parseApiJson<{ data?: Record<string, unknown>; error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Erreur detail');
      return x.data as Record<string, unknown>;
    },
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const x = await parseApiJson<{ ok?: boolean; error?: string; messageId?: string }>(r);
      if (!r.ok || !x.ok) throw new Error(x.error || 'Échec');
      return x;
    },
    onSuccess: () => {
      toast.success('Email test envoyé');
      void logs.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/email-logs/${id}`, { method: 'POST', credentials: 'include' });
      const x = await parseApiJson<{ ok?: boolean; error?: string }>(r);
      if (!r.ok || !x.ok) throw new Error(x.error || 'Échec renvoi');
      return x;
    },
    onSuccess: () => {
      toast.success('Email renvoyé');
      void logs.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendManual = useMutation({
    mutationFn: async () => {
      const toList = to
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const r = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: toList, subject, body_html: bodyHtml, attachments }),
      });
      const x = await parseApiJson<{ ok?: boolean; error?: string | Record<string, unknown> }>(r);
      if (!r.ok || !x.ok) {
        const err =
          typeof x.error === 'string'
            ? x.error
            : x.error && typeof x.error === 'object'
              ? JSON.stringify(x.error)
              : 'Échec envoi';
        throw new Error(err);
      }
      return x;
    },
    onSuccess: () => {
      toast.success('Email envoyé');
      setComposeOpen(false);
      setTo('');
      setSubject('');
      setBodyHtml('<p></p>');
      setAttachments([]);
      void logs.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/email-logs/upload-attachment', { method: 'POST', credentials: 'include', body: fd });
      const x = await parseApiJson<{ url: string; name: string; error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Upload refusé');
      return x;
    },
    onSuccess: (x) => setAttachments((p) => [...p, { url: x.url, name: x.name }]),
    onError: (e: Error) => toast.error(e.message),
  });

  const emailSvc = health.data?.services?.find((s) => s.service === 'email');
  const rows = logs.data?.data || [];
  const total = logs.data?.count ?? 0;
  const envChecks = (connectivity.data?.env || {}) as Record<string, boolean>;
  const netChecks = (connectivity.data?.checks || []) as { target?: string; ok?: boolean; ms?: number; error?: string }[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Centre notifications emails"
        subtitle="Journal, politiques d'envoi et supervision connectivité (Resend prioritaire, SMTP secours)."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'journal' as const, label: 'Journal & envois', icon: Mail },
            { id: 'politiques' as const, label: 'Politiques & garde-fous', icon: Sliders },
            { id: 'plateforme' as const, label: 'Plateforme & réseau', icon: Activity },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={tab === t.id ? 'default' : 'outline'}
              className="gap-1.5"
              onClick={() => setTab(t.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
        <Link href="/settings" className="ml-auto">
          <Button type="button" size="sm" variant="ghost" className="gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            Paramètres globaux
          </Button>
        </Link>
      </div>

      {tab === 'journal' ? (
        <>
          {emailSvc?.status === 'error' ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 flex items-start gap-3">
              <AlertTriangle className="text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Email non configuré</p>
                <p className="text-sm text-muted-foreground">
                  Ajoutez <code className="text-xs">RESEND_API_KEY</code> (prioritaire) ou <code className="text-xs">SMTP_*</code>{' '}
                  dans <code className="text-xs">.env.local</code> puis redémarrez le serveur.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 flex items-center gap-2 flex-wrap">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <p className="text-sm">
                Canal opérationnel · Fournisseur : <strong>{providerLabel(emailSvc?.provider)}</strong>
              </p>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => sendTest.mutate()} disabled={sendTest.isPending}>
                Envoyer un email test
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Total ce mois', String(stats.data?.total_month ?? 0)],
              ['Taux de succès', `${stats.data?.success_rate ?? 0}%`],
              ['Échecs', String(stats.data?.failed_month ?? 0)],
              ['En attente', String(stats.data?.pending_month ?? 0)],
            ].map(([k, v]) => (
              <Card key={k} className="p-3">
                <div className="text-xs text-muted-foreground">{k}</div>
                <div className="text-lg font-semibold">{stats.isLoading ? <Skeleton className="h-6 w-16" /> : v}</div>
              </Card>
            ))}
          </div>

          <Card className="p-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-5">
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
                placeholder="Recherche sujet / erreur"
              />
              <Input
                value={toEmail}
                onChange={(e) => {
                  setToEmail(e.target.value);
                  setOffset(0);
                }}
                placeholder="Destinataire"
              />
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">Fournisseur : tous</option>
                <option value="resend">Resend</option>
                <option value="smtp">SMTP</option>
                <option value="mock">Simulé</option>
              </select>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">Statut : tous</option>
                <option value="sent">Envoyé</option>
                <option value="failed">Échec</option>
                <option value="pending">En attente</option>
              </select>
              <Button onClick={() => setComposeOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Composer
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
              <span>
                {total} entrées · page {offset / limit + 1}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
                  Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset((o) => o + limit)}>
                  Suivant
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Destinataire</th>
                    <th className="px-3 py-2">Sujet</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Fournisseur</th>
                    <th className="px-3 py-2">Latence</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.isLoading
                    ? [...Array(6)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={8} className="p-2">
                            <Skeleton className="h-8 w-full" />
                          </td>
                        </tr>
                      ))
                    : rows.map((r) => (
                        <tr key={r.id} className="border-b">
                          <td className="px-3 py-2 text-xs">{r.created_at?.slice(0, 19) || '—'}</td>
                          <td className="px-3 py-2 text-xs">{r.template_name}</td>
                          <td className="px-3 py-2 text-xs max-w-[220px] truncate">{r.to_email}</td>
                          <td className="px-3 py-2 text-xs max-w-[220px] truncate">{r.subject}</td>
                          <td className="px-3 py-2 text-xs">{emailStatusLabel(r.status)}</td>
                          <td className="px-3 py-2 text-xs">{providerLabel(r.provider)}</td>
                          <td className="px-3 py-2 text-xs">{r.latency_ms ?? '—'} ms</td>
                          <td className="px-3 py-2 text-xs flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>
                              Voir
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => resend.mutate(r.id)} disabled={resend.isPending}>
                              <Mail className="h-3 w-3 mr-1" />
                              Renvoyer
                            </Button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </Card>

          {composeOpen ? (
            <Card className="p-4 space-y-3">
              <p className="font-medium">Composer un email</p>
              <Label>Destinataires (emails séparés par virgule)</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="a@x.com,b@y.com" />
              <Label>Sujet</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Label>Corps HTML</Label>
              <Textarea rows={8} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
              <div className="space-y-2">
                <Label>Pièces jointes (JPG / PNG / PDF)</Label>
                <p className="text-[11px] text-muted-foreground">
                  Les fichiers sont hébergés sur Supabase puis joints réellement au message (Resend ou SMTP).
                </p>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload.mutate(f);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <span key={`${a.url}-${i}`} className="rounded-full border px-2 py-1 text-xs">
                      {a.name}
                      <button type="button" className="ml-2" onClick={() => setAttachments((p) => p.filter((_, idx) => idx !== i))}>
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setComposeOpen(false)}>
                  Fermer
                </Button>
                <Button onClick={() => sendManual.mutate()} disabled={!to.trim() || !subject.trim() || sendManual.isPending}>
                  Envoyer
                </Button>
              </div>
            </Card>
          ) : null}

          {detailId ? (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Détail de l&apos;envoi</p>
                <Button variant="outline" onClick={() => setDetailId(null)}>
                  Fermer
                </Button>
              </div>
              {detail.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <p className="text-sm">
                    <b>Sujet :</b> {String(detail.data?.subject || '')}
                  </p>
                  <p className="text-sm">
                    <b>Destinataire :</b> {String(detail.data?.to_email || '')}
                  </p>
                  <p className="text-sm">
                    <b>Fournisseur :</b> {providerLabel(String(detail.data?.provider || ''))} ·{' '}
                    <b>Statut :</b> {emailStatusLabel(String(detail.data?.status || ''))}
                  </p>
                  <iframe
                    sandbox=""
                    title="aperçu-email"
                    className="h-56 w-full rounded border"
                    srcDoc={String(detail.data?.body_html || detail.data?.html || '<p>Aperçu indisponible</p>')}
                  />
                  {detail.data?.error_message ? (
                    <p className="text-sm text-destructive">{String(detail.data.error_message)}</p>
                  ) : null}
                </>
              )}
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'politiques' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Routage fournisseur</h3>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
              <li>
                <code className="text-[11px]">EMAIL_PROVIDER=auto|resend|smtp</code> : en <strong>auto</strong>, Resend est utilisé si{' '}
                <code className="text-[11px]">RESEND_API_KEY</code> est présent, sinon SMTP.
              </li>
              <li>
                Domaine vérifié recommandé sur Resend pour un expéditeur pro (actuellement possible : sandbox Resend pour les tests).
              </li>
              <li>SMTP (Brevo, etc.) sert de secours ou de mode forcé si vous retirez Resend.</li>
            </ul>
            <Link href="/settings">
              <Button size="sm" variant="outline">Ouvrir les paramètres notifications</Button>
            </Link>
          </Card>
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Traçabilité & conformité</h3>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
              <li>Chaque envoi transactionnel passe par <code className="text-[11px]">email_logs</code> (statut, latence, messageId).</li>
              <li>Les pièces jointes manuelles transitent par le bucket <code className="text-[11px]">email-attachments</code> (URLs signées).</li>
              <li>En cas d&apos;indisponibilité du fournisseur, l&apos;action métier continue : l&apos;échec est journalisé.</li>
            </ul>
            <Link href="/docs/email-logs-features.md" target="_blank">
              <Button size="sm" variant="outline">Documentation fonctionnelle (fichier repo)</Button>
            </Link>
          </Card>
        </div>
      ) : null}

      {tab === 'plateforme' ? (
        <Card className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Variables d&apos;environnement (maskées)</h3>
            <p className="text-xs text-muted-foreground">Indicateurs booléens uniquement — jamais de secret en clair dans le navigateur.</p>
          </div>
          {connectivity.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              {Object.entries(envChecks).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 rounded-md border px-2 py-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{k}</span>
                  <span className={v ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'}>{v ? 'oui' : 'non'}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold mb-2">Tests réseau (HEAD, ~5s cible)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1 pr-2">Cible</th>
                    <th className="py-1 pr-2">Résultat</th>
                    <th className="py-1 pr-2">Temps</th>
                    <th className="py-1">Erreur</th>
                  </tr>
                </thead>
                <tbody>
                  {netChecks.map((c) => (
                    <tr key={String(c.target)} className="border-b border-border/60">
                      <td className="py-1 pr-2 font-mono">{String(c.target)}</td>
                      <td className="py-1 pr-2">{c.ok ? <span className="text-emerald-600">OK</span> : <span className="text-destructive">KO</span>}</td>
                      <td className="py-1 pr-2 tabular-nums">{c.ms ?? '—'} ms</td>
                      <td className="py-1 text-muted-foreground">{c.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
