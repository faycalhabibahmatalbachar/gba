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
    <div className="mb-8 pb-6 border-b animate-fade-in" style={{ borderColor: 'var(--divider-color)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 
            className="page-header-title text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p 
              className="page-header-subtitle text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {extra && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}
