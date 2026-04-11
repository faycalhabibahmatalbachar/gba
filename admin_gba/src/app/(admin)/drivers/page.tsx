'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState, parseAsString } from 'nuqs';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Activity, MapPinned, MoreHorizontal, Phone, RefreshCw, Search, Truck, UserX } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { PageHeader } from '@/components/shared/PageHeader';
import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { Drawer } from '@/components/shared/Drawer';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DriverUpsertDialog } from './_components/DriverUpsertDialog';
import { DriverDetailPanel } from './_components/DriverDetailPanel';

type DriverRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  phone: string | null;
  is_active: boolean | null;
  is_online: boolean | null;
  is_available: boolean | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  vehicle_color?: string | null;
  rating_avg: number | null;
  total_deliveries: number | null;
  total_earnings: number | null;
  last_location_at: string | null;
  profile: {
    display_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    city: string | null;
    country: string | null;
  };
  stats: {
    orders_today: number;
    completion_pct_30d: number;
    revenue_month_approx: number;
  };
  last_gps: { lat: number; lng: number; at: string } | null;
};

type DriversResponse = { drivers: DriverRow[]; nextCursor: string | null; total: number };
function driverStatusLabel(row: DriverRow): string {
  if (row.is_active === false) return 'suspended';
  if (row.is_online) return 'active';
  if (row.is_available) return 'pending';
  return 'offline';
}

async function fetchDrivers(cursor: string | null, q: string): Promise<DriversResponse> {
  const u = new URL('/api/drivers', typeof window !== 'undefined' ? window.location.origin : 'http://local');
  if (cursor) u.searchParams.set('cursor', cursor);
  if (q.trim()) u.searchParams.set('q', q.trim());
  const r = await fetch(u.toString(), { credentials: 'include' });
  const j = (await r.json()) as DriversResponse & { error?: string };
  if (!r.ok) throw new Error(j.error || 'Erreur chargement livreurs');
  return { drivers: j.drivers || [], nextCursor: j.nextCursor ?? null, total: j.total ?? 0 };
}

