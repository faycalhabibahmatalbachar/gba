'use client';

import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function GateMessage() {
  const sp = useSearchParams();
  const code = sp.get('error');
  const reason = sp.get('reason');
  if (!code && !reason) return null;
  return (
    <div className="mb-6 space-y-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-3 text-xs text-destructive">
      <p className="font-medium">{reason || `Accès refusé (${code})`}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-destructive/40 transition-colors duration-150"
        onClick={() => void supabase.auth.signOut().then(() => window.location.replace('/login'))}
      >
        Déconnecter cette session
      </Button>
    </div>
  );
}
