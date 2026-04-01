'use client';

import React from 'react';
import { Button, Typography } from 'antd';
import {
  InboxOutlined,
  SearchOutlined,
  ShoppingOutlined,
  TeamOutlined,
  FileTextOutlined,
  PictureOutlined,
  MessageOutlined,
  CarOutlined,
} from '@ant-design/icons';

const ICON_MAP: Record<string, React.ReactNode> = {
  default: <InboxOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  search: <SearchOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  orders: <ShoppingOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  users: <TeamOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  products: <ShoppingOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  messages: <MessageOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  banners: <PictureOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  deliveries: <CarOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
  file: <FileTextOutlined className="text-7xl" style={{ color: 'var(--text-muted)' }} />,
};

type Props = {
  icon?: keyof typeof ICON_MAP;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export default function EmptyState({
  icon = 'default',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: Props) {
  const iconNode = ICON_MAP[icon] ?? ICON_MAP.default;

  return (
    <div
      className={`flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in ${className}`}
    >
      <div className="mb-6 p-6 rounded-2xl" style={{ background: 'var(--bg-elevated)' }}>
        {iconNode}
      </div>

      <h3
        style={{
          color: 'var(--text-1)',
          fontFamily: 'var(--font-heading)',
          fontSize: 18,
          fontWeight: 600,
          margin: '0 0 6px',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          className="max-w-md mb-6 leading-relaxed"
          style={{ color: 'var(--text-2)', fontSize: 13 }}
        >
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button
          type="primary"
          onClick={onAction}
          size="large"
          style={{ height: 40, borderRadius: 8, fontWeight: 600, padding: '0 24px' }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
