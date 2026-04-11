import * as React from 'react';
import { Package, ShoppingBag, Truck } from 'lucide-react';

import { cn } from '@/lib/utils';

function MockPanels() {
  return (
    <div
      className="relative mt-10 hidden h-40 overflow-hidden rounded-xl border border-border/50 bg-card/50 sm:block"
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
      <div className="absolute inset-0 flex gap-2 p-3 blur-sm">
        <div className="h-full flex-1 rounded-lg bg-muted" />
        <div className="h-full flex-[1.2] rounded-lg bg-muted/80" />
        <div className="h-full w-16 rounded-lg bg-primary/20" />
      </div>
      <div className="absolute bottom-2 left-3 text-[10px] font-medium text-muted-foreground/80">Aperçu opérations</div>
    </div>
  );
}

function DefaultBranding() {
  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-md shadow-primary/20">
          G
        </div>
        <div>
          <p className="font-heading text-lg font-semibold tracking-tight text-foreground">GBA</p>
          <p className="text-sm text-muted-foreground">Back-office e-commerce</p>
        </div>
      </div>
      <p className="mt-6 text-base leading-relaxed text-foreground/90">
        Gestion des commandes, catalogue et opérations — une console unique pour votre activité.
      </p>
      <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
        <li className="flex items-start gap-2.5">
          <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span>Commandes et suivi en temps réel</span>
        </li>
        <li className="flex items-start gap-2.5">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span>Catalogue et stocks</span>
        </li>
        <li className="flex items-start gap-2.5">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span>Livraison & clients</span>
        </li>
      </ul>
      <MockPanels />
    </div>
  );
}

export type AuthShellProps = {
  children: React.ReactNode;
  /** Remplace le panneau gauche par défaut (logo + puces). */
  branding?: React.ReactNode;
  className?: string;
};

export function AuthShell({ children, branding, className }: AuthShellProps) {
  const left = branding ?? <DefaultBranding />;

  return (
    <div className={cn('relative min-h-screen w-full bg-background', className)}>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/[0.04] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <section
          className={cn(
            'order-2 flex flex-1 flex-col justify-center border-border/60 px-6 py-10 lg:order-1 lg:max-w-xl lg:border-r lg:px-12 xl:max-w-[36rem]',
            'bg-muted/25',
          )}
        >
          {left}
        </section>
        <section className="order-1 flex flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:order-2 lg:px-10 lg:py-12">
          <div className="mx-auto w-full max-w-[440px]">{children}</div>
        </section>
      </div>
    </div>
  );
}
