'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface AdminDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Largeur desktop (défaut 520px). Pleine largeur sur mobile via classes Sheet. */
  className?: string;
  side?: 'right' | 'left';
  footer?: React.ReactNode;
}

export function AdminDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  side = 'right',
  footer,
}: AdminDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton
        className={cn(
          'w-full max-w-full sm:max-w-[520px] sm:w-[min(520px,100%)] p-0 gap-0 flex flex-col border-border',
          className,
        )}
      >
        <motion.div
          initial={{ opacity: 0, x: side === 'right' ? 16 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetHeader className="border-b border-border px-4 py-4 shrink-0 text-left space-y-1">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-border px-4 py-3 bg-muted/30">{footer}</div>
          ) : null}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
