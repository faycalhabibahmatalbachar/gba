'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hslFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 360;
  return `hsl(${h} 52% 42%)`;
}

export interface AvatarWithInitialsProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

export function AvatarWithInitials({ name, src, size = 40, className }: AvatarWithInitialsProps) {
  const [broken, setBroken] = React.useState(false);
  const initials = initialsFromName(name || '?');
  const bg = hslFromName(name || 'x');
  const showImg = src && !broken;

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full ring-2 ring-border', className)}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          className="object-cover size-full"
          unoptimized={src.startsWith('http')}
          onError={() => setBroken(true)}
        />
      ) : null}
      {!showImg ? (
        <div
          className="flex size-full items-center justify-center text-sm font-semibold text-white"
          style={{ backgroundColor: bg }}
        >
          {initials}
        </div>
      ) : null}
    </div>
  );
}
