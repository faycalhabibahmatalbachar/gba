'use client';

import * as React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSecurityShortFr } from '@/lib/security/security-time';
import { cn } from '@/lib/utils';

export type EmailLogRow = {
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

function statusBadgeVariant(
  s: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const k = String(s || '').toLowerCase();
  if (k === 'sent') return 'default';
  if (k === 'failed') return 'destructive';
  if (k === 'pending') return 'secondary';
  return 'outline';
}

type Props = {
  rows: EmailLogRow[];
  isLoading: boolean;
  onOpenDetail: (id: string) => void;
  onResend: (id: string) => void;
  resendPending: boolean;
};

export function EmailLogsTable({ rows, isLoading, onOpenDetail, onResend, resendPending }: Props) {
  return (
    <div className="rounded-xl border border-border/80 overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/35 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-2.5 whitespace-nowrap">Date</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Type</th>
              <th className="px-3 py-2.5 min-w-[140px]">Destinataire</th>
              <th className="px-3 py-2.5 min-w-[160px]">Sujet</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Statut</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Fournisseur</th>
              <th className="px-3 py-2.5 whitespace-nowrap text-right">Latence</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading
              ? [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="p-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/25 transition-colors">
                    <td className="px-3 py-2 align-top text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatSecurityShortFr(r.created_at ?? null)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-mono text-[11px] text-muted-foreground line-clamp-2">{r.template_name}</span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs max-w-[220px]">
                      <span className="line-clamp-2 break-all">{r.to_email}</span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs max-w-[240px]">
                      <span className="line-clamp-2" title={r.subject}>
                        {r.subject}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge variant={statusBadgeVariant(r.status)} className="font-normal text-[11px]">
                        {emailStatusLabel(r.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                          String(r.provider || '').toLowerCase() === 'resend' &&
                            'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
                          String(r.provider || '').toLowerCase() === 'smtp' &&
                            'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300',
                        )}
                      >
                        {providerLabel(r.provider)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {r.latency_ms != null ? `${r.latency_ms} ms` : '—'}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-8 text-xs" type="button" onClick={() => onOpenDetail(r.id)}>
                          Détail
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          type="button"
                          onClick={() => onResend(r.id)}
                          disabled={resendPending}
                        >
                          <Mail className="h-3 w-3" />
                          Renvoyer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
