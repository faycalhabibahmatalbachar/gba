'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme } from 'antd';

type ThemeCtx = {
  dark: boolean;
  toggle: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}

// antd v6 may not expose cssVar in its TypeScript types yet.
// We spread it via a typed-safe workaround to avoid build errors while keeping
// the stable CSS-variable key that prevents SSR/client hash mismatch (hydration error).
const STABLE_CSS_VAR_PROP = { cssVar: { key: 'gba' } } as Record<string, unknown>;

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);

  // ── 1. Init from localStorage or system preference ──────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gba-theme');
      if (saved !== null) {
        setDark(saved === 'dark');
      } else {
        // Fall back to OS dark/light on first visit
        setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    } catch {}
    setReady(true);
  }, []);

  // ── 2. Sync dark class to <html> for Tailwind dark: variants ─────────
  // CRITICAL: without this, all dark:bg-* dark:text-* classes never activate.
  // The ThemeProvider only changes AntD's internal algorithm; Tailwind needs
  // the "dark" class on <html> to activate its dark: variant.
  useEffect(() => {
    if (!ready) return;
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark, ready]);

  const toggle = useCallback(() => {
    setDark(v => {
      const next = !v;
      try {
        localStorage.setItem('gba-theme', next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(() => ({ dark, toggle, ready }), [dark, toggle, ready]);

  // Only apply dark algorithm AFTER mount to avoid SSR/client hash mismatch
  const algorithm = ready && dark ? theme.darkAlgorithm : theme.defaultAlgorithm;

  const themeConfig = {
    algorithm,
    token: {
      colorPrimary: '#4f46e5',
      colorPrimaryHover: '#6366f1',
      colorPrimaryActive: '#4338ca',
      borderRadius: 12,
      borderRadiusLG: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.08)',
    },
    components: {
      Card: { borderRadiusLG: 14, paddingLG: 20 },
      Table: {
        borderRadius: 10,
        headerBg: ready && dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      },
      Button: { borderRadius: 10, fontWeight: 500 },
      Input: { borderRadius: 10 },
      Select: { borderRadius: 10 },
    },
  };

  return (
    <ThemeContext.Provider value={value}>
      {/* STABLE_CSS_VAR_PROP forces a fixed CSS-variable prefix key,
          preventing the dynamic _R_Xrlb_ hash from changing between
          SSR and client hydration (React hydration mismatch fix). */}
      <ConfigProvider {...(STABLE_CSS_VAR_PROP as object)} theme={themeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
