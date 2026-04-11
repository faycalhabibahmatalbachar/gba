'use client';

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

/** Invalide liste + KPI quand la table `orders` change (Realtime activé côté Supabase). */
export function useOrdersRealtimeInvalidation(qc: QueryClient) {
  useEffect(() => {
    const channel = supabase
      .channel('orders-admin-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          void qc.invalidateQueries({ queryKey: ['orders'] });
          void qc.invalidateQueries({ queryKey: ['orders-kpis'] });
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[orders realtime] subscription error — vérifiez la réplication Supabase pour public.orders');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
