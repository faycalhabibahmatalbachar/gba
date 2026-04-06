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

/** Diff texte ligne à ligne : vert = ajouté, rouge = supprimé, ambre = modifié (même index différent). */
export function JsonDiffViewer({ before, after, className }: JsonDiffViewerProps) {
  const aLines = stringify(before).split('\n');
  const bLines = stringify(after).split('\n');
  const max = Math.max(aLines.length, bLines.length);
  const rows: { left?: string; right?: string; kind: 'same' | 'add' | 'remove' | 'change' }[] = [];

  for (let i = 0; i < max; i++) {
    const L = aLines[i];
    const R = bLines[i];
    if (L === R) rows.push({ left: L, right: R, kind: 'same' });
    else if (L === undefined) rows.push({ right: R, kind: 'add' });
    else if (R === undefined) rows.push({ left: L, kind: 'remove' });
    else rows.push({ left: L, right: R, kind: 'change' });
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono rounded-lg border border-border overflow-hidden', className)}>
      <div className="border-b md:border-b-0 md:border-r border-border bg-muted/20">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/40">
          Avant
        </div>
        <pre className="p-2 max-h-[min(420px,50vh)] overflow-auto m-0">
          {rows.map((r, i) => (
            <div
              key={`l-${i}`}
              className={cn(
                'whitespace-pre-wrap break-all px-1 rounded-sm',
                r.kind === 'remove' && 'bg-red-500/15 text-red-700 dark:text-red-300',
                r.kind === 'change' && 'bg-amber-500/12 text-amber-900 dark:text-amber-200',
                r.kind === 'add' && 'text-muted-foreground/40',
                r.kind === 'same' && 'text-foreground',
              )}
            >
              {r.left ?? ' '}
            </div>
          ))}
        </pre>
      </div>
      <div className="bg-muted/10">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/40">
          Après
        </div>
        <pre className="p-2 max-h-[min(420px,50vh)] overflow-auto m-0">
          {rows.map((r, i) => (
            <div
              key={`r-${i}`}
              className={cn(
                'whitespace-pre-wrap break-all px-1 rounded-sm',
                r.kind === 'add' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                r.kind === 'change' && 'bg-amber-500/12 text-amber-900 dark:text-amber-200',
                r.kind === 'remove' && 'text-muted-foreground/40',
                r.kind === 'same' && 'text-foreground',
              )}
            >
              {r.right ?? ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
