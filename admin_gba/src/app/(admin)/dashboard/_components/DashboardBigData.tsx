'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DashboardApiPayload } from '@/lib/hooks/useDashboardApi';
import {
  ChevronDown,
  Package,
  RefreshCw,
  Star,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';

type Props = {
  data: DashboardApiPayload | undefined;
  loading?: boolean;
};

const cardShell =
  'rounded-[14px] border border-[rgba(0,0,0,0.07)] bg-card p-5 dark:border-border';

const sectionTitle = 'text-[12px] font-semibold uppercase tracking-[0.8px] text-muted-foreground';

const interactive =
  'cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--brand)_8%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] active:scale-[0.99]';

function fmtAbbrevXof(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v.toFixed(2).replace('.', ',')}M F CFA`;
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} F CFA`;
}

function fmtPlainF(n: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} F`;
}

function fmtRevenueShort(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `= ${v.toFixed(1).replace('.', ',')}M F`;
  }
  return `= ${fmtPlainF(n)} F`;
}

function pctCellClass(pct: number | null): string {
  if (pct === null) {
    return 'bg-muted/60 text-muted-foreground';
  }
  if (pct > 60) {
    return 'text-[#065F46] bg-[#ECFDF5] dark:bg-emerald-950/55 dark:text-emerald-300';
  }
  if (pct >= 30) {
    return 'text-[#92400E] bg-[#FFFBEB] dark:bg-amber-950/50 dark:text-amber-200';
  }
  return 'text-[#991B1B] bg-[#FEF2F2] dark:bg-red-950/45 dark:text-red-300';
}

function StarsRow({ value }: { value: number }) {
  const full = Math.floor(value);
  const frac = Math.max(0, Math.min(1, value - full));
  return (
    <div className="flex gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        if (i < full) {
          return (
            <Star
              key={i}
              className="h-4 w-4 fill-amber-500 text-amber-500"
              strokeWidth={0}
            />
          );
        }
        if (i === full && frac > 0) {
          return (
            <span key={i} className="relative inline-flex h-4 w-4 shrink-0">
              <Star className="absolute inset-0 h-4 w-4 text-neutral-300 dark:text-neutral-600" strokeWidth={1.2} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${frac * 100}%` }}
              >
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" strokeWidth={0} />
              </span>
            </span>
          );
        }
        return (
          <Star
            key={i}
            className="h-4 w-4 text-neutral-300 dark:text-neutral-600"
            strokeWidth={1.2}
          />
        );
      })}
    </div>
  );
}

function EmptyDriverIllustration() {
  return (
    <svg
      width="50"
      height="50"
      viewBox="0 0 50 50"
      className="mx-auto text-muted-foreground/40"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M10 38h30v3H10zm3-18c0-5 4-9 9-9h4c5 0 9 4 9 9v12H13V20zm9-11a6 6 0 0 0-6 6v9h18v-9a6 6 0 0 0-6-6h-6z"
      />
      <path
        fill="currentColor"
        d="M32 12h6l4 6v4h-4v-3l-2-3h-4z"
        opacity={0.7}
      />
    </svg>
  );
}

