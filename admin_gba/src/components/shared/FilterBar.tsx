'use client';

import type { ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface FilterChip {
  id: string;
  label: string;
}

export interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  onRemoveChip?: (id: string) => void;
  onClearChips?: () => void;
  advancedFilters?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  chips = [],
  onRemoveChip,
  onClearChips,
  advancedFilters,
  className,
  children,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 h-9"
            aria-label="Recherche"
          />
        </div>
        {advancedFilters ? (
          <Popover>
            <PopoverTrigger
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'h-9 gap-1.5 shrink-0 inline-flex items-center',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres avancés
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              {advancedFilters}
            </PopoverContent>
          </Popover>
        ) : null}
        {children}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onRemoveChip?.(c.id)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              {c.label}
              <X className="h-3 w-3 opacity-70" />
            </button>
          ))}
          {onClearChips ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearChips}>
              Tout effacer
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
