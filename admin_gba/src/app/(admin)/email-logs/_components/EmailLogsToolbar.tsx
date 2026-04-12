'use client';

import * as React from 'react';
import { Filter, Send } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Props = {
  q: string;
  setQ: (v: string) => void;
  toEmail: string;
  setToEmail: (v: string) => void;
  provider: string;
  setProvider: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  onCompose: () => void;
  /** Remet la pagination au début quand un filtre change */
  resetPagination: () => void;
};

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function makeFilterWrap(resetPagination: () => void) {
  return (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value);
    resetPagination();
  };
}

export function EmailLogsToolbar({
  q,
  setQ,
  toEmail,
  setToEmail,
  provider,
  setProvider,
  status,
  setStatus,
  onCompose,
  resetPagination,
}: Props) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const wrap = makeFilterWrap(resetPagination);

  const FilterForm = ({ idPrefix }: { idPrefix: string }) => (
    <div className="grid gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-q`} className="text-xs">
          Sujet / erreur
        </Label>
        <Input id={`${idPrefix}-q`} value={q} onChange={wrap(setQ)} placeholder="Recherche…" autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-to`} className="text-xs">
          Destinataire
        </Label>
        <Input id={`${idPrefix}-to`} value={toEmail} onChange={wrap(setToEmail)} placeholder="email@…" autoComplete="off" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-p`} className="text-xs">
            Fournisseur
          </Label>
          <select id={`${idPrefix}-p`} className={selectClass} value={provider} onChange={wrap(setProvider)}>
            <option value="all">Tous</option>
            <option value="resend">Resend</option>
            <option value="smtp">SMTP</option>
            <option value="mock">Simulé</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-s`} className="text-xs">
            Statut
          </Label>
          <select id={`${idPrefix}-s`} className={selectClass} value={status} onChange={wrap(setStatus)}>
            <option value="all">Tous</option>
            <option value="sent">Envoyé</option>
            <option value="failed">Échec</option>
            <option value="pending">En attente</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border/80 bg-card/50 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
        <div className="flex flex-1 flex-col gap-2 min-w-0 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5 min-w-0">
            <Label htmlFor="elog-search-main" className="text-xs text-muted-foreground">
              Recherche
            </Label>
            <Input
              id="elog-search-main"
              value={q}
              onChange={wrap(setQ)}
              placeholder="Sujet ou message d’erreur…"
              className="h-9"
              autoComplete="off"
            />
          </div>
          <div className="hidden sm:block sm:flex-1 space-y-1.5 min-w-0 lg:hidden">
            <Label htmlFor="elog-to-sm" className="text-xs text-muted-foreground">
              Destinataire
            </Label>
            <Input
              id="elog-to-sm"
              value={toEmail}
              onChange={wrap(setToEmail)}
              placeholder="Filtrer…"
              className="h-9"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-3 gap-2 flex-[2] min-w-0">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Destinataire</Label>
            <Input value={toEmail} onChange={wrap(setToEmail)} placeholder="Email" className="h-9" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fournisseur</Label>
            <select className={cn(selectClass, 'h-9')} value={provider} onChange={wrap(setProvider)}>
              <option value="all">Tous</option>
              <option value="resend">Resend</option>
              <option value="smtp">SMTP</option>
              <option value="mock">Simulé</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Statut</Label>
            <select className={cn(selectClass, 'h-9')} value={status} onChange={wrap(setStatus)}>
              <option value="all">Tous</option>
              <option value="sent">Envoyé</option>
              <option value="failed">Échec</option>
              <option value="pending">En attente</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              type="button"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 lg:hidden')}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtres
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Tous les filtres</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterForm idPrefix="sheet" />
              </div>
            </SheetContent>
          </Sheet>
          <Button type="button" size="sm" className="gap-1.5" onClick={onCompose}>
            <Send className="h-3.5 w-3.5" />
            Composer
          </Button>
        </div>
      </div>
    </div>
  );
}
