'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, BookOpen, Mail, Sliders } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { parseApiJson } from '@/lib/fetch-api-json';
import { formatOutboundEmailError } from '@/lib/email/format-outbound-error';
import { EmailLogsChannelStatus } from './EmailLogsChannelStatus';
import { EmailLogsComposeSheet } from './EmailLogsComposeSheet';
import { EmailLogsDetailSheet } from './EmailLogsDetailSheet';
import { EmailLogsKpiBar } from './EmailLogsKpiBar';
import { EmailLogsTable, type EmailLogRow } from './EmailLogsTable';
import { EmailLogsToolbar } from './EmailLogsToolbar';
import { cn } from '@/lib/utils';
import { EMAIL_ROUTING_SUMMARY, EMAIL_TRACEBILITY_SHORT } from './email-routing-copy';

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

  const resetPagination = React.useCallback(() => setOffset(0), []);

  const health = useQuery({
    queryKey: ['admin-health-email'],
    queryFn: async () => {
      const r = await fetch('/api/admin/health', { credentials: 'include' });
      return parseApiJson<{ services?: { service: string; status: 'ok' | 'error'; provider: string; error?: string }[] }>(r);
    },
    refetchInterval: 30_000,
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
    enabled: tab === 'journal' || tab === 'plateforme',
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
      const x = await parseApiJson<{ data: EmailLogRow[]; count: number; error?: string }>(r);
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
    onError: (e: Error) => toast.error(formatOutboundEmailError(e.message)),
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
    onError: (e: Error) => toast.error(formatOutboundEmailError(e.message)),
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
    onError: (e: Error) => toast.error(formatOutboundEmailError(e.message)),
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
  const resendNet = netChecks.find((c) => c.target === 'resend_api');
  const resendReachable = connectivity.isFetched ? (resendNet ? !!resendNet.ok : null) : null;

  return (
    <div className="space-y-6 pb-10 max-w-[1600px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight font-heading">Centre notifications emails</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Journal des envois, routage Resend / SMTP et contrôle de connectivité.
          </p>
        </div>
        <Link
          href="/settings"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 shrink-0 inline-flex')}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Paramètres
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-muted/40 border border-border/60">
        {(
          [
            { id: 'journal' as const, label: 'Journal', icon: Mail },
            { id: 'politiques' as const, label: 'Politiques', icon: Sliders },
            { id: 'plateforme' as const, label: 'Plateforme', icon: Activity },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={tab === t.id ? 'default' : 'ghost'}
              className="gap-1.5 rounded-lg"
              onClick={() => setTab(t.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {tab === 'journal' ? (
        <>
          <EmailLogsChannelStatus
            emailSvc={emailSvc}
            hasResendKey={Boolean(envChecks.has_resend_key)}
            resendReachable={resendReachable}
            onSendTest={() => sendTest.mutate()}
            sendTestPending={sendTest.isPending}
          />

          <EmailLogsKpiBar
            isLoading={stats.isLoading}
            totalMonth={stats.data?.total_month ?? 0}
            successRate={stats.data?.success_rate ?? 0}
            failedMonth={stats.data?.failed_month ?? 0}
            pendingMonth={stats.data?.pending_month ?? 0}
          />

          <EmailLogsToolbar
            q={q}
            setQ={setQ}
            toEmail={toEmail}
            setToEmail={setToEmail}
            provider={provider}
            setProvider={setProvider}
            status={status}
            setStatus={setStatus}
            onCompose={() => setComposeOpen(true)}
            resetPagination={resetPagination}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {total} entrée{total > 1 ? 's' : ''} · page {offset / limit + 1}
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

          <EmailLogsTable
            rows={rows}
            isLoading={logs.isLoading}
            onOpenDetail={(id) => setDetailId(id)}
            onResend={(id) => resend.mutate(id)}
            resendPending={resend.isPending}
          />

          <EmailLogsComposeSheet
            open={composeOpen}
            onOpenChange={setComposeOpen}
            to={to}
            setTo={setTo}
            subject={subject}
            setSubject={setSubject}
            bodyHtml={bodyHtml}
            setBodyHtml={setBodyHtml}
            attachments={attachments}
            onRemoveAttachment={(i) => setAttachments((p) => p.filter((_, idx) => idx !== i))}
            onPickFile={(f) => upload.mutate(f)}
            onSend={() => sendManual.mutate()}
            sendPending={sendManual.isPending}
            uploadPending={upload.isPending}
          />

          <EmailLogsDetailSheet
            open={Boolean(detailId)}
            onOpenChange={(o) => {
              if (!o) setDetailId(null);
            }}
            loading={detail.isLoading}
            data={detail.data}
          />
        </>
      ) : null}

      {tab === 'politiques' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5 border-border/80">
            <h2 className="text-sm font-semibold mb-3">Routage fournisseur</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{EMAIL_ROUTING_SUMMARY}</p>
            <p className="text-xs text-muted-foreground mb-4">
              Domaine vérifié recommandé sur Resend en production ; bac à sable Resend pour les tests. SMTP (ex. Brevo) possible
              en secours ou forçage <code className="text-[11px] bg-muted px-1 rounded">EMAIL_PROVIDER=smtp</code>.
            </p>
            <Link href="/settings" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'inline-flex')}>
              Ouvrir les paramètres
            </Link>
          </Card>
          <Card className="p-5 border-border/80">
            <h2 className="text-sm font-semibold mb-3">Traçabilité</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{EMAIL_TRACEBILITY_SHORT}</p>
            <Link
              href="/docs/email-logs-features.md"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex')}
            >
              Documentation (repo)
            </Link>
          </Card>
        </div>
      ) : null}

      {tab === 'plateforme' ? (
        <Card className="p-5 space-y-6 border-border/80">
          <div>
            <h2 className="text-sm font-semibold">Variables d&apos;environnement</h2>
            <p className="text-xs text-muted-foreground mt-1">Indicateurs booléens — aucune clé exposée au navigateur.</p>
          </div>
          {connectivity.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              {Object.entries(envChecks).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="font-mono text-[10px] text-muted-foreground truncate" title={k}>
                    {k}
                  </span>
                  <span className={v ? 'text-emerald-600 font-medium shrink-0' : 'text-destructive font-medium shrink-0'}>
                    {v ? 'oui' : 'non'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold mb-2">Tests réseau (HEAD, ~5 s)</h2>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                    <th className="py-2 px-3">Cible</th>
                    <th className="py-2 px-3">Résultat</th>
                    <th className="py-2 px-3">Temps</th>
                    <th className="py-2 px-3">Erreur</th>
                  </tr>
                </thead>
                <tbody>
                  {netChecks.map((c) => (
                    <tr key={String(c.target)} className="border-b border-border/50 last:border-0">
                      <td className="py-2 px-3 font-mono">{String(c.target)}</td>
                      <td className="py-2 px-3">
                        {c.ok ? <span className="text-emerald-600 font-medium">OK</span> : <span className="text-destructive font-medium">KO</span>}
                      </td>
                      <td className="py-2 px-3 tabular-nums">{c.ms ?? '—'} ms</td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate" title={c.error || ''}>
                        {c.error || '—'}
                      </td>
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
