'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface JsonDiffViewerProps {
  before: unknown;
  after: unknown;
  className?: string;
}

function stringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? 'null';
  } catch {
    return String(v);
  }
}

function parseKeys(json: unknown): string[] {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return Object.keys(json as Record<string, unknown>);
  }
  return ['_'];
}

export function JsonDiffViewer({ before, after, className }: JsonDiffViewerProps) {
  const keys = React.useMemo(() => {
    const a = new Set([
      ...parseKeys(before),
      ...parseKeys(after),
    ]);
    return Array.from(a);
  }, [before, after]);

  return (
    <div className={cn('space-y-2', className)}>
      {keys.map((key) => {
        const bVal =
          before && typeof before === 'object' && !Array.isArray(before)
            ? (before as Record<string, unknown>)[key]
            : before;
        const aVal =
          after && typeof after === 'object' && !Array.isArray(after)
            ? (after as Record<string, unknown>)[key]
            : after;
        const bStr = stringify(key === '_' && before !== null && typeof before !== 'object' ? before : bVal);
        const aStr = stringify(key === '_' && after !== null && typeof after !== 'object' ? after : aVal);
        const same = bStr === aStr;

        return (
          <details key={key} className="rounded-lg border border-border bg-card overflow-hidden group" open={!same}>
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium bg-muted/40 flex items-center justify-between">
              <span>{key === '_' ? 'Document' : key}</span>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wide',
                  same ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400',
                )}
              >
                {same ? 'identique' : 'modifié'}
              </span>
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              <pre
                className={cn(
                  'p-2 text-[11px] font-mono max-h-48 overflow-auto m-0 bg-muted/20',
                  !same && 'text-red-700 dark:text-red-300 bg-red-500/5',
                )}
              >
                {bStr}
              </pre>
              <pre
                className={cn(
                  'p-2 text-[11px] font-mono max-h-48 overflow-auto m-0 bg-muted/10',
                  !same && 'text-emerald-800 dark:text-emerald-200 bg-emerald-500/5',
                )}
              >
                {aStr}
              </pre>
            </div>
          </details>
        );
      })}
    </div>
  );
}
