'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PhoneNotifPreviewProps {
  title: string;
  body: string;
  imageUrl?: string | null;
  iconUrl?: string | null;
  className?: string;
}

function PhoneFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative w-[132px] h-[268px] rounded-[28px] border-2 border-border bg-zinc-950 shadow-xl overflow-hidden">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-zinc-800" />
        <div className="absolute inset-3 top-6 rounded-xl bg-zinc-900/90 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export function PhoneNotifPreview({ title, body, imageUrl, iconUrl, className }: PhoneNotifPreviewProps) {
  const t = title.slice(0, 48) || 'Titre';
  const b = body.slice(0, 160) || 'Message';

  const notif = (
    <div className="p-2 mt-8 mx-1 rounded-xl bg-zinc-800/95 border border-white/10 text-left shadow-lg">
      <div className="flex gap-2">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="size-8 rounded-lg object-cover shrink-0 bg-zinc-700" />
        ) : (
          <div className="size-8 rounded-lg bg-[var(--brand)]/30 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-white truncate">{t}</p>
          <p className="text-[9px] text-zinc-300 line-clamp-3 whitespace-normal leading-snug mt-0.5">{b}</p>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="mt-1.5 rounded-md w-full h-14 object-cover" />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn('flex flex-wrap gap-8 justify-center items-start', className)}>
      <PhoneFrame label="Android">{notif}</PhoneFrame>
      <PhoneFrame label="iOS">{notif}</PhoneFrame>
    </div>
  );
}
