'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Bike,
  Car,
  ClipboardList,
  ExternalLink,
  MapPin,
  PackageOpen,
  Star,
  Truck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { MapWrapper, type MapWrapperMarker } from '@/components/shared/MapWrapper';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const LIVE_MS = 15 * 60 * 1000;

const ORDER_ONGOING = new Set(['pending', 'confirmed', 'processing', 'shipped', 'paid', 'preparing']);
const ORDER_DONE = new Set(['delivered', 'completed']);
const ORDER_CANCELLED = new Set(['cancelled', 'refunded', 'failed']);

function vehicleIcon(type: string | null | undefined) {
  const t = String(type || '').toLowerCase();
  if (t.includes('moto') || t.includes('bike') || t.includes('vélo') || t.includes('velo'))
    return Bike;
  if (t.includes('van')) return Truck;
  return Car;
}

function displayDriverName(driver: Record<string, unknown>, profile: Record<string, unknown> | null) {
  const dn = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  if (dn) return String(dn);
  return String(driver.name || 'Livreur');
}

type OrderRow = {
  id: string;
  order_number?: string;
  status?: string;
  total_amount?: number;
  created_at: string;
  updated_at?: string;
};

type LocRow = {
  lat: number;
  lng: number;
  created_at?: string;
  captured_at?: string;
  recorded_at?: string;
};

export interface DriverDetailPanelProps {
  driverId: string;
  listRowName: string;
  onAssign: (orderId: string) => void;
  assignPending: boolean;
  assignOrderId: string;
  onAssignOrderIdChange: (v: string) => void;
  onSuspendRequest: () => void;
  onEditRequest: () => void;
}

