'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fr } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const ALERT_KEY = 'gba_audit_alert_email_stub';

type Insights = {
  period_days: number;
  top_actions: { key: string; count: number }[];
  top_entities: { key: string; count: number }[];
  top_roles: { key: string; count: number }[];
  top_ips: { key: string; count: number }[];
};

export function AuditAdvancedSection() {
  const insightsQ = useQuery({
    queryKey: ['audit-insights'],
    queryFn: async (): Promise<Insights> => {
      const r = await fetch('/api/audit/insights?days=30', { credentials: 'include' });
      const j = (await r.json()) as Insights & { error?: string };
      if (!r.ok) throw new Error(j.error || 'Erreur insights');
      return j;
    },
    staleTime: 120_000,
  });

  const [alertEmail, setAlertEmail] = React.useState('');
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(ALERT_KEY);
      if (raw) setAlertEmail(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const saveAlertStub = () => {
    try {
      localStorage.setItem(ALERT_KEY, alertEmail.trim());
      toast.success('Préférence enregistrée localement (alertes automatiques : à brancher côté jobs).');
    } catch {
      toast.error('Stockage local indisponible');
    }
  };

  const [aFrom, setAFrom] = React.useState<Date | undefined>();
  const [aTo, setATo] = React.useState<Date | undefined>();
  const [bFrom, setBFrom] = React.useState<Date | undefined>();
  const [bTo, setBTo] = React.useState<Date | undefined>();

  const compareQ = useQuery({
    queryKey: ['audit-compare', aFrom?.toISOString(), aTo?.toISOString(), bFrom?.toISOString(), bTo?.toISOString()],
    enabled: Boolean(aFrom && aTo && bFrom && bTo),
    queryFn: async () => {
      const q = (from: Date, to: Date) =>
        fetch(
          `/api/audit/stats?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
          { credentials: 'include' },
        ).then(async (r) => {
          const j = (await r.json()) as { kpis?: { total_events: number; failed_count: number }; error?: string };
          if (!r.ok) throw new Error(j.error || 'Erreur');
          return j.kpis!;
        });
      const [k1, k2] = await Promise.all([q(aFrom!, aTo!), q(bFrom!, bTo!)]);
      return { a: k1, b: k2 };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Analyses &amp; alertes</CardTitle>
        <CardDescription>
          Aperçu des lots avancés (7A–7F) : insights, comparaison de périodes, alerte e-mail (stub), vues métier via
          filtres du journal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-2">Santé — top actions / entités (30 j)</h4>
            {insightsQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : insightsQ.error ? (
              <p className="text-sm text-destructive">
                {insightsQ.error instanceof Error ? insightsQ.error.message : 'Erreur'}
              </p>
            ) : (
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Actions : </span>
                  {(insightsQ.data?.top_actions ?? [])
                    .slice(0, 5)
                    .map((x) => `${x.key} (${x.count})`)
                    .join(', ')}
                </li>
                <li>
                  <span className="font-medium text-foreground">Entités : </span>
                  {(insightsQ.data?.top_entities ?? [])
                    .slice(0, 5)
                    .map((x) => `${x.key} (${x.count})`)
                    .join(', ')}
                </li>
                <li>
                  <span className="font-medium text-foreground">IP (metadata) : </span>
                  {(insightsQ.data?.top_ips ?? []).length
                    ? insightsQ.data!.top_ips
                        .map((x) => `${x.key} (${x.count})`)
                        .join(', ')
                    : '—'}
                </li>
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Alerte e-mail (stub)</h4>
            <p className="text-xs text-muted-foreground">
              Stocke une adresse en local pour un futur dispatch (cron / Edge). Aucun envoi depuis cette page.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-md">
              <input
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                placeholder="email@exemple.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                type="email"
              />
              <Button type="button" size="sm" variant="secondary" onClick={saveAlertStub}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Comparer deux périodes</h4>
          <Dialog>
            <DialogTrigger>
              <Button type="button" variant="outline" size="sm">
                Ouvrir la comparaison
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Comparer les totaux d&apos;audit</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Période A — début</Label>
                  <Calendar mode="single" selected={aFrom} onSelect={setAFrom} locale={fr} />
                  <Label>Période A — fin</Label>
                  <Calendar mode="single" selected={aTo} onSelect={setATo} locale={fr} />
                </div>
                <div className="space-y-2">
                  <Label>Période B — début</Label>
                  <Calendar mode="single" selected={bFrom} onSelect={setBFrom} locale={fr} />
                  <Label>Période B — fin</Label>
                  <Calendar mode="single" selected={bTo} onSelect={setBTo} locale={fr} />
                </div>
              </div>
              {aFrom && aTo && bFrom && bTo ? (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  {compareQ.isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : compareQ.data ? (
                    <>
                      <p>
                        Période A : <strong>{compareQ.data.a.total_events}</strong> événements,{' '}
                        <span className="text-destructive">{compareQ.data.a.failed_count} échecs</span>
                      </p>
                      <p>
                        Période B : <strong>{compareQ.data.b.total_events}</strong> événements,{' '}
                        <span className="text-destructive">{compareQ.data.b.failed_count} échecs</span>
                      </p>
                    </>
                  ) : compareQ.error ? (
                    <p className="text-destructive">
                      {compareQ.error instanceof Error ? compareQ.error.message : 'Erreur'}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sélectionnez début et fin pour A et B.</p>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-xs text-muted-foreground">
          Vues par acteur ou par entité : utilisez les filtres du journal (UUID acteur, type et ID d&apos;entité) et les
          liens « Ouvrir dans l&apos;admin » depuis le détail.
        </p>
      </CardContent>
    </Card>
  );
}
