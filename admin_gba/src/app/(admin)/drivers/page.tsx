'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Activity,
  Map as MapIcon,
  MapPinned,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  Table2,
  Truck,
  UserX,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { PageHeader } from '@/components/shared/PageHeader';
import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { Drawer } from '@/components/shared/Drawer';
import { MapWrapper, type MapWrapperMarker } from '@/components/shared/MapWrapper';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { DriverUpsertDialog } from './_components/DriverUpsertDialog';

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
const hasValidGps = (g: DriverRow['last_gps']) =>
  Boolean(g && Number.isFinite(g.lat) && Number.isFinite(g.lng));

function driverStatusLabel(row: DriverRow): string {
  if (row.is_active === false) return 'suspended';
  if (row.is_online) return 'active';
  if (row.is_available) return 'pending';
  return 'offline';
}

function driverTone(row: DriverRow): MapWrapperMarker['tone'] {
  const s = driverStatusLabel(row);
  if (s === 'active') return 'online';
  if (s === 'pending') return 'pending';
  if (s === 'suspended') return 'suspended';
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

export default function DriversAdminPage() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [stack, setStack] = React.useState<DriverRow[]>([]);
  const [splitMap, setSplitMap] = React.useState(true);
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

  const center = React.useMemo(() => {
    const withGps = drivers.filter((d) => hasValidGps(d.last_gps));
    if (!withGps.length) return { longitude: 15.0444, latitude: 12.1348, zoom: 11 };
    const lat = withGps.reduce((s, d) => s + (d.last_gps?.lat ?? 0), 0) / withGps.length;
    const lng = withGps.reduce((s, d) => s + (d.last_gps?.lng ?? 0), 0) / withGps.length;
    return { longitude: lng, latitude: lat, zoom: 12 };
  }, [drivers]);

  const splitMapMarkers = React.useMemo((): MapWrapperMarker[] => {
    return drivers
      .filter((d) => hasValidGps(d.last_gps))
      .map((d) => ({
        id: d.id,
        lat: d.last_gps?.lat as number,
        lng: d.last_gps?.lng as number,
        tone: driverTone(d),
        onClick: () => {
          setSelected(d);
          setDrawerOpen(true);
        },
      }));
  }, [drivers]);

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
            <Button variant="outline" size="sm" onClick={() => setSplitMap((s) => !s)}>
              {splitMap ? <Table2 className="h-3.5 w-3.5 mr-1" /> : <MapIcon className="h-3.5 w-3.5 mr-1" />}
              {splitMap ? 'Plein tableau' : 'Split carte'}
            </Button>
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
      ) : splitMap ? (
        <div className="grid gap-4 lg:grid-cols-2 min-h-[480px]">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-[360px] rounded-xl border border-border overflow-hidden bg-card"
          >
            {loading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={drivers}
                emptyTitle="Aucun livreur"
                emptyDescription="Créez une fiche dans la table drivers, ou liez un compte utilisateur rôle driver."
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
            )}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <MapWrapper
              height={480}
              initialViewState={center}
              className="min-h-[360px]"
              markers={splitMapMarkers}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {splitMapMarkers.length > 0
                ? `${splitMapMarkers.length} position(s) GPS valide(s) affichée(s).`
                : 'Positions non encore reçues ou coordonnées invalides.'}
            </p>
          </motion.div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable
            columns={columns}
            data={drivers}
            isLoading={loading}
            emptyTitle="Aucun livreur"
            emptyDescription="Aucune donnée pour l’instant."
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
        onOpenChange={setDrawerOpen}
        title={selected?.profile.display_name || 'Livreur'}
        description={selected?.profile.email || undefined}
        footer={
          selected ? (
            <div className="flex flex-wrap gap-2 justify-end w-full">
              <Button variant="outline" size="sm" type="button" onClick={() => setEditOpen(true)}>
                Modifier fiche
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSuspendOpen(true)}>
                Suspendre / motif
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
          <DriverDetailTabs
            driverId={selected.id}
            onAssign={(orderId) => assignMut.mutate({ id: selected.id, orderId })}
            assignPending={assignMut.isPending}
            assignOrderId={assignOrderId}
            onAssignOrderIdChange={setAssignOrderId}
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

function DriverDetailTabs({
  driverId,
  onAssign,
  assignPending,
  assignOrderId,
  onAssignOrderIdChange,
}: {
  driverId: string;
  onAssign: (orderId: string) => void;
  assignPending: boolean;
  assignOrderId: string;
  onAssignOrderIdChange: (v: string) => void;
}) {
  const q = useQuery({
    queryKey: ['driver-detail', driverId],
    queryFn: async () => {
      const r = await fetch(`/api/drivers/${driverId}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      return j as {
        driver: Record<string, unknown>;
        profile: Record<string, unknown> | null;
        locations: { lat: number; lng: number; created_at: string }[];
        orders: { id: string; order_number?: string; status?: string; total_amount?: number; created_at: string }[];
        chart: { rating_series: number[]; orders_per_day: { day: string; count: number }[] };
      };
    },
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="text-sm text-destructive">
        {(q.error as Error).message}
        <Button className="mt-2" size="sm" variant="outline" onClick={() => q.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const data = q.data!;
  const ratingData = data.chart.rating_series.map((v, i) => ({ m: `M${i + 1}`, v }));
  const barData =
    data.chart.orders_per_day.length > 0
      ? data.chart.orders_per_day
      : data.orders.slice(0, 7).map((o, i) => ({
          day: new Date(o.created_at).toLocaleDateString('fr-FR', { weekday: 'short' }),
          count: i + 1,
        }));

  const path =
    data.locations.length > 1
      ? data.locations.map((l) => ({ lng: l.lng, lat: l.lat }))
      : data.locations.map((l) => ({ lng: l.lng, lat: l.lat }));

  const pathMarkers: MapWrapperMarker[] = path.map((p, i) => ({
    id: `gps-${i}`,
    lat: p.lat,
    lng: p.lng,
    tone: 'neutral',
  }));
  const pathCenter =
    path.length > 0
      ? {
          latitude: path.reduce((s, p) => s + p.lat, 0) / path.length,
          longitude: path.reduce((s, p) => s + p.lng, 0) / path.length,
          zoom: 13,
        }
      : { latitude: 12.1348, longitude: 15.0444, zoom: 11 };

  return (
    <Tabs defaultValue="profil" className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="profil">Profil</TabsTrigger>
        <TabsTrigger value="perf">Performances</TabsTrigger>
        <TabsTrigger value="orders">Commandes</TabsTrigger>
        <TabsTrigger value="gps">GPS</TabsTrigger>
        <TabsTrigger value="actions">Actions</TabsTrigger>
      </TabsList>
      <TabsContent value="profil" className="space-y-2 text-sm pt-2">
        <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-48">
          {JSON.stringify({ driver: data.driver, profile: data.profile }, null, 2)}
        </pre>
      </TabsContent>
      <TabsContent value="perf" className="pt-2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ratingData}>
            <XAxis dataKey="m" hide />
            <YAxis domain={[0, 5]} width={24} />
            <Tooltip />
            <Line type="monotone" dataKey="v" stroke="var(--brand)" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
        <div className="h-[180px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData.length ? barData : [{ day: '-', count: 0 }]}>
              <XAxis dataKey="day" />
              <YAxis width={24} />
              <Tooltip />
              <Bar dataKey="count" fill="color-mix(in srgb, var(--brand) 70%, white)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>
      <TabsContent value="orders" className="pt-2 space-y-2 text-sm max-h-56 overflow-auto">
        {data.orders.length === 0 ? (
          <p className="text-muted-foreground">Aucune commande récente.</p>
        ) : (
          data.orders.map((o) => (
            <div key={o.id} className="flex justify-between border-b border-border pb-1">
              <span>{o.order_number || o.id.slice(0, 8)}</span>
              <span className="text-muted-foreground">{o.status}</span>
            </div>
          ))
        )}
      </TabsContent>
      <TabsContent value="gps" className="pt-2">
        <MapWrapper height={280} className="mb-2" markers={pathMarkers} initialViewState={pathCenter} />
        <p className="text-xs text-muted-foreground">{data.locations.length} points récents</p>
      </TabsContent>
      <TabsContent value="actions" className="pt-2 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="UUID commande à assigner"
            value={assignOrderId}
            onChange={(e) => onAssignOrderIdChange(e.target.value)}
            className="max-w-xs font-mono text-xs"
          />
          <Button
            size="sm"
            disabled={assignPending || !/^[0-9a-f-]{36}$/i.test(assignOrderId)}
            onClick={() => onAssign(assignOrderId)}
          >
            Assigner
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Documents / export PDF / push : à brancher sur buckets et Edge selon votre déploiement.
        </p>
      </TabsContent>
    </Tabs>
  );
}
