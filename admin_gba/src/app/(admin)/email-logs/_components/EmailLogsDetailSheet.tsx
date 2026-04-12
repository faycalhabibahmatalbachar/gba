'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSecurityLongFr, formatSecurityShortFr } from '@/lib/security/security-time';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  data: Record<string, unknown> | undefined;
};

function providerLabel(p?: string | null): string {
  const k = String(p || '').toLowerCase();
  if (k === 'resend') return 'Resend';
  if (k === 'smtp') return 'SMTP';
  if (k === 'mock') return 'Simulé';
  return p || '—';
}

function emailStatusLabel(s: string): string {
  const k = String(s || '').toLowerCase();
  const m: Record<string, string> = {
    sent: 'Envoyé',
    failed: 'Échec',
    pending: 'En attente',
  };
  return m[k] || s;
}

export function EmailLogsDetailSheet({ open, onOpenChange, loading, data }: Props) {
  const subject = String(data?.subject || '');
  const to = String(data?.to_email || '');
  const status = String(data?.status || '');
  const provider = String(data?.provider || '');
  const err = data?.error_message != null ? String(data.error_message) : '';
  const created = data?.created_at != null ? String(data.created_at) : '';
  const sentAt = data?.sent_at != null ? String(data.sent_at) : '';
  const messageId = data?.message_id != null ? String(data.message_id) : '';
  const providerMessageId = data?.provider_message_id != null ? String(data.provider_message_id) : '';
  const latency = data?.latency_ms != null ? Number(data.latency_ms) : null;
  const template = data?.template_name != null ? String(data.template_name) : '';

  const html = String(data?.body_html || data?.html || '<p>Aperçu indisponible</p>');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="border-b border-border px-4 py-4 text-left space-y-1 shrink-0">
          <SheetTitle className="text-lg pr-8">Détail de l&apos;envoi</SheetTitle>
          <SheetDescription className="line-clamp-2">{subject || 'Sans sujet'}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4 py-1 border-b border-border/50">
                  <dt className="text-muted-foreground shrink-0">Créé</dt>
                  <dd className="text-right font-medium">{formatSecurityLongFr(created || null)}</dd>
                </div>
                {sentAt ? (
                  <div className="flex justify-between gap-4 py-1 border-b border-border/50">
                    <dt className="text-muted-foreground shrink-0">Envoyé</dt>
                    <dd className="text-right">{formatSecurityShortFr(sentAt)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 py-1 border-b border-border/50">
                  <dt className="text-muted-foreground">Destinataire</dt>
                  <dd className="text-right break-all">{to}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-border/50">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-mono text-xs">{template}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-border/50">
                  <dt className="text-muted-foreground">Statut</dt>
                  <dd>{emailStatusLabel(status)}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-border/50">
                  <dt className="text-muted-foreground">Fournisseur</dt>
                  <dd>{providerLabel(provider)}</dd>
                </div>
                {latency != null ? (
                  <div className="flex justify-between gap-4 py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Latence</dt>
                    <dd className="tabular-nums">{latency} ms</dd>
                  </div>
                ) : null}
              </dl>

              {err ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {err}
                </div>
              ) : null}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Aperçu</p>
                <iframe
                  sandbox=""
                  title="Aperçu email"
                  className="h-52 w-full rounded-lg border border-border bg-background"
                  srcDoc={html}
                />
              </div>

              <details className="group rounded-lg border border-border/80 bg-muted/20">
                <summary
                  className={cn(
                    'flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium',
                    'marker:content-none [&::-webkit-details-marker]:hidden',
                  )}
                >
                  <span>Identifiants techniques</span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border/60 px-3 py-2 space-y-2 text-xs font-mono break-all">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">ID log</span>
                    {String(data?.id || '—')}
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">message_id</span>
                    {messageId || '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">provider_message_id</span>
                    {providerMessageId || '—'}
                  </div>
                </div>
              </details>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3 flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
