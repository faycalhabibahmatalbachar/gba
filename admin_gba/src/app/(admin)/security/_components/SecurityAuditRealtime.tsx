'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabase/client';

const WATCH = new Set([
  'login',
  'logout',
  'delete',
  'bulk_delete',
  'export',
  'bulk_export',
  'permission_change',
  'status_change',
]);

export type LiveAuditRow = {
  id: string;
  action_type?: string;
  created_at?: string;
  user_email?: string | null;
  metadata?: Record<string, unknown>;
  status?: string;
};

type Props = {
  onEvent: (row: LiveAuditRow) => void;
  enabled?: boolean;
};

/**
 * Supabase Realtime sur audit_logs (nécessite publication + RLS admin SELECT).
 * Si la config manque, aucun événement — la page garde le polling existant.
 */
export function SecurityAuditRealtime({ onEvent, enabled = true }: Props) {
  React.useEffect(() => {
    if (!enabled) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;

    const ch = supabase
      .channel('security-audit-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const action = String(row.action_type || '');
          if (!WATCH.has(action)) return;
          onEvent({
            id: String(row.id || crypto.randomUUID()),
            action_type: action,
            created_at: row.created_at as string | undefined,
            user_email: row.user_email as string | null | undefined,
            metadata: row.metadata as Record<string, unknown> | undefined,
            status: row.status as string | undefined,
          });
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // eslint-disable-next-line no-console
          console.warn('[SecurityAuditRealtime] channel error — vérifiez publication supabase_realtime + RLS');
        }
      });

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [enabled, onEvent]);

  return null;
}
