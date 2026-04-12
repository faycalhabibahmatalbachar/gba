'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldOff } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function ForbiddenInner() {
  const sp = useSearchParams();
  const from = sp.get('from') || '';

  React.useEffect(() => {
    if (!from) return;
    void fetch('/api/audit/log-read-denied', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ path: from }),
    }).catch(() => {});
  }, [from]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="rounded-full bg-muted p-6">
        <ShieldOff className="h-14 w-14 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">
          Vous n’avez pas les droits suffisants pour afficher cette page. Si vous pensez qu’il s’agit d’une erreur,
          contactez un super administrateur.
        </p>
        {from ? (
          <p className="font-mono text-xs text-muted-foreground break-all">
            Chemin : {from}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className={cn(buttonVariants())}>
          Tableau de bord
        </Link>
        <Link href="/messages" className={cn(buttonVariants({ variant: 'outline' }))}>
          Messages
        </Link>
      </div>
    </div>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 py-16 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      }
    >
      <ForbiddenInner />
    </Suspense>
  );
}
