'use client';

import React from 'react';

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string; pulse?: boolean }> = {
  pending:    { color: '#F59E0B', bgColor: 'rgba(245,158,11,0.10)',  label: 'En attente',  pulse: true },
  confirmed:  { color: '#3B82F6', bgColor: 'rgba(59,130,246,0.10)',  label: 'Confirmée' },
  processing: { color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.10)',  label: 'Préparation', pulse: true },
  shipped:    { color: '#14B8A6', bgColor: 'rgba(20,184,166,0.10)',  label: 'Expédiée' },
  delivered:  { color: '#10B981', bgColor: 'rgba(16,185,129,0.10)',  label: 'Livrée' },
  cancelled:  { color: '#EF4444', bgColor: 'rgba(239,68,68,0.10)',   label: 'Annulée' },
  refunded:   { color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.10)',  label: 'Remboursée' },
};

type BadgeSize = 'sm' | 'md' | 'lg';

type Props = { 
  status: string | null; 
  className?: string;
  size?: BadgeSize;
  showDot?: boolean;
};

export function OrderStatusBadge({ status, className, size = 'md', showDot = true }: Props) {
  const key = String(status || 'pending').toLowerCase();
  const config = STATUS_CONFIG[key] || {
    color: 'var(--text-3)',
    bgColor: 'var(--bg-hover)',
    label: key || '—',
  };

  const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
    sm: { fontSize: 10, padding: '2px 6px' },
    md: { fontSize: 11, padding: '3px 8px' },
    lg: { fontSize: 12, padding: '4px 10px' },
  };

  const dotSize = { sm: 5, md: 6, lg: 7 };

  return (
    <span
      className={`status-badge ${className || ''}`}
      style={{
        ...sizeStyles[size],
        backgroundColor: config.bgColor,
        color: config.color,
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        lineHeight: 1.4,
      }}
    >
      {showDot && (
        <span
          className={config.pulse ? 'animate-pulse-dot' : ''}
          style={{
            width: dotSize[size],
            height: dotSize[size],
            borderRadius: '50%',
            backgroundColor: config.color,
            flexShrink: 0,
          }}
        />
      )}
      {config.label}
    </span>
  );
}

export const ORDER_STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
