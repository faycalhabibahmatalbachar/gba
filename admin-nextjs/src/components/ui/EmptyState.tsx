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
  default: <InboxOutlined className="text-5xl text-gray-300" />,
  search: <SearchOutlined className="text-5xl text-gray-300" />,
  orders: <ShoppingOutlined className="text-5xl text-gray-300" />,
  users: <TeamOutlined className="text-5xl text-gray-300" />,
  products: <ShoppingOutlined className="text-5xl text-gray-300" />,
  messages: <MessageOutlined className="text-5xl text-gray-300" />,
  banners: <PictureOutlined className="text-5xl text-gray-300" />,
  deliveries: <CarOutlined className="text-5xl text-gray-300" />,
  file: <FileTextOutlined className="text-5xl text-gray-300" />,
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
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
    >
      <div className="mb-4 opacity-80">{iconNode}</div>
      <Typography.Title level={5} style={{ margin: 0, marginBottom: 8 }}>
        {title}
      </Typography.Title>
      {description && (
        <Typography.Text type="secondary" className="block max-w-sm mb-4">
          {description}
        </Typography.Text>
      )}
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction} size="middle">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
