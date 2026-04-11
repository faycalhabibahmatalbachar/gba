'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChartDays = 7 | 30 | 90;

type Props = {
  chartDays: ChartDays;
  onChartDaysChange: (d: ChartDays) => void;
  onRefresh: () => void;
  isFetching: boolean;
  lastUpdated: Date | null;
  onExportPdf: () => void;
};

function greetingLine(firstName: string) {
  const h = new Date().getHours();
  if (h < 12) return `Bonjour, ${firstName}. Voici l'état de votre activité.`;
  if (h < 18) return `Bonne après-midi, ${firstName}. Voici les dernières données.`;
  return `Bonsoir, ${firstName}. Résumé de la journée.`;
}

export function DashboardHeader({
  chartDays,
  onChartDaysChange,
  onRefresh,
  isFetching,
  lastUpdated,
  onExportPdf,
}: Props) {
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      const meta = u?.user_metadata as { first_name?: string; full_name?: string } | undefined;
      const fromMeta = meta?.first_name || (meta?.full_name ? String(meta.full_name).split(/\s+/)[0] : '');
      const fromEmail = u?.email?.split('@')[0] || '';
      setFirstName(fromMeta || fromEmail || 'Admin');
    });
  }, []);

  const ageSec =
    lastUpdated != null ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000)) : null;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-heading text-[22px] font-bold leading-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">{greetingLine(firstName)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          {([7, 30, 90] as const).map((d) => (
            <Button
              key={d}
              type="button"
              variant={chartDays === d ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => onChartDaysChange(d)}
            >
              {d}j
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => onRefresh()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          <span className="hidden text-xs sm:inline">
            {ageSec != null ? `MAJ il y a ${ageSec}s` : 'Actualiser'}
          </span>
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onExportPdf} type="button">
          <Download className="h-4 w-4" />
          <span className="hidden text-xs sm:inline">Exporter</span>
        </Button>
      </div>
    </header>
  );
}
