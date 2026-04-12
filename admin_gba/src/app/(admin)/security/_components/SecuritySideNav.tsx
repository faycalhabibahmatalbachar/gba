'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type NavItem = {
  id: string;
  href: string;
  icon: string;
  label: string;
  badge?: number;
};

const DEFAULT_ITEMS: NavItem[] = [
  { id: 'section-overview', href: '#section-overview', icon: '🛡', label: "Vue d'ensemble" },
  { id: 'section-auth', href: '#section-auth', icon: '🔐', label: 'Auth & sessions' },
  { id: 'section-access', href: '#section-access', icon: '🌍', label: "Contrôle d'accès" },
  { id: 'section-anomalies', href: '#section-anomalies', icon: '⚠', label: 'Anomalies admins' },
  { id: 'section-realtime', href: '#section-realtime', icon: '📡', label: 'Temps réel' },
  { id: 'section-alerts', href: '#section-alerts', icon: '🔔', label: 'Alertes' },
  { id: 'section-api', href: '#section-api', icon: '🔑', label: 'API & tokens' },
  { id: 'section-policy', href: '#section-policy', icon: '📋', label: 'Politique' },
  { id: 'section-media', href: '#section-media', icon: '💾', label: 'Documents' },
  { id: 'section-emergency', href: '#section-emergency', icon: '⚡', label: 'Urgence' },
];

export function SecuritySideNav({
  items = DEFAULT_ITEMS,
  alertCountBySection,
}: {
  items?: NavItem[];
  alertCountBySection?: Partial<Record<string, number>>;
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
      className="hidden lg:block w-[220px] shrink-0 sticky top-20 z-20 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-3 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto"
      aria-label="Sections sécurité"
    >
      <ul className="space-y-0.5 text-sm">
        {items.map((it) => {
          const extra = alertCountBySection?.[it.id] ?? it.badge;
          const isActive = active === it.id;
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
                <span className="text-base leading-none" aria-hidden>
                  {it.icon}
                </span>
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
    </nav>
  );
}
