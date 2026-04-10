/**
 * Journal d’audit : défilement infini (curseur API), virtualisation, filtres, export serveur, détail avec diff JSON.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Search,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Info,
  XCircle,
  Loader2,
} from 'lucide-react';
import { AdminDrawer } from '@/components/ui/custom/AdminDrawer';
import { JsonDiffViewer } from '@/components/ui/custom/JsonDiffViewer';
import {
  downloadAuditExport,
  fetchAuditCursorPage,
  type AuditStreamFilters,
  type AuditLogEntry,
  type AuditActionType,
  type AuditEntityType,
} from '@/lib/audit/audit-logger';

const ACTION_TYPES: AuditActionType[] = [
  'create',
  'update',
  'delete',
  'view',
  'export',
  'bulk_create',
  'bulk_update',
  'bulk_delete',
  'bulk_export',
  'login',
  'logout',
  'permission_change',
  'status_change',
  'assign',
  'unassign',
  'approve',
  'reject',
  'send_notification',
  'refund',
  'cancel',
];

const ENTITY_TYPES: AuditEntityType[] = [
  'product',
  'order',
  'user',
  'profile',
  'category',
  'banner',
  'delivery',
  'driver',
  'message',
  'conversation',
  'review',
  'payment',
  'notification',
  'report',
  'setting',
  'role',
  'permission',
];

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

const ROW_H = 54;

function filtersKey(f: AuditStreamFilters): string {
  return JSON.stringify({
    entityType: f.entityType,
    entityId: f.entityId,
    actionType: f.actionType,
    actorId: f.actorId,
    status: f.status,
    ip: f.ip,
    from: f.startDate?.toISOString(),
    to: f.endDate?.toISOString(),
  });
}

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

interface AuditLogViewerProps {
  showFilters?: boolean;
}

export function AuditLogViewer({ showFilters = true }: AuditLogViewerProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [actorId, setActorId] = React.useState('');
  const [ipFilter, setIpFilter] = React.useState('');
  const [entityType, setEntityType] = React.useState<string>('');
  const [actionType, setActionType] = React.useState<string>('');
  const [status, setStatus] = React.useState<string>('');
  const [selected, setSelected] = React.useState<AuditLogEntry | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const streamFilters = React.useMemo<AuditStreamFilters>(
    () => ({
      entityType: entityType || undefined,
      actionType: actionType || undefined,
      status: status || undefined,
      actorId: actorId.trim() || undefined,
      ip: ipFilter.trim() || undefined,
      startDate,
      endDate,
    }),
    [entityType, actionType, status, actorId, ipFilter, startDate, endDate],
  );

  const inf = useInfiniteQuery({
    queryKey: ['audit-cursor', filtersKey(streamFilters)],
    queryFn: ({ pageParam }) => fetchAuditCursorPage(streamFilters, pageParam as string | null),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: null as string | null,
  });

  const flat = inf.data?.pages.flatMap((p) => p.rows) ?? [];
  const totalApprox = inf.data?.pages[0]?.meta.total ?? flat.length;

  const filteredLogs = React.useMemo(() => {
    if (!searchTerm.trim()) return flat;
    const term = searchTerm.toLowerCase();
    return flat.filter(
      (log) =>
        log.user_email?.toLowerCase().includes(term) ||
        log.entity_name?.toLowerCase().includes(term) ||
        log.action_description?.toLowerCase().includes(term) ||
        log.entity_id?.toLowerCase().includes(term),
    );
  }, [flat, searchTerm]);

  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 14,
  });

  React.useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      if (inf.isFetchingNextPage || !inf.hasNextPage) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 480) void inf.fetchNextPage();
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [inf.hasNextPage, inf.isFetchingNextPage, inf.fetchNextPage]);

  const getStatusIcon = (s?: string) => {
    switch (s) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-blue-600 shrink-0" />;
    }
  };

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted/60',
      )}
    >
      {label}
    </button>
  );

  const toggleAction = (v: string) => setActionType((prev) => (prev === v ? '' : v));
  const toggleStatus = (v: string) => setStatus((prev) => (prev === v ? '' : v));

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
      selected?.created_at && (selected?.user_id || (selected?.entity_id && selected?.entity_type)),
    ),
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('created_at', selected!.created_at!);
      if (selected!.user_id) p.set('user_id', selected!.user_id);
      if (selected!.entity_id && selected!.entity_type) {
        p.set('entity_type', selected!.entity_type);
        p.set('entity_id', selected!.entity_id);
      }
      const r = await fetch(`/api/audit/nearby?${p}`, { credentials: 'include' });
      const j = (await r.json()) as { data?: AuditLogEntry[] };
      if (!r.ok) return [];
      return j.data ?? [];
    },
  });

  const runExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      await downloadAuditExport(streamFilters, format);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Journal d&apos;audit</CardTitle>
              <CardDescription>
                Liste virtualisée, chargement par curseur — {totalApprox.toLocaleString()} entrées (total estimé)
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={exporting}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'data-popup-open:bg-muted',
                )}
              >
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Exporter
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void runExport('csv')}>CSV (serveur)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void runExport('json')}>JSON (serveur)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showFilters ? (
            <>
              <div className="flex flex-wrap gap-2">
                {chip('Connexions', actionType === 'login', () => toggleAction('login'))}
                {chip('Modifications', actionType === 'update', () => toggleAction('update'))}
                {chip('Exports', actionType === 'export', () => toggleAction('export'))}
                {chip('Échecs', status === 'failed', () => toggleStatus('failed'))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher dans la page chargée…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Input placeholder="UUID acteur (user_id)" value={actorId} onChange={(e) => setActorId(e.target.value)} />
                <Input placeholder="Filtre IP (metadata)" value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} />

                <Select
                  value={actionType || 'all'}
                  onValueChange={(v) => setActionType(!v || v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    {ACTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ACTION_LABELS[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={entityType || 'all'}
                  onValueChange={(v) => setEntityType(!v || v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Entité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les entités</SelectItem>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ENTITY_LABELS[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={status || 'all'} onValueChange={(v) => setStatus(!v || v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="success">Succès</SelectItem>
                    <SelectItem value="failed">Échec</SelectItem>
                    <SelectItem value="partial">Partiel</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'justify-start text-left font-normal w-full',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate && endDate
                      ? `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}`
                      : 'Période'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="start">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Début</p>
                        <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={fr} />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Fin</p>
                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={fr} />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => void inf.refetch()}
                        disabled={!startDate || !endDate}
                      >
                        Appliquer et recharger
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          ) : null}

          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[40px_128px_minmax(140px,1fr)_100px_88px_72px_40px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40">
              <span />
              <span>Date</span>
              <span>Utilisateur</span>
              <span>Action</span>
              <span>Entité</span>
              <span>ID</span>
              <span />
            </div>
            <div ref={parentRef} className="h-[560px] overflow-auto relative">
              {inf.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">Aucun log</div>
              ) : (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((vi) => {
                    const log = filteredLogs[vi.index]!;
                    return (
                      <button
                        key={vi.key}
                        type="button"
                        className={cn(
                          'absolute left-0 w-full grid grid-cols-[40px_128px_minmax(140px,1fr)_100px_88px_72px_40px] gap-2 px-3 py-2 text-left text-sm border-b border-border/60 hover:bg-muted/50 items-center',
                        )}
                        style={{
                          height: `${vi.size}px`,
                          transform: `translateY(${vi.start}px)`,
                        }}
                        onClick={() => setSelected(log)}
                      >
                        <span className="flex justify-center">{getStatusIcon(log.status)}</span>
                        <span className="text-xs whitespace-nowrap tabular-nums">
                          {log.created_at
                            ? format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr })
                            : '—'}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{log.user_email || 'Système'}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">{log.user_role}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px] justify-center px-1">
                          {ACTION_LABELS[log.action_type] || log.action_type}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] justify-center px-1">
                          {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        </Badge>
                        <span className="font-mono text-[10px] truncate">
                          {log.entity_id ? `${log.entity_id.slice(0, 6)}…` : '—'}
                        </span>
                        <span className="text-muted-foreground text-lg leading-none">›</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Affichés : {filteredLogs.length} ligne(s) chargée(s)
              {inf.isFetchingNextPage ? ' — chargement…' : ''}
            </span>
            {inf.hasNextPage ? (
              <Button variant="ghost" size="sm" onClick={() => void inf.fetchNextPage()} disabled={inf.isFetchingNextPage}>
                Charger plus
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AdminDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? 'Détail audit' : 'Détail'}
        description={selected?.created_at ? format(new Date(selected.created_at), 'PPpp', { locale: fr }) : undefined}
        className="sm:max-w-[580px]"
      >
        {selected ? (
          <div className="space-y-5 text-sm">
            <div className="relative rounded-xl border border-border bg-gradient-to-br from-muted/40 to-transparent p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  {getStatusIcon(selected.status)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-xs">{ACTION_LABELS[selected.action_type] || selected.action_type}</Badge>
                    <Badge variant="secondary" className="text-xs">
                      {ENTITY_LABELS[selected.entity_type] || selected.entity_type}
                    </Badge>
                    {selected.status ? (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{selected.status}</span>
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
                  <p className="font-medium">{selected.user_email || 'Système'}</p>
                  <p className="text-xs text-muted-foreground">{selected.user_role || '—'}</p>
                </div>
              </div>
              <div className="relative flex gap-3 pb-4">
                <span className="z-[1] mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Horodatage</p>
                  <p className="tabular-nums">
                    {selected.created_at ? format(new Date(selected.created_at), 'EEEE d MMMM yyyy · HH:mm:ss', { locale: fr }) : '—'}
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
              <details className="group rounded-lg border border-border bg-card open:shadow-sm">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium flex items-center justify-between">
                  Contexte proche (±5 min)
                  <span className="text-xs text-muted-foreground group-open:rotate-0">▼</span>
                </summary>
                <ul className="space-y-1 max-h-44 overflow-y-auto border-t px-3 py-2 text-xs bg-muted/15">
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
                      {row.entity_id ? <span className="font-mono text-[10px] opacity-80">{row.entity_id.slice(0, 8)}…</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {meta && Object.keys(meta).length > 0 ? (
              <details className="group rounded-lg border border-border bg-card">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium border-b bg-muted/20">
                  Métadonnées (JSON)
                </summary>
                <pre className="text-xs p-3 overflow-auto max-h-48 bg-muted/30">{JSON.stringify(meta, null, 2)}</pre>
              </details>
            ) : null}

            <details className="group rounded-lg border border-border bg-card" open>
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium border-b bg-muted/20">
                Modifications avant / après
              </summary>
              <div className="p-2 max-h-[min(50vh,360px)] overflow-auto">
                <JsonDiffViewer before={beforeDiff} after={afterDiff} />
              </div>
            </details>

            {selected.error_message ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-xs">{selected.error_message}</p>
            ) : null}
          </div>
        ) : null}
      </AdminDrawer>
    </>
  );
}
