'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Couleur stable dérivée du nom (HSL). */
function hueFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * 13) % 360;
  return `hsl(${h} 55% 42%)`;
}

export interface AvatarWithInitialsProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function AvatarWithInitials({ name, src, size = 'default', className }: AvatarWithInitialsProps) {
  const initials = initialsFromName(name || '?');
  const bg = hueFromString(name || 'x');

  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback
        className={cn('text-white font-semibold border-0')}
        style={{ backgroundColor: bg }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
