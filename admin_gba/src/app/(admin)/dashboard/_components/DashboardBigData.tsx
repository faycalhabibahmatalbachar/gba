'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fmtCurrencyXof } from './dashboard-utils';
import type { DashboardApiPayload } from '@/lib/hooks/useDashboardApi';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  data: DashboardApiPayload | undefined;
};

export function DashboardBigData({ data }: Props) {
  const [open, setOpen] = useState(false);
  const b = data?.bigData;
  const tp = data?.topProductsWeek ?? [];

  return (
    <div className="w-full rounded-xl border border-border bg-card">
      <Button
        type="button"
        variant="ghost"
        className="flex h-12 w-full items-center justify-between rounded-none px-4 text-sm font-semibold"
        onClick={() => setOpen((o) => !o)}
      >
        Données avancées
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </Button>
      {open ? (
        <div className="space-y-6 border-t border-border px-4 pb-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">LTV moyen</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmtCurrencyXof(b?.avgLtv ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Taux de réachat</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {Math.round((b?.repeatPurchaseRate ?? 0) * 100)}%
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Satisfaction (avis)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {b?.reviewAvg ? `${b.reviewAvg} / 5` : '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Matrice de rétention (aperçu)</p>
            <div className="grid grid-cols-3 gap-1 text-center font-mono text-xs">
              {(b?.retention3x3 ?? []).flatMap((row, i) =>
                row.map((cell, j) => (
                  <div key={`${i}-${j}`} className="rounded border border-border/50 bg-muted/30 py-2 tabular-nums">
                    {cell}
                  </div>
                )),
              )}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{b?.cohortNote}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold">Top livreurs (30 j.)</p>
              <ul className="space-y-2">
                {(b?.topDriversMonth ?? []).slice(0, 3).map((d, i) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <span>
                      {i + 1}. {d.name}
                    </span>
                    <span className="font-mono text-xs tabular-nums">{d.count} livraisons</span>
                  </li>
                ))}
                {(b?.topDriversMonth ?? []).length === 0 ? (
                  <li className="text-xs text-muted-foreground">Pas assez de données</li>
                ) : null}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold">Top produits (aperçu)</p>
              <ul className="space-y-2">
                {tp.map((p) => (
                  <li key={String(p.id ?? p.name)} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.fullName || p.name}</span>
                    <span className="font-mono text-xs tabular-nums">{p.sales} ventes</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