export function DriverDetailPanel({
  driverId,
  listRowName,
  onAssign,
  assignPending,
  assignOrderId,
  onAssignOrderIdChange,
  onSuspendRequest,
  onEditRequest,
}: DriverDetailPanelProps) {
  const qc = useQueryClient();
  const [orderFilter, setOrderFilter] = React.useState<'ongoing' | 'done' | 'cancelled'>('ongoing');
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [deleteStep1, setDeleteStep1] = React.useState(false);
  const [deleteStep2, setDeleteStep2] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState('');

  const q = useQuery({
    queryKey: ['driver-detail', driverId],
    queryFn: async () => {
      const r = await fetch(`/api/drivers/${driverId}`, { credentials: 'include' });
      const j = (await r.json()) as {
        error?: string | unknown;
        driver: Record<string, unknown>;
        profile: Record<string, unknown> | null;
        locations: LocRow[];
        orders: OrderRow[];
        chart: { rating_series: number[]; orders_per_day: { day: string; count: number }[] };
      };
      if (!r.ok) {
        const err = j.error;
        const msg =
          typeof err === 'string'
            ? err
            : err && typeof err === 'object' && 'formErrors' in (err as object)
              ? JSON.stringify(err)
              : 'Erreur chargement fiche';
        throw new Error(msg);
      }
      return j;
    },
  });

  const patchMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/drivers/${driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Mise à jour impossible');
      return j;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['driver-detail', driverId] });
      void qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Livreur mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/drivers/${driverId}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Suppression impossible');
      return j;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Compte livreur désactivé');
      setDeleteStep1(false);
      setDeleteStep2(false);
      setDeleteConfirm('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPwdMut = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/users/${userId}/password-reset`, {
        method: 'POST',
        credentials: 'include',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec envoi lien');
      return j as { email_sent?: boolean; email_error?: string | null };
    },
    onSuccess: (res) => {
      if (res.email_sent) toast.success('E-mail de réinitialisation envoyé');
      else toast.message('Lien généré', { description: res.email_error || 'Vérifiez la configuration e-mail.' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-3 py-1">
        <div className="flex gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p>{(q.error as Error).message}</p>
        <Button className="mt-3" size="sm" variant="outline" type="button" onClick={() => q.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const data = q.data!;
  const driver = data.driver;
  const profile = data.profile;
  const uid = (driver.user_id as string | null) || null;
  const name = displayDriverName(driver, profile);
  const isActive = driver.is_active !== false;
  const suspendedProfile = profile?.is_suspended === true;
  const isOnline = driver.is_online === true;
  const VehicleIc = vehicleIcon(driver.vehicle_type as string | null);

  let statusKey: 'online' | 'offline' | 'suspended' = 'offline';
  if (!isActive || suspendedProfile) statusKey = 'suspended';
  else if (isOnline) statusKey = 'online';

  const statusLabel =
    statusKey === 'suspended' ? 'Suspendu' : statusKey === 'online' ? 'En ligne' : 'Hors ligne';

  const lastLoc = data.locations[0];
  const latFallback = Number(driver.current_lat);
  const lngFallback = Number(driver.current_lng);
  const hasCoords =
    lastLoc && Number.isFinite(lastLoc.lat) && Number.isFinite(lastLoc.lng)
      ? true
      : Number.isFinite(latFallback) && Number.isFinite(lngFallback);

  const lat = lastLoc && Number.isFinite(lastLoc.lat) ? lastLoc.lat : latFallback;
  const lng = lastLoc && Number.isFinite(lastLoc.lng) ? lastLoc.lng : lngFallback;

  const atRaw =
    (lastLoc?.captured_at as string | undefined) ||
    (lastLoc?.recorded_at as string | undefined) ||
    lastLoc?.created_at ||
    (driver.last_location_at as string | undefined);
  const atMs = atRaw ? new Date(atRaw).getTime() : 0;
  const fresh = atMs && Date.now() - atMs < LIVE_MS;
  const gpsMode: 'live' | 'last' = fresh && isOnline ? 'live' : 'last';

  const pathMarkers: MapWrapperMarker[] =
    hasCoords && Number.isFinite(lat) && Number.isFinite(lng)
      ? [{ id: 'last', lat, lng, tone: gpsMode === 'live' ? 'online' : 'neutral' }]
      : [];

  const pathCenter =
    hasCoords && Number.isFinite(lat) && Number.isFinite(lng)
      ? { latitude: lat, longitude: lng, zoom: 14 }
      : { latitude: 12.1348, longitude: 15.0444, zoom: 11 };

  const orders = data.orders || [];
  const filteredOrders = orders.filter((o) => {
    const s = String(o.status || '').toLowerCase();
    if (orderFilter === 'ongoing') return ORDER_ONGOING.has(s) || (!ORDER_DONE.has(s) && !ORDER_CANCELLED.has(s));
    if (orderFilter === 'done') return ORDER_DONE.has(s);
    return ORDER_CANCELLED.has(s);
  });

  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const ordersToday = orders.filter((o) => new Date(o.created_at).getTime() >= startDay.getTime()).length;
  const ongoingCount = orders.filter((o) => {
    const s = String(o.status || '').toLowerCase();
    return ORDER_ONGOING.has(s) || (!ORDER_DONE.has(s) && !ORDER_CANCELLED.has(s));
  }).length;
  const doneCount = orders.filter((o) => ORDER_DONE.has(String(o.status || '').toLowerCase())).length;

  const sparkData = (data.chart.orders_per_day || []).map((d) => ({
    label: format(new Date(d.day + 'T12:00:00'), 'EEE', { locale: fr }),
    count: d.count,
  }));

  const ratingAvg = Number(driver.rating_avg);
  const totalDel = Number(driver.total_deliveries ?? 0);
  const earnings = Number(driver.total_earnings ?? 0);

  return (
    <>
      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="profil" className="text-xs sm:text-sm">
            Profil
          </TabsTrigger>
          <TabsTrigger value="perf" className="text-xs sm:text-sm">
            Performances
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs sm:text-sm">
            Commandes
          </TabsTrigger>
          <TabsTrigger value="gps" className="text-xs sm:text-sm">
            GPS
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs sm:text-sm">
            Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative">
              <AvatarWithInitials
                src={(profile?.avatar_url as string | null) ?? null}
                name={name}
                size={64}
              />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-background text-[10px]',
                  statusKey === 'online' && 'bg-emerald-500 text-white',
                  statusKey === 'offline' && 'bg-zinc-400 text-white',
                  statusKey === 'suspended' && 'bg-red-500 text-white',
                )}
                title={statusLabel}
              >
                {statusKey === 'online' ? '●' : statusKey === 'suspended' ? '!' : '○'}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <h3 className="font-semibold leading-tight">{name}</h3>
                <p className="text-sm text-muted-foreground">
                  {(profile?.phone as string) || (driver.phone as string) || '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  status={statusKey === 'suspended' ? 'suspended' : statusKey === 'online' ? 'online' : 'offline'}
                  customLabel={statusLabel}
                />
                <StatusBadge
                  status={isActive && !suspendedProfile ? 'active' : 'suspended'}
                  customLabel={isActive && !suspendedProfile ? 'Compte actif' : 'Compte suspendu'}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <VehicleIc className="size-4 shrink-0 text-[#6C47FF]" />
                <span>
                  {[driver.vehicle_type, driver.vehicle_color, driver.vehicle_plate].filter(Boolean).join(' · ') ||
                    'Véhicule non renseigné'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {isActive ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setSuspendOpen(true)}>
                    Suspendre
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => patchMut.mutate({ is_active: true })}
                    disabled={patchMut.isPending}
                  >
                    Réactiver
                  </Button>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Inscription</dt>
                  <dd className="font-medium">
                    {driver.created_at
                      ? format(new Date(String(driver.created_at)), 'd MMM yyyy à HH:mm', { locale: fr })
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dernière activité GPS</dt>
                  <dd className="font-medium">
                    {atRaw ? format(new Date(atRaw), 'd MMM yyyy à HH:mm', { locale: fr }) : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="perf" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-[#6C47FF]">{ordersToday}</p>
              <p className="text-[11px] text-muted-foreground">Livraisons aujourd’hui</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{totalDel}</p>
              <p className="text-[11px] text-muted-foreground">Total livraisons</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{ongoingCount}</p>
              <p className="text-[11px] text-muted-foreground">En cours (échantillon)</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{doneCount}</p>
              <p className="text-[11px] text-muted-foreground">Terminées (échantillon)</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="size-5 text-amber-500" fill="currentColor" />
                <p className="text-2xl font-bold tabular-nums">
                  {Number.isFinite(ratingAvg) ? ratingAvg.toFixed(1) : '—'}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Note moyenne</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-lg font-bold tabular-nums leading-tight">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(
                  earnings,
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">Gains totaux</p>
            </div>
          </div>
          <div className="h-[100px] w-full rounded-xl border border-border bg-muted/20 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData.length ? sparkData : [{ label: '-', count: 0 }]}>
                <defs>
                  <linearGradient id="sparkDriver" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis width={22} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [`${Number(v)} commande(s)`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--brand)"
                  fill="url(#sparkDriver)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">Activité sur 7 jours</p>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { k: 'ongoing' as const, label: 'En cours' },
                { k: 'done' as const, label: 'Terminées' },
                { k: 'cancelled' as const, label: 'Annulées' },
              ] as const
            ).map(({ k, label }) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={orderFilter === k ? 'default' : 'outline'}
                className="h-8"
                onClick={() => setOrderFilter(k)}
              >
                {label}
              </Button>
            ))}
          </div>
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <PackageOpen className="mb-3 size-12 text-muted-foreground/50" />
              <p className="text-sm font-medium">Aucune livraison enregistrée</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Aucune commande ne correspond à ce filtre pour cet échantillon récent.
              </p>
            </div>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-auto pr-1">
              {filteredOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">{o.order_number || 'Commande'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(o.created_at), 'd MMM yyyy · HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={String(o.status || 'pending')} size="sm" />
                    <span className="text-xs font-medium tabular-nums">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(
                        Number(o.total_amount ?? 0),
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="gps" className="space-y-3 pt-4">
          <MapWrapper height={220} className="rounded-xl border border-border" markers={pathMarkers} initialViewState={pathCenter} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <MapPin className="size-4 text-muted-foreground" />
            {hasCoords ? (
              <span className="tabular-nums text-muted-foreground">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            ) : (
              <span className="text-muted-foreground">Position inconnue</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Dernière mise à jour :{' '}
            {atRaw ? format(new Date(atRaw), "d MMMM yyyy 'à' HH:mm:ss", { locale: fr }) : '—'}
          </p>
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                gpsMode === 'live' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
              )}
            >
              <span className="size-2 rounded-full bg-current" />
              {gpsMode === 'live' ? 'Temps réel' : 'Dernière position capturée'}
            </span>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="assign-order">Assigner une commande</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="assign-order"
                placeholder="Collez la référence interne de la commande"
                value={assignOrderId}
                onChange={(e) => onAssignOrderIdChange(e.target.value)}
                className="max-w-md"
              />
              <Button
                type="button"
                size="sm"
                disabled={assignPending || !/^[0-9a-f-]{36}$/i.test(assignOrderId)}
                onClick={() => onAssign(assignOrderId)}
              >
                Assigner
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onEditRequest}>
              Modifier la fiche livreur
            </Button>
            {isActive ? (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setSuspendOpen(true)}>
                Suspendre le compte
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-fit"
                onClick={() => patchMut.mutate({ is_active: true })}
                disabled={patchMut.isPending}
              >
                Réactiver le compte
              </Button>
            )}
            {uid ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={resetPwdMut.isPending}
                onClick={() => resetPwdMut.mutate(uid)}
              >
                Réinitialiser le mot de passe (e-mail)
              </Button>
            ) : null}
            <Link
              href={`/audit?entity_type=driver&entity_id=${encodeURIComponent(driverId)}`}
              className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <ClipboardList className="size-4" />
              Journal d’activité
              <ExternalLink className="size-3 opacity-60" />
            </Link>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-fit"
              onClick={() => setDeleteStep1(true)}
            >
              Désactiver le livreur
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmModal
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspendre le livreur"
        description="Le compte ne pourra plus être utilisé pour les livraisons jusqu’à réactivation."
        confirmationPhrase={listRowName}
        confirmationLabel="Saisir le nom affiché du livreur pour confirmer"
        confirmLabel="Suspendre"
        variant="destructive"
        onConfirm={async () => {
          await patchMut.mutateAsync({ is_active: false, suspension_reason: 'Suspension administrative' });
          setSuspendOpen(false);
          onSuspendRequest();
        }}
      />

      <Dialog open={deleteStep1} onOpenChange={setDeleteStep1}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Désactiver ce livreur ?
            </DialogTitle>
            <DialogDescription>
              Le livreur ne sera plus proposé pour les assignations. Cette action peut être annulée en réactivant le compte.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteStep1(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteStep1(false);
                setDeleteStep2(true);
              }}
            >
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteStep2} onOpenChange={setDeleteStep2}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmation finale</DialogTitle>
            <DialogDescription>
              Saisissez <strong>DESACTIVER</strong> pour confirmer la désactivation du compte livreur.
            </DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DESACTIVER" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteStep2(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirm.trim().toUpperCase() !== 'DESACTIVER' || deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
