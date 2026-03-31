'use client';

import React from 'react';

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string; pulse?: boolean }> = {
  pending: { 
    color: '#F59E0B', 
    bgColor: 'var(--warning-light)', 
    label: 'En attente',
    pulse: true
  },
  confirmed: { 
    color: '#3B82F6', 
    bgColor: 'var(--info-light)', 
    label: 'Confirmée' 
  },
  processing: { 
    color: '#8B5CF6', 
    bgColor: 'rgba(139, 92, 246, 0.1)', 
    label: 'Préparation',
    pulse: true
  },
  shipped: { 
    color: '#A855F7', 
    bgColor: 'rgba(168, 85, 247, 0.1)', 
    label: 'Expédiée' 
  },
  delivered: { 
    color: '#10B981', 
    bgColor: 'var(--success-light)', 
    label: 'Livrée' 
  },
  cancelled: { 
    color: '#EF4444', 
    bgColor: 'var(--danger-light)', 
    label: 'Annulée' 
  },
  refunded: { 
    color: '#8B5CF6', 
    bgColor: 'rgba(139, 92, 246, 0.1)', 
    label: 'Remboursée' 
  },
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
    color: 'var(--text-muted)',
    bgColor: 'var(--hover-bg)',
    label: key || '—',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-xs px-3 py-1.5',
    lg: 'text-sm px-4 py-2',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all duration-200 ${sizeClasses[size]} ${className || ''}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
    >
      {showDot && (
        <span
          className={`${dotSizes[size]} rounded-full ${config.pulse ? 'animate-pulse-dot' : ''}`}
          style={{ backgroundColor: config.color }}
        />
      )}
      {config.label}
    </span>
  );
}

export const ORDER_STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
