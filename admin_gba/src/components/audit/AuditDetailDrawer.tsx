'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, Info, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminDrawer } from '@/components/ui/custom/AdminDrawer';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AuditFieldDiffTable } from '@/components/audit/AuditFieldDiffTable';
import type { AuditLogEntry } from '@/lib/audit/audit-logger';

const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  view: 'Consultation',
  export: 'Export',
  bulk_create: 'Création en masse',
  bulk_update: 'Modification en masse',
  bulk_delete: 'Suppression en masse',
  bulk_export: 'Export en masse',
  login: 'Connexion',
  logout: 'Déconnexion',
  permission_change: 'Changement permission',
  status_change: 'Changement statut',
  assign: 'Attribution',
  unassign: 'Retrait attribution',
  approve: 'Approbation',
  reject: 'Rejet',
  send_notification: 'Envoi notification',
  refund: 'Remboursement',
  cancel: 'Annulation',
};

const ENTITY_LABELS: Record<string, string> = {
  product: 'Produit',
  order: 'Commande',
  user: 'Utilisateur',
  profile: 'Profil',
  category: 'Catégorie',
  banner: 'Bannière',
  delivery: 'Livraison',
  driver: 'Livreur',
  message: 'Message',
  conversation: 'Conversation',
  review: 'Avis',
  payment: 'Paiement',
  notification: 'Notification',
  report: 'Rapport',
  setting: 'Paramètre',
  role: 'Rôle',
  permission: 'Permission',
};

function entityAdminHref(entityType: string, entityId?: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case 'product':
      return `/products`;
    case 'order':
      return `/orders`;
    case 'user':
    case 'profile':
      return `/users`;
    case 'driver':
      return `/drivers`;
    case 'review':
      return `/reviews`;
    default:
      return null;
  }
}

function getStatusIcon(s?: string) {
  switch (s) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 dark:text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600 shrink-0 dark:text-red-500" />;
    case 'partial':
      return <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 dark:text-yellow-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-600 shrink-0 dark:text-blue-500" />;
  }
}

