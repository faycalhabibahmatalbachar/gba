'use client';

import React from 'react';
import { Typography } from 'antd';

type Props = {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, extra }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary" className="text-sm mt-1 block">
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  );
}
