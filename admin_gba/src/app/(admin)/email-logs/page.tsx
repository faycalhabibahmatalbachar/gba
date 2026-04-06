'use client';

import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

type Row = {
  id: string;
  template_name: string;
  to_email: string;
  subject: string;
  status: string;
  error_message?: string | null;
  sent_at?: string | null;
  created_at?: string;
};

type ListRes = {
  data?: Row[];
  count?: number | null;
  offset?: number;
  limit?: number;
  resend_configured?: boolean;
  error?: string;
};

export default function EmailLogsPage() {
  const [status, setStatus] = React.useState<string>('all');
  const [template, setTemplate] = React.useState('');
  const [toFilter, setToFilter] = React.useState('');
  const [q, setQ] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [testTo, setTestTo] = React.useState('');
  const limit = 80;

  const query = useQuery({
    queryKey: ['email-logs', status, template, toFilter, q, from, toDate, offset],
    queryFn: async () => {
      const u = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (status !== 'all') u.set('status', status);
      if (template.trim()) u.set('template', template.trim());
      if (toFilter.trim()) u.set('to', toFilter.trim());
      if (q.trim()) u.set('q', q.trim());
      if (from) u.set('from', new Date(from).toISOString());
      if (toDate) u.set('to', new Date(toDate + 'T23:59:59').toISOString());
      const r = await fetch(`/api/email-logs?${u}`, { credentials: 'include' });
      const x = (await r.json()) as ListRes;
      if (!r.ok) throw new Error(x.error || 'Erreur');
      return x;
    },
  });

  const testMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/email-logs/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const x = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(x.error || 'Échec');
      return x;
    },
    onSuccess: () => {
      toast.success('Email de test envoyé (vérifiez la boîte et le tableau)');
      void query.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.count;
  const resendOk = query.data?.resend_configured === true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal des emails"
        subtitle="Resend / SMTP tracés dans email_logs — filtres avancés et test de configuration"
      />

      <Card className="p-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              resendOk
                ? 'rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400'
                : 'rounded-md bg-destructive/15 px-2 py-1 text-xs text-destructive'
            }
          >
            RESEND_API_KEY : {resendOk ? 'détectée' : 'manquante — les envois échoueront'}
          </span>
          {!resendOk ? (
            <span className="text-xs text-muted-foreground">
              Ajoutez la clé dans les variables d’environnement (local + Vercel) puis redéployez.
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v ?? 'all'); setOffset(0); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="failed">Échec</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Template (contient)</Label>
            <Input value={template} onChange={(e) => { setTemplate(e.target.value); setOffset(0); }} placeholder="security_alert" />
          </div>
          <div className="space-y-1">
            <Label>Destinataire (contient)</Label>
            <Input value={toFilter} onChange={(e) => { setToFilter(e.target.value); setOffset(0); }} placeholder="@" />
          </div>
          <div className="space-y-1">
            <Label>Sujet / erreur (contient)</Label>
            <Input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="GBA" />
          </div>
          <div className="space-y-1">
            <Label>Depuis (date)</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} />
          </div>
          <div className="space-y-1">
            <Label>Jusqu’au (date)</Label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setOffset(0); }} />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Test d’envoi (superadmin)</Label>
            <div className="flex gap-2">
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="vous@example.com" type="email" />
              <Button
                type="button"
                size="sm"
                disabled={!testTo.trim() || testMut.isPending || !resendOk}
                onClick={() => testMut.mutate()}
              >
                <Mail className="h-3.5 w-3.5 mr-1" />
                Envoyer test
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" type="button" onClick={() => void query.refetch()}>
            Actualiser
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            {total != null ? `${total} entrée(s)` : '—'} · page {offset / limit + 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={total != null && offset + limit >= total}
              onClick={() => setOffset((o) => o + limit)}
            >
              Suivant
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Destinataire</th>
                <th className="px-3 py-2">Sujet</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="p-2">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{r.created_at?.slice(0, 19) ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.template_name}</td>
                      <td className="px-3 py-2 text-xs">{r.to_email}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-xs">{r.subject}</td>
                      <td className="px-3 py-2 text-xs">{r.status}</td>
                      <td className="px-3 py-2 text-xs text-destructive max-w-[180px] truncate">{r.error_message || '—'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && !rows.length ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aucun log (migration email_logs appliquée ?)</p>
        ) : null}
      </Card>
    </div>
  );
}
