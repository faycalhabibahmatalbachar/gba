'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PdfPreviewProps {
  /** URL blob: ou https: vers un PDF */
  url?: string | null;
  className?: string;
  title?: string;
}

/**
 * Visionneuse PDF inline basique. Pour des PDF générés côté serveur, prévoir @react-pdf/renderer
 * ou export SVG → document séparé.
 */
export function PdfPreview({ url, className, title = 'Aperçu PDF' }: PdfPreviewProps) {
  if (!url) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        <FileText className="h-10 w-10 opacity-40" />
        <p>Aucun document à afficher.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden bg-card flex flex-col min-h-[480px]', className)}>
      <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground">{title}</div>
      <iframe title={title} src={url} className="flex-1 w-full min-h-[440px] bg-background" />
    </div>
  );
}
