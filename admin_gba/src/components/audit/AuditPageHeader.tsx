'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, FileDown, Radio } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { downloadAuditExport } from '@/lib/audit/audit-logger';

export function AuditPageHeader({
  title = "Journal d'audit",
  subtitle,
  totalLabel,
  realtimeOk,
}: {
  title?: string;
  subtitle?: string;
  totalLabel?: string;
  /** Réutilise l’état temps réel du viewer si exposé plus tard ; optionnel */
  realtimeOk?: boolean | null;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState<'pdf' | 'csv' | 'json' | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['audit-page-kpis'] });
    void qc.invalidateQueries({ queryKey: ['audit-hourly'] });
    void qc.invalidateQueries({ queryKey: ['audit-daily'] });
    void qc.invalidateQueries({ queryKey: ['audit-cursor'] });
    void qc.invalidateQueries({ queryKey: ['audit-insights'] });
  };

  const runExport = async (format: 'csv' | 'json') => {
    setBusy(format);
    try {
      await downloadAuditExport({}, format);
    } finally {
      setBusy(null);
    }
  };

  const runPdf = async () => {
    setBusy('pdf');
    try {
      const r = await fetch('/api/audit/summary-pdf', { credentials: 'include' });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || 'PDF indisponible');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-resume-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold tracking-tight font-heading">{title}</h1>
          {realtimeOk != null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                realtimeOk
                  ? 'border-green-600/30 bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
              )}
            >
              <Radio className="h-3 w-3" />
              Temps réel
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="text-sm text-muted-foreground max-w-2xl">{subtitle}</p> : null}
        {totalLabel ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{totalLabel}</span> sur la fenêtre KPI (90 j par défaut)
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy !== null}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'data-popup-open:bg-muted')}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Exporter
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => void runPdf()}
              disabled={busy !== null}
            >
              PDF résumé (90 j)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void runExport('csv')} disabled={busy !== null}>
              CSV (filtres courants du journal : export global sans filtre depuis l’en-tête)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void runExport('json')} disabled={busy !== null}>
              JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
