'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ChartWrapperProps {
  title?: string;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Hauteur minimale du slot graphique */
  minHeight?: number;
}

export function ChartWrapper({
  title,
  isLoading,
  error,
  onRetry,
  children,
  className,
  minHeight = 240,
}: ChartWrapperProps) {
  const errMsg = typeof error === 'string' ? error : error?.message;

  return (
    <div className={cn('rounded-xl border border-border bg-card min-w-0 flex flex-col', className)}>
      {title && (
        <div className="px-4 pt-4 pb-0">
          <h3 className="text-sm font-semibold text-foreground font-heading">{title}</h3>
        </div>
      )}
      <div className="p-4 flex-1 min-w-0" style={{ minHeight }}>
        {isLoading && (
          <div className="flex flex-col gap-2 h-full justify-center" style={{ minHeight }}>
            <Skeleton className="h-[85%] w-full rounded-lg" />
            <Skeleton className="h-3 w-1/3 mx-auto rounded" />
          </div>
        )}
        {!isLoading && errMsg && (
          <div
            className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground h-full"
            style={{ minHeight }}
          >
            <AlertCircle className="h-8 w-8 text-destructive/80" />
            <p>{errMsg}</p>
            {onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Réessayer
              </Button>
            )}
          </div>
        )}
        {!isLoading && !errMsg && (
          <div className="h-full w-full min-w-0 min-h-0">{children}</div>
        )}
      </div>
    </div>
  );
}
