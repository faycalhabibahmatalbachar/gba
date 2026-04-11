'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DashboardAlertItem = {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  link?: string;
  actionLabel?: string;
};

type Props = {
  items: DashboardAlertItem[];
  onDismiss?: (id: string) => void;
};

const MAX = 5;

export function DashboardAlerts({ items, onDismiss }: Props) {
  const router = useRouter();
  const visible = items.slice(0, MAX);

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <span>Toutes les opérations se déroulent normalement.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {visible.map((a) => (
          <motion.div
            key={a.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
              a.type === 'error' && 'border-[#FF4B6E]/40 bg-[#FF4B6E]/8 text-foreground',
              a.type === 'warning' && 'border-[#FFB020]/45 bg-[#FFB020]/10 text-foreground',
              a.type === 'info' && 'border-blue-500/35 bg-blue-500/10 text-foreground',
            )}
          >
            {a.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF4B6E]" />
            ) : a.type === 'warning' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-[#FFB020]" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            )}
            <span className="min-w-0 flex-1 text-xs font-medium leading-snug">{a.message}</span>
            {a.link ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1 px-2 text-xs font-semibold"
                onClick={() => router.push(a.link!)}
              >
                {a.actionLabel || 'Voir'}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {onDismiss ? (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onDismiss(a.id)}>
                ×
              </Button>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
