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
      {/* Icon with gradient background */}
      <div className="mb-6 p-6 rounded-2xl" style={{ background: 'var(--hover-bg)' }}>
        {iconNode}
      </div>
      
      {/* Title with modern typography */}
      <h3 
        className="text-xl font-bold mb-2"
        style={{ 
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-heading)'
        }}
      >
        {title}
      </h3>
      
      {/* Description */}
      {description && (
        <p 
          className="text-sm max-w-md mb-6 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {description}
        </p>
      )}
      
      {/* CTA Button */}
      {actionLabel && onAction && (
        <Button 
          type="primary" 
          onClick={onAction} 
          size="large"
          className="font-semibold px-6 h-11 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
