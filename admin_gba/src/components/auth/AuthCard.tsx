import * as React from 'react';

import { cn } from '@/lib/utils';

export function AuthCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="auth-card"
      className={cn(
        'rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-foreground/5 md:p-8',
        'transition-shadow duration-200',
        className,
      )}
      {...props}
    />
  );
}
