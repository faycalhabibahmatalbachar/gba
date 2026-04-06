'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterChip {
  id: string;
  label: string;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  onRemoveChip?: (id: string) => void;
  onClearAllChips?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  chips = [],
  onRemoveChip,
  onClearAllChips,
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 h-9 bg-background"
          aria-label="Recherche"
        />
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onRemoveChip?.(c.id)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {c.label}
              <X className="h-3 w-3 opacity-70" />
            </button>
          ))}
          {onClearAllChips && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClearAllChips}>
              Effacer les filtres
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
