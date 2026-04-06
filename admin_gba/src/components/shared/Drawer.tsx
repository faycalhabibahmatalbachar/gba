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

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  side?: 'right' | 'left';
  /** true = plein écran mobile, ~90vw desktop pour stepper */
  wide?: boolean;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  side = 'right',
  wide = false,
}: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'p-0 gap-0 flex flex-col border-border',
          wide
            ? 'w-full max-w-full sm:max-w-[90vw] sm:w-[min(90vw,1200px)]'
            : 'w-full max-w-full sm:max-w-[520px] sm:w-[520px]',
          className,
        )}
      >
        <motion.div
          initial={{ opacity: 0, x: side === 'right' ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="flex flex-col flex-1 min-h-0"
        >
          <SheetHeader className="border-b border-border px-4 py-4 shrink-0 text-left space-y-1">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-border px-4 py-3 bg-muted/40 sticky bottom-0">
              {footer}
            </div>
          ) : null}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
