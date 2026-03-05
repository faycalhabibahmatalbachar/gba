'use client';

import React from 'react';
import { Tag } from 'antd';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'gold', label: 'En attente' },
  confirmed: { color: 'blue', label: 'Confirmée' },
  processing: { color: 'cyan', label: 'Préparation' },
  shipped: { color: 'geekblue', label: 'Expédiée' },
  delivered: { color: 'green', label: 'Livrée' },
  cancelled: { color: 'red', label: 'Annulée' },
  refunded: { color: 'purple', label: 'Remboursée' },
};

type Props = { status: string | null; className?: string };

export function OrderStatusBadge({ status, className }: Props) {
  const key = String(status || 'pending').toLowerCase();
  const config = STATUS_CONFIG[key] || { color: 'default', label: key || '—' };
  return (
    <Tag color={config.color} className={`transition-all duration-200 ${className || ''}`}>
      {config.label}
    </Tag>
  );
}

export const ORDER_STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));
