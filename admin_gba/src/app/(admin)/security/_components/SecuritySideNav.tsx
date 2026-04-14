'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type NavItem = {
  id: string;
  href: string;
  icon: string;
  label: string;
  badge?: number;
  status?: 'ok' | 'warn' | 'critical' | 'info';
};

const DEFAULT_ITEMS: NavItem[] = [
  { id: 'section-overview', href: '#section-overview', icon: '•', label: "Vue d'ensemble", status: 'ok' },
  { id: 'section-auth', href: '#section-auth', icon: '•', label: 'Authentification', status: 'ok' },
  { id: 'section-access', href: '#section-access', icon: '•', label: "Contrôle d'accès", status: 'warn' },
  { id: 'section-realtime', href: '#section-realtime', icon: '•', label: 'Surveillance', status: 'info' },
  { id: 'section-alerts', href: '#section-alerts', icon: '•', label: 'Alertes', status: 'warn' },
  { id: 'section-api', href: '#section-api', icon: '•', label: 'API & Tokens', status: 'warn' },
  { id: 'section-policy', href: '#section-policy', icon: '•', label: 'Politique MDP', status: 'ok' },
  { id: 'section-media', href: '#section-media', icon: '•', label: 'Documents', status: 'info' },
  { id: 'section-emergency', href: '#section-emergency', icon: '•', label: "Actions d'urgence", status: 'critical' },
];

export function SecuritySideNav({
  items = DEFAULT_ITEMS,
  alertCountBySection,
  pollingLabel = 'Polling 30s',
  lastUpdatedLabel = '—',
}: {
  items?: NavItem[];
  alertCountBySection?: Partial<Record<string, number>>;
  pollingLabel?: string;
  lastUpdatedLabel?: string;
}) {
  const [active, setActive] = React.useState<string>(items[0]?.id ?? '');

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.target.id) setActive(e.target.id);
        }
      },
      { rootMargin: '-40% 0px -45% 0px', threshold: 0 },
    );
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav
      className="hidden lg:flex w-[200px] shrink-0 sticky top-20 z-20 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-3 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto flex-col"
      aria-label="Sections sécurité"
    >
      <ul className="space-y-0.5 text-sm">
        {items.map((it) => {
          const extra = alertCountBySection?.[it.id] ?? it.badge;
          const isActive = active === it.id;
          const dotClass =
            it.status === 'critical'
              ? 'bg-red-500'
              : it.status === 'warn'
                ? 'bg-amber-500'
                : it.status === 'ok'
                  ? 'bg-emerald-500'
                  : 'bg-blue-500';
          return (
            <li key={it.id}>
              <a
                href={it.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-2 transition-colors border-l-2 -ml-px',
                  isActive
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                onClick={() => setActive(it.id)}
              >
                <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} aria-hidden />
                <span className="flex-1 leading-tight">{it.label}</span>
                {extra != null && extra > 0 ? (
                  <span className="text-[10px] rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5 tabular-nums">
                    {extra > 99 ? '99+' : extra}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
        <p className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {pollingLabel}
        </p>
        <p className="mt-1">Dernière MAJ: {lastUpdatedLabel}</p>
      </div>
    </nav>
  );
}