export function AuditDetailDrawer({
  open,
  onOpenChange,
  selected,
  listIndex,
  listLength,
  onPrev,
  onNext,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selected: AuditLogEntry | null;
  listIndex: number;
  listLength: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const ch = selected?.changes as { before?: unknown; after?: unknown } | undefined;
  const beforeDiff = ch?.before ?? {};
  const afterDiff = ch?.after ?? {};
  const meta = selected?.metadata as Record<string, unknown> | undefined;

  const nearbyQ = useQuery({
    queryKey: [
      'audit-nearby',
      selected?.id,
      selected?.user_id,
      selected?.entity_type,
      selected?.entity_id,
      selected?.created_at,
    ],
    enabled: Boolean(
      open &&
        selected?.created_at &&
        (selected?.user_id || (selected?.entity_id && selected?.entity_type)),
    ),
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('created_at', selected!.created_at!);
      p.set('minutes', '10');
      if (selected!.user_id) p.set('user_id', selected!.user_id);
      if (selected!.entity_id && selected!.entity_type) {
        p.set('entity_type', selected!.entity_type);
        p.set('entity_id', selected!.entity_id);
      }
      const r = await fetch(`/api/audit/nearby?${p}`, { credentials: 'include' });
      const j = (await r.json()) as { data?: AuditLogEntry[]; error?: string };
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      return j.data ?? [];
    },
  });

  const canPrev = listIndex > 0;
  const canNext = listIndex >= 0 && listIndex < listLength - 1;

  return (
    <AdminDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={selected ? 'Détail audit' : 'Détail'}
      description={
        selected?.created_at ? format(new Date(selected.created_at), 'PPpp', { locale: fr }) : undefined
      }
      className="sm:max-w-[580px]"
      footer={
        selected ? (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button type="button" variant="outline" size="sm" disabled={!canPrev} onClick={onPrev}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {listIndex + 1} / {listLength}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={!canNext} onClick={onNext}>
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        ) : null
      }
    >
      {selected ? (
        <div className="space-y-5 text-sm">
          <div className="relative rounded-xl border border-border bg-gradient-to-br from-muted/40 to-transparent p-4 dark:from-muted/20">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                {getStatusIcon(selected.status)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="text-xs">
                    {ACTION_LABELS[selected.action_type] || selected.action_type}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {ENTITY_LABELS[selected.entity_type] || selected.entity_type}
                  </Badge>
                  {selected.status ? (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {selected.status}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Référence entité</p>
                <p className="font-mono text-[11px] break-all">{selected.entity_id || '—'}</p>
                {entityAdminHref(selected.entity_type, selected.entity_id) ? (
                  <Link
                    href={entityAdminHref(selected.entity_type, selected.entity_id)!}
                    className={cn(buttonVariants({ variant: 'link' }), 'h-auto p-0 mt-2 inline-flex text-sm')}
                  >
                    Ouvrir dans l&apos;admin
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative space-y-0 pl-1">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" aria-hidden />
            <div className="relative flex gap-3 pb-4">
              <span className="z-[1] mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-4 ring-background" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Acteur</p>
                <p className="font-medium">
                  {selected.actor_display_name?.trim() || selected.user_email || 'Système'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.actor_profile_role || selected.user_role || '—'}
                </p>
              </div>
            </div>
            <div className="relative flex gap-3 pb-4">
              <span className="z-[1] mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Horodatage</p>
                <p className="tabular-nums">
                  {selected.created_at
                    ? format(new Date(selected.created_at), 'EEEE d MMMM yyyy · HH:mm:ss', { locale: fr })
                    : '—'}
                </p>
              </div>
            </div>
            {selected.action_description ? (
              <div className="relative flex gap-3">
                <span className="z-[1] mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                  <p className="text-sm leading-relaxed">{selected.action_description}</p>
                </div>
              </div>
            ) : null}
          </div>

          {nearbyQ.isFetching ? (
            <Skeleton className="h-16 w-full" />
          ) : (nearbyQ.data?.length ?? 0) > 0 ? (
            <details className="group rounded-lg border border-border bg-card open:shadow-sm dark:bg-card/80">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium flex items-center justify-between">
                Contexte proche (±10 min)
                <span className="text-xs text-muted-foreground group-open:rotate-0">▼</span>
              </summary>
              <ul className="space-y-1 max-h-44 overflow-y-auto border-t px-3 py-2 text-xs bg-muted/15 dark:bg-muted/10">
                {(nearbyQ.data || []).map((row) => (
                  <li
                    key={String(row.id)}
                    className={cn(
                      'flex flex-wrap gap-x-2 gap-y-0.5 border-b border-border/40 pb-1.5 last:border-0',
                      row.id === selected.id && 'font-medium text-primary',
                    )}
                  >
                    <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {row.created_at ? format(new Date(row.created_at), 'HH:mm:ss', { locale: fr }) : '—'}
                    </span>
                    <span>{ACTION_LABELS[row.action_type] || row.action_type}</span>
                    {row.entity_id ? (
                      <span className="font-mono text-[10px] opacity-80">{row.entity_id.slice(0, 8)}…</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {meta && Object.keys(meta).length > 0 ? (
            <details className="group rounded-lg border border-border bg-card dark:bg-card/80">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium border-b bg-muted/20 dark:bg-muted/10">
                Données techniques (JSON)
              </summary>
              <pre className="text-xs p-3 overflow-auto max-h-48 bg-muted/30 dark:bg-muted/20 font-mono rounded-b-md">
                {JSON.stringify(meta, null, 2)}
              </pre>
            </details>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-3 dark:bg-card/80">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Changements effectués
            </p>
            <div className="max-h-[min(50vh,420px)] overflow-auto">
              <AuditFieldDiffTable before={beforeDiff} after={afterDiff} />
            </div>
          </div>

          {selected.error_message ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-xs dark:bg-destructive/10">
              {selected.error_message}
            </p>
          ) : null}
        </div>
      ) : null}
    </AdminDrawer>
  );
}
