'use client';

import { useEffect } from 'react';
import { App } from 'antd';

export default function ToastBridge() {
  const { message } = App.useApp();

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ type: 'success' | 'error' | 'info'; content: string }>;
      const type = e?.detail?.type;
      const content = e?.detail?.content;
      if (!type || !content) return;
      message[type](content);
    };

    window.addEventListener('gba-toast', handler);
    return () => window.removeEventListener('gba-toast', handler);
  }, [message]);

  return null;
}