function DriversPageInner() {
  const qc = useQueryClient();
  const [driverDeeplink, setDriverDeeplink] = useQueryState('driver', parseAsString.withDefault(''));
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [stack, setStack] = React.useState<DriverRow[]>([]);
  const [selected, setSelected] = React.useState<DriverRow | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [assignOrderId, setAssignOrderId] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    const id = driverDeeplink?.trim();
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/drivers/${id}`, { credentials: 'include' });
        const j = (await r.json()) as {
          driver?: Record<string, unknown>;
          profile?: Record<string, unknown> | null;
          error?: string;
        };
        if (!r.ok || cancelled) {
          if (!cancelled && j.error) toast.error(typeof j.error === 'string' ? j.error : 'Livreur introuvable');
          return;
        }
        const d = j.driver;
        const p = j.profile;
        if (!d || cancelled) return;
        const uid = (d.user_id as string | null) ?? null;
        const first = (p?.first_name as string | null) ?? '';
        const last = (p?.last_name as string | null) ?? '';
        const fromProfile = `${first} ${last}`.trim();
        const displayName =
          fromProfile || (d.name as string | null)?.trim() || 'Livreur';
        const row: DriverRow = {
          id: d.id as string,
          user_id: uid,
          name: (d.name as string | null) ?? null,
          phone: (d.phone as string | null) ?? (p?.phone as string | null) ?? null,
          is_active: (d.is_active as boolean | null) ?? null,
          is_online: (d.is_online as boolean | null) ?? null,
          is_available: (d.is_available as boolean | null) ?? null,
          vehicle_type: (d.vehicle_type as string | null) ?? null,
          vehicle_plate: (d.vehicle_plate as string | null) ?? null,
          vehicle_color: (d.vehicle_color as string | null) ?? null,
          rating_avg: (d.rating_avg as number | null) ?? null,
          total_deliveries: (d.total_deliveries as number | null) ?? null,
          total_earnings: (d.total_earnings as number | null) ?? null,
          last_location_at: (d.last_location_at as string | null) ?? null,
          profile: {
            display_name: displayName,
            email: (p?.email as string | null) ?? null,
            phone: (p?.phone as string | null) ?? null,
            avatar_url: (p?.avatar_url as string | null) ?? null,
            city: (p?.city as string | null) ?? null,
            country: (p?.country as string | null) ?? null,
          },
          stats: { orders_today: 0, completion_pct_30d: 0, revenue_month_approx: 0 },
          last_gps: null,
        };
        setSelected(row);
        setDrawerOpen(true);
      } catch {
        if (!cancelled) toast.error('Impossible de charger le livreur');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverDeeplink]);

  const query = useQuery({
    queryKey: ['drivers', cursor, debounced],
    queryFn: () => fetchDrivers(cursor, debounced),
  });

  React.useEffect(() => {
    setCursor(null);
    setStack([]);
  }, [debounced]);

  React.useEffect(() => {
    if (!query.data) return;
    setStack((prev) => (cursor ? [...prev, ...query.data.drivers] : query.data.drivers));
  }, [query.data, cursor]);

  const drivers = stack;
  const loading = query.isLoading && !stack.length;

  const online = drivers.filter((d) => d.is_online).length;
  const busy = drivers.filter((d) => d.last_gps && d.stats.orders_today > 0).length;
  const available = drivers.filter((d) => d.is_available && d.is_active !== false).length;
  const suspended = drivers.filter((d) => d.is_active === false).length;

  const patchMut = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/drivers/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload.body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec');
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['driver-detail'] });
      toast.success('Livreur mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMut = useMutation({
    mutationFn: async ({ id, orderId }: { id: string; orderId: string }) => {
      const r = await fetch(`/api/drivers/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_id: orderId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Assignation impossible');
      return j;
    },
    onSuccess: () => {
      toast.success('Commande assignée');
      setAssignOrderId('');
      qc.invalidateQueries({ queryKey: ['driver-detail'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = React.useMemo<ColumnDef<DriverRow>[]>(
    () => [
      {
        id: 'driver',
        header: 'Livreur',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-[180px]">
            <AvatarWithInitials
              src={row.original.profile.avatar_url}
              name={row.original.profile.display_name}
              size={36}
            />
            <div className="min-w-0">
              <div className="font-medium truncate">{row.original.profile.display_name}</div>
              <div className="text-xs text-muted-foreground truncate">{row.original.profile.email || '—'}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'phone',
        header: 'Téléphone',
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">{row.original.profile.phone || row.original.phone || '—'}</span>
        ),
      },
      {
        id: 'zones',
        header: 'Zone(s)',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {[row.original.profile.city, row.original.profile.country].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Statut',
        cell: ({ row }) => <StatusBadge status={driverStatusLabel(row.original)} />,
      },
      {
        id: 'today',
        header: 'Cmd. jour',
        cell: ({ row }) => <span className="tabular-nums">{row.original.stats.orders_today}</span>,
      },
      {
        id: 'completion',
        header: 'Complétion 30j',
        cell: ({ row }) => <span className="tabular-nums">{row.original.stats.completion_pct_30d}%</span>,
      },
      {
        id: 'rating',
        header: 'Note',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.rating_avg != null ? row.original.rating_avg.toFixed(1) : '—'}</span>
        ),
      },
      {
        id: 'earnings',
        header: 'Gains mois ~',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {new Intl.NumberFormat('fr-FR').format(row.original.stats.revenue_month_approx)} FCFA
          </span>
        ),
      },
      {
        id: 'vehicle',
        header: 'Véhicule',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {[row.original.vehicle_type, row.original.vehicle_plate].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
      },
      {
        id: 'lastpos',
        header: 'Dernière pos.',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.last_gps
              ? new Date(row.original.last_gps.at).toLocaleString('fr-FR')
              : row.original.last_location_at
                ? new Date(row.original.last_location_at).toLocaleString('fr-FR')
                : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelected(row.original);
                  setDrawerOpen(true);
                }}
              >
                Fiche
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (row.original.is_active === false) {
                    patchMut.mutate({ id: row.original.id, body: { is_active: true } });
                  } else {
                    setSelected(row.original);
                    setSuspendOpen(true);
                  }
                }}
              >
                {row.original.is_active === false ? 'Réactiver' : 'Suspendre'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [patchMut],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livreurs"
        subtitle="Flotte, performance et géolocalisation"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="default" size="sm" type="button" onClick={() => setCreateOpen(true)}>
              + Nouveau livreur
            </Button>
            <Link
              href="/drivers/live"
              className="inline-flex items-center gap-1 h-8 px-3 text-sm rounded-md border border-input bg-background hover:bg-muted"
            >
              <MapPinned className="h-3.5 w-3.5" />
              Carte live
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCursor(null);
                setStack([]);
                void qc.invalidateQueries({ queryKey: ['drivers'] });
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="En ligne" value={online} icon={<Activity className="h-5 w-5" />} loading={loading} />
        <KPICard label="En livraison (approx.)" value={busy} icon={<Truck className="h-5 w-5" />} loading={loading} />
        <KPICard label="Disponibles" value={available} icon={<MapPinned className="h-5 w-5" />} loading={loading} />
        <KPICard label="Suspendus" value={suspended} icon={<UserX className="h-5 w-5" />} loading={loading} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher nom, email, téléphone, plaque…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {query.isError ? (
        <Card className="p-8 text-center border-destructive/40">
          <p className="text-sm text-destructive mb-3">{(query.error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Réessayer
          </Button>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable
            columns={columns}
            data={drivers}
            isLoading={loading}
            emptyTitle="Aucun livreur"
            emptyDescription="Ajoutez un livreur pour l’application mobile livreur."
            emptyAction={
              <div className="flex flex-wrap gap-2 justify-center">
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  Créer un livreur
                </Button>
                <Link
                  href="/users"
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-muted"
                >
                  Utilisateurs
                </Link>
              </div>
            }
            cursorFooter={
              query.data?.nextCursor ? (
                <div className="flex justify-center py-2">
                  <Button variant="ghost" size="sm" onClick={() => setCursor(query.data!.nextCursor)}>
                    Charger la suite
                  </Button>
                </div>
              ) : null
            }
          />
        </motion.div>
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) void setDriverDeeplink(null);
        }}
        title={selected?.profile.display_name || 'Livreur'}
        description={selected?.profile.email || undefined}
        footer={
          selected ? (
            <div className="flex flex-wrap gap-2 justify-end w-full">
              <Button variant="outline" size="sm" type="button" onClick={() => setEditOpen(true)}>
                Modifier fiche
              </Button>
              <a
                href={`tel:${selected.profile.phone || selected.phone || ''}`}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Phone className="h-3.5 w-3.5" />
                Appeler
              </a>
            </div>
          ) : null
        }
      >
        {selected ? (
          <DriverDetailPanel
            driverId={selected.id}
            listRowName={selected.profile.display_name}
            onAssign={(orderId) => assignMut.mutate({ id: selected.id, orderId })}
            assignPending={assignMut.isPending}
            assignOrderId={assignOrderId}
            onAssignOrderIdChange={setAssignOrderId}
            onSuspendRequest={() => {
              qc.invalidateQueries({ queryKey: ['drivers'] });
            }}
            onEditRequest={() => setEditOpen(true)}
          />
        ) : null}
      </Drawer>

      <DriverUpsertDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
      <DriverUpsertDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={
          selected
            ? {
                id: selected.id,
                user_id: selected.user_id,
                name: selected.name,
                phone: selected.phone,
                vehicle_type: selected.vehicle_type,
                vehicle_plate: selected.vehicle_plate,
                vehicle_color: selected.vehicle_color ?? null,
              }
            : null
        }
      />

      <ConfirmModal
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspendre le livreur"
        description="Confirmation par nom exact (audit). Motif : suspension administrative."
        confirmationPhrase={selected?.profile.display_name || ''}
        confirmationLabel="Saisir le nom du livreur"
        confirmLabel="Suspendre"
        variant="destructive"
        onConfirm={async () => {
          if (!selected) return;
          await patchMut.mutateAsync({
            id: selected.id,
            body: { is_active: false, suspension_reason: 'Suspension administrative' },
          });
          setSuspendOpen(false);
        }}
      />
    </div>
  );
}

export default function DriversAdminPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <DriversPageInner />
    </Suspense>
  );
}