export function DashboardBigData({ data, loading }: Props) {
  const [open, setOpen] = useState(false);
  const b = data?.bigData;
  const tp = b?.topProductsMonth?.length ? b.topProductsMonth : data?.topProductsWeek ?? [];

  const showSkeleton = loading || !data;

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
        <div className="border-t border-border px-4 pb-4 pt-2">
          <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Intelligence business</h3>
              <p className="mt-0.5 text-xs italic text-muted-foreground">
                Métriques avancées · Mis à jour chaque nuit à 00h00
              </p>
            </div>
            <Link
              href="/analytics"
              className="text-xs font-medium text-[var(--brand)] hover:underline shrink-0"
            >
              Voir l’analyse complète →
            </Link>
          </div>

          {showSkeleton ? (
            <BigDataSkeleton />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Bloc gauche — métriques */}
              <div className={cn(cardShell, 'flex flex-col gap-0 p-0 overflow-hidden')}>
                <p className={cn(sectionTitle, 'px-5 pt-5 pb-2')}>Indicateurs clés</p>
                <MetricCard
                  href="/analytics#clients"
                  label="Valeur vie client"
                  icon={<TrendingUp className="h-4 w-4 text-[var(--brand)]" />}
                  value={fmtAbbrevXof(b?.avgLtv ?? 0)}
                  deltaPct={b?.ltvDeltaPct ?? null}
                  tooltip="LTV = revenu total généré par client sur toute sa durée de vie"
                />
                <div className="h-px w-full bg-[rgba(0,0,0,0.06)] dark:bg-border" />
                <MetricCard
                  href="/analytics#comportement"
                  label="Clients fidèles"
                  icon={<RefreshCw className="h-4 w-4 text-emerald-500" />}
                  value={`${Math.round((b?.repeatPurchaseRate ?? 0) * 100)}%`}
                  repeatBar={b?.repeatPurchaseRate ?? 0}
                  deltaPts={b?.repeatDeltaPts ?? null}
                  mode="repeat"
                  tooltip="Pourcentage de clients ayant passé au moins 2 commandes"
                />
                <div className="h-px w-full bg-[rgba(0,0,0,0.06)] dark:bg-border" />
                <MetricCard
                  href="/reviews"
                  label="Satisfaction clients"
                  icon={<Star className="h-4 w-4 text-amber-500" />}
                  value={b?.reviewAvg ? String(b.reviewAvg).replace('.', ',') : '—'}
                  valueSuffix="/5"
                  stars={b?.reviewAvg ?? 0}
                  reviewCount={b?.reviewCount ?? 0}
                  deltaReviewPts={b?.reviewDeltaPts ?? null}
                  mode="review"
                  tooltip="Note moyenne calculée sur tous les avis publiés"
                />
              </div>

              {/* Bloc centre — rétention */}
              <Link
                href="/analytics#cohortes"
                className={cn(cardShell, interactive, 'block transition-shadow hover:shadow-sm')}
              >
                <p className={sectionTitle}>Rétention clients</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Clients actifs par mois de première commande
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[280px] border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-muted/50 text-left text-muted-foreground">
                        <th className="rounded-tl px-2 py-2 font-medium">Cohorte</th>
                        <th className="px-2 py-2 font-medium">Taille</th>
                        <th className="px-2 py-2 font-medium">M+1</th>
                        <th className="px-2 py-2 font-medium">M+2</th>
                        <th className="rounded-tr px-2 py-2 font-medium">M+3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(b?.cohortRetentionRows ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                            Aucune cohorte disponible sur l’échantillon actuel.
                          </td>
                        </tr>
                      ) : (
                        (b?.cohortRetentionRows ?? []).map((row, idx) => (
                          <tr
                            key={row.cohortKey}
                            className={cn(
                              'h-9 border-0',
                              idx % 2 === 0 ? 'bg-card' : 'bg-[#FAFAFA] dark:bg-muted/20',
                            )}
                          >
                            <td className="px-2 py-1.5 align-middle">{row.cohortLabel}</td>
                            <td className="px-2 py-1.5 font-mono tabular-nums text-muted-foreground">
                              {row.size}
                            </td>
                            {([row.m1, row.m2, row.m3] as const).map((cell, i) => (
                              <td key={i} className="px-1 py-1 align-middle">
                                {cell === null ? (
                                  <div className="rounded px-2 py-0.5 text-center text-muted-foreground bg-muted/50">
                                    —
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      'rounded px-2 py-0.5 text-center tabular-nums',
                                      pctCellClass(cell),
                                    )}
                                  >
                                    {cell}%
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-right text-[11px] italic text-muted-foreground">
                  Basé sur les {b?.ordersUsedInCohortSample ?? 0} dernières commandes · Mis à jour
                  quotidiennement
                </p>
              </Link>

              {/* Bloc droit — classements */}
              <div className="flex flex-col gap-4">
                <div className={cn(cardShell, 'flex flex-col')}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className={sectionTitle}>Top livreurs</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        30 jours
                      </span>
                      <Link
                        href="/drivers"
                        className="text-[12px] font-medium text-[var(--brand)] hover:underline"
                      >
                        Voir tous →
                      </Link>
                    </div>
                  </div>
                  {(b?.topDriversMonth ?? []).length > 0 ? (
                    <ul className="space-y-2">
                      {(b?.topDriversMonth ?? []).slice(0, 3).map((d, idx) => {
                        const medal =
                          idx === 0
                            ? 'bg-amber-500 text-white'
                            : idx === 1
                              ? 'bg-slate-400 text-white'
                              : 'bg-[#CD7C5A] text-white';
                        return (
                          <li key={d.id}>
                            <Link
                              href={`/drivers?driver=${encodeURIComponent(d.id)}`}
                              className={cn(
                                'flex items-center gap-2 rounded-lg px-1 py-1.5 -mx-1',
                                interactive,
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                  medal,
                                )}
                              >
                                {idx + 1}
                              </span>
                              <AvatarWithInitials
                                src={d.avatarUrl || undefined}
                                name={d.name}
                                size={28}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium">
                                  {d.name.length > 16 ? d.name.slice(0, 16) + '…' : d.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {d.deliveries} livraisons
                                  {d.ratingAvg != null ? ` · ★ ${d.ratingAvg.toFixed(1)}` : ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--brand)]">
                                {fmtPlainF(d.earningsMonth)} F
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center py-4 text-center">
                      <EmptyDriverIllustration />
                      <p className="mt-3 text-sm font-medium text-muted-foreground">
                        Aucun livreur classé ce mois
                      </p>
                      <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">
                        Les classements apparaissent dès qu’un livreur effectue au moins 5 livraisons
                        dans le mois.
                      </p>
                      <Link
                        href="/drivers"
                        className="mt-3 text-xs font-medium text-[var(--brand)] hover:underline"
                      >
                        Voir tous les livreurs →
                      </Link>
                    </div>
                  )}
                </div>

                <div className={cn(cardShell, 'flex flex-col')}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className={sectionTitle}>Top produits</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        30 jours
                      </span>
                      <Link
                        href="/products"
                        className="text-[12px] font-medium text-[var(--brand)] hover:underline"
                      >
                        Voir tous →
                      </Link>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {tp.slice(0, 3).map((p, idx) => {
                      const top1 = tp[0]?.sales ?? 1;
                      const pctBar = top1 > 0 ? Math.round((p.sales / top1) * 1000) / 10 : 0;
                      const pid = p.id;
                      const href = pid
                        ? `/products?product=${encodeURIComponent(pid)}`
                        : '/products';
                      const rev = 'revenue' in p && typeof p.revenue === 'number' ? p.revenue : 0;
                      const img = 'imageUrl' in p ? p.imageUrl : null;
                      return (
                        <li key={String(pid ?? p.name)}>
                          <Link
                            href={href}
                            className={cn('flex gap-3 rounded-lg px-1 py-1 -mx-1', interactive)}
                          >
                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                              {img ? (
                                <Image
                                  src={img}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="36px"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium">
                                {p.fullName ?? p.name}
                              </p>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-black/[0.06] dark:bg-white/10">
                                <div
                                  className="h-full rounded-sm bg-[color-mix(in_srgb,var(--brand)_60%,transparent)]"
                                  style={{ width: `${pctBar}%` }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[13px] font-semibold tabular-nums text-foreground">
                                {p.sales} ventes
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {rev > 0 ? fmtRevenueShort(rev) : '—'}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BigDataSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-2 rounded-[14px] border border-border bg-card p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[72px] w-full" />
      </div>
      <div className="space-y-2 rounded-[14px] border border-border bg-card p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="space-y-2 rounded-[14px] border border-border bg-card p-4">
          <Skeleton className="h-3 w-28" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex h-11 items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-[60%]" />
                <Skeleton className="h-3 w-[30%]" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-[14px] border border-border bg-card p-4">
          <Skeleton className="h-3 w-28" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-1 pt-0.5">
                <Skeleton className="h-3.5 w-[80%]" />
                <Skeleton className="h-1 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type MetricProps = {
  href: string;
  label: string;
  icon: ReactNode;
  value: string;
  valueSuffix?: string;
  deltaPct?: number | null;
  deltaPts?: number | null;
  deltaReviewPts?: number | null;
  mode?: 'repeat' | 'review' | 'ltv';
  repeatBar?: number;
  stars?: number;
  reviewCount?: number;
  tooltip: string;
};

function MetricCard(p: MetricProps) {
  const deltaLine = () => {
    if (p.mode === 'repeat' && p.deltaPts != null) {
      const up = p.deltaPts >= 0;
      return (
        <span className={cn('text-xs tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {up ? '↑' : '↓'} {Math.abs(p.deltaPts).toFixed(1).replace('.', ',')} pts vs mois dernier
        </span>
      );
    }
    if (p.mode === 'review' && p.deltaReviewPts != null) {
      const up = p.deltaReviewPts >= 0;
      return (
        <span className={cn('text-xs tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {up ? '+' : ''}
          {p.deltaReviewPts.toFixed(1).replace('.', ',')} pts vs mois dernier
        </span>
      );
    }
    if (p.deltaPct != null) {
      const up = p.deltaPct >= 0;
      return (
        <span className={cn('text-xs tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {up ? '↑' : '↓'} {Math.abs(p.deltaPct).toFixed(1).replace('.', ',')}% vs mois dernier
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
          {p.label}
        </span>
        {p.icon}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums text-foreground">{p.value}</span>
        {p.valueSuffix ? <span className="text-sm text-muted-foreground">{p.valueSuffix}</span> : null}
      </div>
      {p.mode === 'repeat' ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-black/[0.07] dark:bg-white/10">
          <div
            className="h-full rounded-sm bg-emerald-500"
            style={{ width: `${Math.round((p.repeatBar ?? 0) * 100)}%` }}
          />
        </div>
      ) : null}
      {p.mode === 'review' ? (
        <>
          <div className="mt-2">
            <StarsRow value={p.stars ?? 0} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">({p.reviewCount} avis)</p>
        </>
      ) : null}
      <div className="mt-2">{deltaLine()}</div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">Période glissante 30 jours</p>
    </>
  );

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link href={p.href} className={cn('block px-5 py-4', interactive)}>
              {inner}
            </Link>
          }
        />
        <TooltipContent side="top" className="max-w-xs">
          {p.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
