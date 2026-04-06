'use client';

import * as React from 'react';
import { AlertCircle, Download, ImageIcon } from 'lucide-react';
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
  minHeight?: number;
}

export function ChartWrapper({
  title,
  isLoading,
  error,
  onRetry,
  children,
  className,
  minHeight = 260,
}: ChartWrapperProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const errMsg = typeof error === 'string' ? error : error?.message;

  const exportPng = React.useCallback(() => {
    const svg = wrapRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className={cn('rounded-xl border border-border bg-card min-w-0 flex flex-col', className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        {title ? <h3 className="text-sm font-semibold font-heading">{title}</h3> : <span />}
        {!isLoading && !errMsg ? (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={exportPng}>
              <Download className="h-3.5 w-3.5" />
              SVG
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                const svg = wrapRef.current?.querySelector('svg');
                if (!svg) return;
                const canvas = document.createElement('canvas');
                const box = svg.getBoundingClientRect();
                canvas.width = box.width * 2;
                canvas.height = box.height * 2;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                const img = new Image();
                const xml = new XMLSerializer().serializeToString(svg);
                const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
                img.onload = () => {
                  ctx.fillStyle = '#fff';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  URL.revokeObjectURL(url);
                  canvas.toBlob((b) => {
                    if (!b) return;
                    const u = URL.createObjectURL(b);
                    const a = document.createElement('a');
                    a.href = u;
                    a.download = 'chart.png';
                    a.click();
                    URL.revokeObjectURL(u);
                  });
                };
                img.src = url;
              }}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              PNG
            </Button>
          </div>
        ) : null}
      </div>
      <div className="p-4 flex-1 min-w-0" style={{ minHeight }}>
        {isLoading ? (
          <div className="flex flex-col gap-2 justify-center h-full" style={{ minHeight }}>
            <Skeleton className="h-[85%] w-full rounded-lg" />
            <Skeleton className="h-3 w-1/3 mx-auto" />
          </div>
        ) : null}
        {!isLoading && errMsg ? (
          <div
            className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground h-full"
            style={{ minHeight }}
          >
            <AlertCircle className="h-8 w-8 text-destructive/80" />
            <p>{errMsg}</p>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Réessayer
              </Button>
            ) : null}
          </div>
        ) : null}
        {!isLoading && !errMsg ? (
          <div ref={wrapRef} className="h-full w-full min-w-0 min-h-0">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
