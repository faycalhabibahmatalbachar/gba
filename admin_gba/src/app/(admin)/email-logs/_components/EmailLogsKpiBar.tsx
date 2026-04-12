'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpCircle } from 'lucide-react';
import { EMAIL_STATS_PERIOD_HINT } from './email-routing-copy';

type Props = {
  isLoading: boolean;
  totalMonth: number;
  successRate: number;
  failedMonth: number;
  pendingMonth: number;
};

export function EmailLogsKpiBar({ isLoading, totalMonth, successRate, failedMonth, pendingMonth }: Props) {
  const items: { label: string; value: string; emphasize?: 'danger' | 'warning' }[] = [
    { label: 'Total ce mois', value: String(totalMonth) },
    { label: 'Taux de succès', value: `${successRate}%` },
    { label: 'Échecs', value: String(failedMonth), emphasize: failedMonth > 0 ? 'danger' : undefined },
    { label: 'En attente', value: String(pendingMonth), emphasize: pendingMonth > 0 ? 'warning' : undefined },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, emphasize }) => (
        <Card key={label} className="p-3 relative overflow-hidden border-border/80">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            {label === 'Total ce mois' ? (
              <span title={EMAIL_STATS_PERIOD_HINT} className="inline-flex">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground rounded p-0.5 -mr-1"
                  aria-label={`Période : ${EMAIL_STATS_PERIOD_HINT}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
          </div>
          <div
            className={
              emphasize === 'danger'
                ? 'mt-1 text-2xl font-semibold tabular-nums text-destructive'
                : emphasize === 'warning'
                  ? 'mt-1 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-500'
                  : 'mt-1 text-2xl font-semibold tabular-nums tracking-tight'
            }
          >
            {isLoading ? <Skeleton className="h-8 w-20 mt-0.5" /> : value}
          </div>
        </Card>
      ))}
    </div>
  );
}
