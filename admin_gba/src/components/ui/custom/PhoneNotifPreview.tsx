'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PhoneNotifPreviewProps {
  title: string;
  body: string;
  imageUrl?: string | null;
  className?: string;
}

/** Mockups SVG type smartphone — prévisualisation notification FCM (Android + iOS). */
export function PhoneNotifPreview({ title, body, imageUrl, className }: PhoneNotifPreviewProps) {
  const safeTitle = title.slice(0, 50) || 'Titre';
  const safeBody = body.slice(0, 150) || 'Corps du message';

  return (
    <div className={cn('flex flex-wrap gap-6 justify-center items-start', className)}>
      <div className="text-[10px] text-muted-foreground w-full text-center uppercase tracking-wider">
        Aperçu
      </div>
      {/* Android */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Android</span>
        <svg viewBox="0 0 140 280" className="w-[140px] h-[280px] drop-shadow-xl" aria-hidden>
          <rect x="8" y="8" width="124" height="264" rx="18" fill="#111" stroke="#333" strokeWidth="2" />
          <rect x="14" y="24" width="112" height="236" rx="10" fill="#1a1a1e" />
          <rect x="52" y="14" width="36" height="4" rx="2" fill="#333" />
          <foreignObject x="18" y="120" width="104" height="120">
            <div className="w-full h-full flex flex-col gap-1 p-2 rounded-lg bg-[#2d2d33] text-left text-[8px] leading-tight text-white shadow-md border border-white/10">
              <div className="font-semibold truncate">{safeTitle}</div>
              <div className="text-white/80 line-clamp-4 whitespace-normal">{safeBody}</div>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="mt-1 rounded w-full h-10 object-cover" />
              ) : null}
            </div>
          </foreignObject>
        </svg>
      </div>
      {/* iOS */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">iOS</span>
        <svg viewBox="0 0 140 280" className="w-[140px] h-[280px] drop-shadow-xl" aria-hidden>
          <rect x="8" y="8" width="124" height="264" rx="22" fill="#0c0c0e" stroke="#2c2c30" strokeWidth="2" />
          <rect x="14" y="20" width="112" height="244" rx="16" fill="#000" />
          <rect x="58" y="14" width="24" height="4" rx="2" fill="#222" />
          <foreignObject x="16" y="110" width="108" height="130">
            <div
              className="w-full rounded-2xl p-2.5 text-left text-[8px] leading-tight backdrop-blur-md border border-white/20 text-white"
              style={{ background: 'rgba(40,40,45,0.72)' }}
            >
              <div className="font-semibold truncate">{safeTitle}</div>
              <div className="text-white/85 mt-0.5 line-clamp-4 whitespace-normal">{safeBody}</div>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="mt-1.5 rounded-lg w-full h-10 object-cover" />
              ) : null}
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>
  );
}
