import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
        secondary: 'border-transparent bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
        destructive: 'border-transparent bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        success: 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
        warning: 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        info: 'border-transparent bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
        outline: 'border-gray-200 text-gray-700 dark:border-slate-600 dark:text-slate-300',
        pending: 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        confirmed: 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        processing: 'border-transparent bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
        shipped: 'border-transparent bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
        delivered: 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
        cancelled: 'border-transparent bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
