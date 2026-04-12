/**
 * Journal d’audit : défilement infini (curseur API), virtualisation, filtres, export serveur, détail avec diff tableau.
 */

'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
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
import { Download, Search, Calendar as CalendarIcon, Loader2, Radio } from 'lucide-react';
import { AuditDetailDrawer } from '@/components/audit/AuditDetailDrawer';
import { AuditLogRow, auditRowHeight } from '@/components/audit/AuditLogRow';
import { supabase } from '@/lib/supabase/client';
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

function filtersKey(f: AuditStreamFilters): string {
  return JSON.stringify({
    entityType: f.entityType,
    entityId: f.entityId,
    actionType: f.actionType,
    connections: f.connections,
    actorId: f.actorId,
    status: f.status,
    ip: f.ip,
    search: f.search,
    from: f.startDate?.toISOString(),
    to: f.endDate?.toISOString(),
  });
}

interface AuditLogViewerProps {
  showFilters?: boolean;
  initialEntityType?: string;
  initialEntityId?: string;
}

export function AuditLogViewer({
  showFilters = true,
  initialEntityType,
  initialEntityId,
}: AuditLogViewerProps) {
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [actorId, setActorId] = React.useState('');
  const [ipFilter, setIpFilter] = React.useState('');
  const [entityType, setEntityType] = React.useState<string>(initialEntityType || '');
  const [entityIdFilter, setEntityIdFilter] = React.useState<string>(initialEntityId || '');
  const [actionType, setActionType] = React.useState<string>('');
  const [connectionsOnly, setConnectionsOnly] = React.useState(false);
  const [status, setStatus] = React.useState<string>('');
  const [selected, setSelected] = React.useState<AuditLogEntry | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [pendingNewCount, setPendingNewCount] = React.useState(0);
  const [rtStatus, setRtStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialEntityType != null) setEntityType(initialEntityType);
    if (initialEntityId != null) setEntityIdFilter(initialEntityId);
  }, [initialEntityType, initialEntityId]);

  const streamFilters = React.useMemo<AuditStreamFilters>(
    () => ({
      entityType: entityType || undefined,
      entityId: entityIdFilter.trim() || undefined,
      connections: connectionsOnly || undefined,
      actionType: connectionsOnly ? undefined : actionType || undefined,
      status: status || undefined,
      actorId: actorId.trim() || undefined,
      ip: ipFilter.trim() || undefined,
      search: debouncedSearch || undefined,
      startDate,
      endDate,
    }),
    [
      entityType,
      entityIdFilter,
      connectionsOnly,
      actionType,
      status,
      actorId,
      ipFilter,
      debouncedSearch,
      startDate,
      endDate,
    ],
  );

  const inf = useInfiniteQuery({
    queryKey: ['audit-cursor', filtersKey(streamFilters)],
    queryFn: ({ pageParam }) => fetchAuditCursorPage(streamFilters, pageParam as string | null),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: null as string | null,
  });

  const flat = inf.data?.pages.flatMap((p) => p.rows) ?? [];
  const totalApprox = inf.data?.pages[0]?.meta.total ?? flat.length;

  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => auditRowHeight(),
    overscan: 14,
  });

  React.useEffect(() => {
    const channel = supabase
      .channel('audit-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        () => setPendingNewCount((n) => n + 1),
      )
      .subscribe((s) => setRtStatus(s));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

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

  const toggleAction = (v: string) => {
    setConnectionsOnly(false);
    setActionType((prev) => (prev === v ? '' : v));
  };
  const toggleStatus = (v: string) => setStatus((prev) => (prev === v ? '' : v));

  const selectedIndex = selected ? flat.findIndex((r) => r.id === selected.id) : -1;

  const goPrev = () => {
    if (selectedIndex <= 0) return;
    setSelected(flat[selectedIndex - 1]!);
  };
  const goNext = () => {
    if (selectedIndex < 0 || selectedIndex >= flat.length - 1) return;
    setSelected(flat[selectedIndex + 1]!);
  };

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
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5" title="Temps réel audit_logs">
              <Radio
                className={cn(
                  'h-3.5 w-3.5',
                  rtStatus === 'SUBSCRIBED' ? 'text-green-600 dark:text-green-500' : 'text-amber-600',
                )}
              />
              {rtStatus === 'SUBSCRIBED' ? 'Temps réel connecté' : rtStatus ? `Temps réel : ${rtStatus}` : 'Connexion…'}
            </span>
            {pendingNewCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => {
                  setPendingNewCount(0);
                  void inf.refetch();
                }}
              >
                {pendingNewCount} nouvel{pendingNewCount > 1 ? 's' : ''} événement{pendingNewCount > 1 ? 's' : ''} — actualiser
              </Button>
            ) : null}
          </div>

          {showFilters ? (
            <>
              <div className="flex flex-wrap gap-2">
                {chip('Connexions', connectionsOnly, () => {
                  setConnectionsOnly((v) => {
                    const next = !v;
                    if (next) setActionType('');
                    return next;
                  });
                })}
                {chip('Modifications', !connectionsOnly && actionType === 'update', () => toggleAction('update'))}
                {chip('Exports', !connectionsOnly && actionType === 'export', () => toggleAction('export'))}
                {chip('Échecs', status === 'failed', () => toggleStatus('failed'))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par acteur, action, entité, IP, description…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                    maxLength={200}
                  />
                </div>
                <Input placeholder="UUID acteur (user_id)" value={actorId} onChange={(e) => setActorId(e.target.value)} />
                <Input placeholder="Filtre IP (metadata)" value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} />

                <Select
                  value={connectionsOnly ? 'all' : actionType || 'all'}
                  onValueChange={(v) => {
                    setConnectionsOnly(false);
                    setActionType(!v || v === 'all' ? '' : v);
                  }}
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

                <Input
                  placeholder="ID entité (référence exacte)"
                  value={entityIdFilter}
                  onChange={(e) => setEntityIdFilter(e.target.value)}
                  className="font-mono text-xs"
                />

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

          <div className="border rounded-lg overflow-hidden dark:border-border/80">
            <div className="grid grid-cols-[40px_108px_44px_minmax(0,1fr)_96px_80px_28px] gap-x-2 px-3 py-2 text-[11px] font-medium text-muted-foreground border-b bg-muted/40 dark:bg-muted/25">
              <span className="sr-only">Type</span>
              <span>Date</span>
              <span className="col-span-1" />
              <span>Acteur &amp; action</span>
              <span>Action</span>
              <span>Entité</span>
              <span />
            </div>
            <div ref={parentRef} className="h-[560px] overflow-auto relative">
              {inf.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[72px] w-full" />
                  ))}
                </div>
              ) : flat.length === 0 ? (
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
                    const log = flat[vi.index]!;
                    return (
                      <div
                        key={vi.key}
                        className="absolute left-0 top-0 w-full"
                        style={{
                          height: `${vi.size}px`,
                          transform: `translateY(${vi.start}px)`,
                        }}
                      >
                        <AuditLogRow
                          log={log}
                          actionLabel={ACTION_LABELS[log.action_type] || log.action_type}
                          entityLabel={ENTITY_LABELS[log.entity_type] || log.entity_type}
                          onClick={() => setSelected(log)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Affichés : {flat.length} sur ~{totalApprox.toLocaleString('fr-FR')} événement(s)
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

      <AuditDetailDrawer
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        selected={selected}
        listIndex={selectedIndex}
        listLength={flat.length}
        onPrev={goPrev}
        onNext={goNext}
      />
    </>
  );
}
