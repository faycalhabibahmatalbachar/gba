'use client';

import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, extra }: Props) {
  return (
    <div className="mb-6 pb-5 animate-fade-in" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1
            className="page-header-title"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="page-header-subtitle"
              style={{
                color: 'var(--text-2)',
                fontSize: 13,
                margin: '4px 0 0',
                lineHeight: 1.5,
              }}
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
