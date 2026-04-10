'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Bell,
  ExternalLink,
  Flame,
  Layers,
  MapPinned,
  Maximize2,
  Minimize2,
  PlayCircle,
  Radio,
  RefreshCw,
  Search,
  Send,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminDrawer } from '@/components/ui/custom/AdminDrawer';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { parseApiJson } from '@/lib/fetch-api-json';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { DriversLiveMapControls } from './_components/DriversLiveLeaflet';
import type { LiveMapMarker, LiveStats } from './_components/types';

const DriversLiveLeaflet = dynamic(
  () => import('./_components/DriversLiveLeaflet').then((m) => m.DriversLiveLeaflet),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[420px] w-full rounded-xl" />,
  },
);

type LiveResponse = { markers: LiveMapMarker[]; stats: LiveStats };
type ZoneRow = { id: string; name: string; color: string; geojson: unknown; is_active: boolean };
type ReplayDriver = { driver_id: string; label: string };

const REFETCH_MS = 10_000;
const shortId = (v: string | null | undefined) => (v ? `${v.slice(0, 8)}…` : '—');

async function fetchLive(): Promise<LiveResponse> {
  const r = await fetch('/api/drivers/locations/live', { credentials: 'include' });
  const j = await parseApiJson<LiveResponse & { error?: string }>(r);
  if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur carte live');
  return { markers: j.markers || [], stats: j.stats };
}

async function fetchStatsExtra(): Promise<{ orders_without_driver: number }> {
  const r = await fetch('/api/drivers/live-stats', { credentials: 'include' });
  const j = await parseApiJson<{ data?: { orders_without_driver?: number }; error?: string }>(r);
  if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur stats');
  return { orders_without_driver: j.data?.orders_without_driver ?? 0 };
}

async function fetchZones(): Promise<ZoneRow[]> {
  const r = await fetch('/api/drivers/zones', { credentials: 'include' });
  const j = await parseApiJson<{ data?: ZoneRow[]; error?: string }>(r);
  if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur zones');
  return j.data || [];
}

async function fetchHeat(): Promise<[number, number, number][]> {
  const r = await fetch('/api/drivers/locations/heatmap?hours=24', { credentials: 'include' });
  const j = await parseApiJson<{ data?: { points?: [number, number, number][] }; error?: string }>(r);
  if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur heatmap');
  return j.data?.points || [];
}

type FilterKey = 'all' | 'online' | 'delivering' | 'idle' | 'inactive';

function matchFilter(m: LiveMapMarker, f: FilterKey): boolean {
  if (f === 'all') return true;
  if (f === 'online') return m.status === 'online';
  if (f === 'delivering') return m.status === 'delivering' || m.status === 'busy' || Boolean(m.order_id);
  if (f === 'idle') return m.status === 'idle';
  if (f === 'inactive') return m.status === 'inactive';
  return true;
}

export default function DriversLiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightFromUrl = searchParams.get('highlight')?.trim() || null;

  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<LiveMapMarker | null>(null);
  const [showHeat, setShowHeat] = React.useState(false);
  const [showZones, setShowZones] = React.useState(true);
  const [replayOpen, setReplayOpen] = React.useState(false);
  const [replayDriverId, setReplayDriverId] = React.useState<string>('');
  const [replayDay, setReplayDay] = React.useState<Date | undefined>(new Date());
  const [replayLine, setReplayLine] = React.useState<[number, number][]>([]);
  const [replayLoading, setReplayLoading] = React.useState(false);
  const [replayCalendarMonth, setReplayCalendarMonth] = React.useState<Date>(() => new Date());
  const [mapFullscreen, setMapFullscreen] = React.useState(false);
  const [zoneFrameStyle, setZoneFrameStyle] = React.useState<'dash' | 'round'>('dash');
  const [tick, setTick] = React.useState(0);
  const mapControlsRef = React.useRef<DriversLiveMapControls | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifTitle, setNotifTitle] = React.useState('Opérations — position live');
  const [notifBody, setNotifBody] = React.useState('');
  const [notifDeeplink, setNotifDeeplink] = React.useState('gba://drivers/live');

  const liveQ = useQuery({
    queryKey: ['drivers-live'],
    queryFn: fetchLive,
    refetchInterval: REFETCH_MS,
    staleTime: 0,
  });

  const statsQ = useQuery({
    queryKey: ['drivers-live-stats-extra'],
    queryFn: fetchStatsExtra,
    refetchInterval: 15_000,
  });

  const zonesQ = useQuery({
    queryKey: ['drivers-zones'],
    queryFn: fetchZones,
    staleTime: 60_000,
  });

  const heatQ = useQuery({
    queryKey: ['drivers-heatmap'],
    queryFn: fetchHeat,
    enabled: showHeat,
    staleTime: 120_000,
  });

  const replayDaysQ = useQuery({
    queryKey: [
      'driver-replay-days',
      replayDriverId,
      format(replayCalendarMonth, 'yyyy-MM'),
    ],
    queryFn: async () => {
      if (!replayDriverId) return [] as string[];
      const from = startOfMonth(replayCalendarMonth).toISOString();
      const to = endOfMonth(replayCalendarMonth).toISOString();
      const r = await fetch(
        `/api/drivers/locations/history/${replayDriverId}/replay-days?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: 'include' },
      );
      const j = await parseApiJson<{ data?: { dates?: string[] }; error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Jours replay');
      return j.data?.dates || [];
    },
    enabled: replayOpen && !!replayDriverId,
    staleTime: 60_000,
  });

  const replayDriversQ = useQuery({
    queryKey: ['drivers-replay-options'],
    queryFn: async () => {
      const r = await fetch('/api/drivers/replay-options', { credentials: 'include' });
      const j = await parseApiJson<{ data?: ReplayDriver[]; error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Drivers replay');
      return j.data || [];
    },
    staleTime: 60_000,
  });

  const replayCalendarDates = React.useMemo(
    () => (replayDaysQ.data || []).map((d) => new Date(`${d}T12:00:00`)),
    [replayDaysQ.data],
  );

  React.useEffect(() => {
    if (replayOpen && replayDay) setReplayCalendarMonth(replayDay);
  }, [replayOpen, replayDay]);

  React.useEffect(() => {
    const ch = supabase
      .channel('driver-locations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        () => {
          qc.invalidateQueries({ queryKey: ['drivers-live'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsToRefetch = REFETCH_MS / 1000 - (tick % (REFETCH_MS / 1000));

  const markers = React.useMemo(() => {
    const list = liveQ.data?.markers || [];
    const q = search.trim().toLowerCase();
    return list.filter((m) => {
      if (!matchFilter(m, filter)) return false;
      if (!q) return true;
      return m.display_name.toLowerCase().includes(q) || m.driver_id.toLowerCase().includes(q);
    });
  }, [liveQ.data?.markers, filter, search]);

  const stats = liveQ.data?.stats;

  React.useEffect(() => {
    if (!highlightFromUrl || !liveQ.data?.markers) return;
    const m = liveQ.data.markers.find((x) => x.driver_id === highlightFromUrl);
    if (m) setSelected(m);
  }, [highlightFromUrl, liveQ.data?.markers]);

  React.useEffect(() => {
    if (!mapFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapFullscreen]);

  function openNotificationsFromLive() {
    if (!selected) {
      toast.error('Sélectionnez un livreur sur la carte ou dans la liste');
      return;
    }
    const bodyText =
      notifBody.trim() ||
      `Bonjour ${selected.display_name}, message lié au suivi GPS (live). Statut : ${selected.status}.`;
    const params = new URLSearchParams({
      tab: 'composer',
      user: selected.driver_id,
      title: notifTitle.trim() || 'Opérations',
      body: bodyText,
      src: 'drivers_live',
    });
    if (notifDeeplink.trim()) params.set('deeplink', notifDeeplink.trim());
    if (selected.lat != null && selected.lng != null) {
      params.set('gps_lat', String(selected.lat));
      params.set('gps_lng', String(selected.lng));
    }
    router.push(`/notifications?${params.toString()}`);
    setNotifOpen(false);
    toast.message('Hub notifications ouvert avec brouillon GPS');
  }

  React.useEffect(() => {
    if (!selected) return;
    setNotifBody(
      `Bonjour ${selected.display_name}, votre position live est suivie (statut : ${selected.status}).`,
    );
  }, [selected?.driver_id, selected?.display_name, selected?.status]);

  async function loadReplay() {
    if (!replayDriverId || !replayDay) {
      toast.error('Choisissez un livreur et une date');
      return;
    }
    const start = new Date(replayDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(replayDay);
    end.setHours(23, 59, 59, 999);
    const from = start.toISOString();
    const to = end.toISOString();
    setReplayLoading(true);
    try {
      const r = await fetch(
        `/api/drivers/locations/history/${replayDriverId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: 'include' },
      );
      const j = await parseApiJson<{
        data?: { points?: { lat: number; lng: number }[] };
        error?: string;
      }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Historique indisponible');
      const pts = j.data?.points || [];
      const line: [number, number][] = pts.map((p) => [p.lat, p.lng]);
      if (line.length < 2) {
        toast.message('Pas assez de points pour ce jour');
        setReplayLine([]);
      } else {
        setReplayLine(line);
        toast.success(`Trajet chargé (${line.length} points)`);
        setReplayOpen(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setReplayLoading(false);
    }
  }

  return (
    <motion.div
      className="flex h-[calc(100dvh-3.5rem)] min-h-[560px] flex-col gap-2 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <PageHeader
        title="Centrale commandement visuel — GPS Live"
        subtitle="Temps réel, replay trajectoires, heatmap, zones — lié aux notifications livreurs"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/drivers"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Liste
            </Link>
            <Button variant="outline" size="sm" type="button" onClick={() => setNotifOpen(true)}>
              <Send className="h-3.5 w-3.5 mr-1" />
              Notification GPS → hub
            </Button>
            <Link
              href="/notifications"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <Bell className="h-3.5 w-3.5" />
              Notifications
            </Link>
            <Button variant="outline" size="sm" onClick={() => liveQ.refetch()} disabled={liveQ.isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5', liveQ.isFetching && 'animate-spin')} />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs">
        <span className="text-muted-foreground">KPI</span>
        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
          ● {stats?.online ?? '—'} en ligne
        </span>
        <span className="rounded-md bg-blue-500/15 px-2 py-0.5 font-medium text-blue-700 dark:text-blue-400">
          ● {stats?.delivering ?? '—'} en livraison
        </span>
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-300">
          ● {stats?.idle ?? '—'} dispo / idle
        </span>
        <span className="rounded-md bg-slate-500/15 px-2 py-0.5 font-medium text-slate-700 dark:text-slate-300">
          ● {stats?.offline ?? '—'} hors ligne
        </span>
        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 font-medium text-violet-700 dark:text-violet-300">
          Cmd actives {stats?.orders_active ?? '—'}
        </span>
        {statsQ.data?.orders_without_driver != null && statsQ.data.orders_without_driver > 0 ? (
          <span className="rounded-md bg-red-500/15 px-2 py-0.5 font-medium text-red-700 dark:text-red-400">
            ⚠ {statsQ.data.orders_without_driver} sans livreur
          </span>
        ) : null}
        <span className="ml-auto text-muted-foreground">
          MAJ {stats?.updated_at ? new Date(stats.updated_at).toLocaleTimeString('fr-FR') : '—'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'online', 'delivering', 'idle', 'inactive'] as const).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>
            {k === 'all'
              ? 'Tous'
              : k === 'online'
                ? 'En ligne'
                : k === 'delivering'
                  ? 'En livraison'
                  : k === 'idle'
                    ? 'Dispo / idle'
                    : 'Inactifs'}
          </Button>
        ))}
        <div className="relative min-w-[160px] max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="Rechercher un livreur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <Switch checked={showZones} onCheckedChange={setShowZones} />
            Zones
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <Switch checked={showHeat} onCheckedChange={setShowHeat} />
            Heatmap
          </Label>
        </div>
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Cadre zones</Label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={zoneFrameStyle}
            onChange={(e) => setZoneFrameStyle(e.target.value as 'dash' | 'round')}
          >
            <option value="dash">Traits (polygone)</option>
            <option value="round">Cercle (zone)</option>
          </select>
        </div>
      </div>

      <div
        className={cn(
          'relative grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]',
          mapFullscreen && 'fixed inset-0 z-[200] grid-cols-1 bg-background p-2 sm:p-3',
        )}
      >
        <motion.div
          className={cn(
            'relative min-h-[420px] min-w-0 flex-1 overflow-hidden rounded-xl border border-border',
            mapFullscreen && 'min-h-0 flex-1 rounded-lg border-0',
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {liveQ.isError ? (
            <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 bg-muted/40 p-6 text-center backdrop-blur-sm">
              <p className="text-sm text-destructive">{(liveQ.error as Error).message}</p>
              <Button size="sm" variant="outline" onClick={() => liveQ.refetch()}>
                Réessayer
              </Button>
            </div>
          ) : null}

          <div className="absolute bottom-3 right-3 z-[500] flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shadow-md"
              onClick={() => setMapFullscreen((v) => !v)}
            >
              {mapFullscreen ? (
                <>
                  <Minimize2 className="mr-1 h-3.5 w-3.5" />
                  Quitter plein écran
                </>
              ) : (
                <>
                  <Maximize2 className="mr-1 h-3.5 w-3.5" />
                  Plein écran
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shadow-md"
              onClick={() => mapControlsRef.current?.fitAll()}
            >
              <Target className="mr-1 h-3.5 w-3.5" />
              Centrer tout
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shadow-md"
              onClick={() => setReplayOpen(true)}
            >
              <PlayCircle className="mr-1 h-3.5 w-3.5" />
              Replay
            </Button>
            {replayLine.length >= 2 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shadow-md"
                onClick={() => {
                  setReplayLine([]);
                  toast.message('Trajet effacé');
                }}
              >
                Effacer trajet
              </Button>
            ) : null}
          </div>

          <DriversLiveLeaflet
            className="h-full min-h-[420px] w-full"
            markers={markers}
            zones={zonesQ.data || []}
            heatPoints={heatQ.data || []}
            showHeat={showHeat && !heatQ.isError}
            showZones={showZones && !zonesQ.isError}
            selectedId={selected?.driver_id ?? null}
            highlightDriverId={highlightFromUrl}
            replayLatLngs={replayLine.length >= 2 ? replayLine : undefined}
            zoneOutlineStyle={zoneFrameStyle}
            onSelect={setSelected}
            mapControlsRef={mapControlsRef}
          />
        </motion.div>

        <Card
          className={cn(
            'flex min-h-0 w-full min-w-0 flex-col gap-3 overflow-y-auto border-border p-4',
            mapFullscreen && 'hidden',
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="h-4 w-4 text-emerald-500" />
            Livreurs ({markers.length})
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Sur la carte : <span className="font-medium text-foreground">{stats?.drivers_on_map ?? '—'}</span>
            </p>
            <p>
              Livraisons actives (marqueurs) :{' '}
              <span className="font-medium text-foreground">{stats?.active_deliveries ?? '—'}</span>
            </p>
          </div>
          <div className="max-h-[42vh] space-y-1 overflow-y-auto border-t border-border pt-2">
            {markers.length === 0 && !liveQ.isLoading ? (
              <p className="text-xs text-muted-foreground">Aucun livreur pour ce filtre.</p>
            ) : null}
            {markers.map((m) => (
              <button
                key={m.driver_id}
                type="button"
                onClick={() => setSelected(m)}
                className={cn(
                  'w-full rounded-lg border border-transparent px-2 py-2 text-left text-xs transition-colors hover:bg-muted',
                  selected?.driver_id === m.driver_id && 'border-primary bg-muted',
                )}
              >
                <div className="font-medium text-foreground">{m.display_name}</div>
                <div className="text-muted-foreground">
                  {m.status}
                  {m.stale_position ? ' · position ancienne' : ''}
                </div>
                {m.speed_kmh != null ? <div className="text-[10px]">{m.speed_kmh} km/h</div> : null}
              </button>
            ))}
          </div>

          {selected ? (
            <div className="space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <MapPinned className="h-4 w-4 text-primary" />
                {selected.display_name}
              </div>
              <div className="text-xs text-muted-foreground">Statut : {selected.status}</div>
              {(selected.inactive_minutes ?? 0) > 20 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">Sans mouvement &gt; 20 min</p>
              ) : null}
              {selected.battery_level != null && selected.battery_level < 15 ? (
                <p className="text-xs text-red-600">Batterie faible ({selected.battery_level}%)</p>
              ) : null}
              {selected.delivery_address ? (
                <p className="text-xs text-muted-foreground">{selected.delivery_address}</p>
              ) : null}
              {selected.phone ? (
                <a
                  href={`tel:${selected.phone}`}
                  className="inline-flex h-9 w-full items-center justify-center rounded-md bg-secondary text-sm font-medium"
                >
                  Appeler
                </a>
              ) : null}
              <Link
                href={`/drivers/live?highlight=${selected.driver_id}`}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-muted"
              >
                Lien direct (highlight)
              </Link>
              <a
                href={
                  selected.lat != null && selected.lng != null
                    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selected.lat},${selected.lng}`
                    : '#'
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (selected.lat == null || selected.lng == null) {
                    e.preventDefault();
                    toast.error('Coordonnées GPS indisponibles pour ce livreur');
                  }
                }}
                className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Vue immersive (caméra / Street View)
              </a>
              <Button size="sm" className="w-full" type="button" onClick={() => setNotifOpen(true)}>
                <Send className="h-3.5 w-3.5 mr-1" />
                Préparer notification (GPS)
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sélectionnez un livreur dans la liste ou sur la carte.</p>
          )}
        </Card>
      </div>

      <div className="flex h-8 shrink-0 items-center justify-center border-t border-border bg-muted/30 text-xs text-muted-foreground">
        Actualisation dans {Math.max(0, secondsToRefetch)}s · {markers.length} livreur(s) affiché(s) · Temps réel +
        polling 10s
      </div>

      <Card className="shrink-0 border-dashed border-border/80 bg-muted/10 p-4 text-xs text-muted-foreground">
        <h3 className="text-sm font-semibold text-foreground mb-2">Feuille de route — fonctionnalités à ajouter</h3>
        <ul className="list-disc space-y-1 pl-4 leading-relaxed">
          <li>WebSocket ou channel dédié pour latence &lt; 3 s sans sur-poller.</li>
          <li>Clustering intelligent des marqueurs + compteur par zone (GeoJSON).</li>
          <li>Historique multi-jours export GPX / CSV et comparaison de tournées.</li>
          <li>Alertes géofence (sortie zone, immobilité prolongée) avec file vers notifications.</li>
          <li>Couche trafic / ETA vers prochaine livraison (API Maps).</li>
          <li>Mode « dispatch » : assignation commande → livreur depuis la carte.</li>
          <li>File d’attente audio / PTT (WebRTC) ops ↔ livreur (hors scope court terme).</li>
          <li>Heatmap temps réel configurable (1 h / 6 h / 24 h) + légende.</li>
        </ul>
      </Card>

      <AdminDrawer
        open={notifOpen}
        onOpenChange={setNotifOpen}
        title="Notification liée au GPS live"
        description="Paramètres préremplis pour le hub : utilisateur = livreur sélectionné, deep link et coordonnées optionnelles."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setNotifOpen(false)}>
              Fermer
            </Button>
            <Button size="sm" type="button" onClick={openNotificationsFromLive}>
              Ouvrir /notifications
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Le livreur cible est celui sélectionné sur la carte. Le hub applique le brouillon (titre, corps, deep link) et
            peut envoyer via FCM.
          </p>
          <div>
            <Label>Titre</Label>
            <Input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} />
          </div>
          <div>
            <Label>Corps</Label>
            <Textarea rows={4} value={notifBody} onChange={(e) => setNotifBody(e.target.value)} />
          </div>
          <div>
            <Label>Deep link (payload route)</Label>
            <Input
              value={notifDeeplink}
              onChange={(e) => setNotifDeeplink(e.target.value)}
              placeholder="gba://drivers/live ou chemin app"
            />
          </div>
          {selected ? (
            <p className="text-[10px] text-muted-foreground font-mono">
              user_id={shortId(selected.driver_id)} · lat {selected.lat?.toFixed(5) ?? '—'} lng {selected.lng?.toFixed(5) ?? '—'}
            </p>
          ) : (
            <p className="text-xs text-amber-600">Sélectionnez un livreur avant d’ouvrir le hub.</p>
          )}
        </div>
      </AdminDrawer>

      <AdminDrawer
        open={replayOpen}
        onOpenChange={setReplayOpen}
        title="Replay trajectoire"
        description="Charger les positions enregistrées pour une journée (driver_locations)."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setReplayOpen(false)}>
              Fermer
            </Button>
            <Button size="sm" disabled={replayLoading} onClick={() => void loadReplay()}>
              {replayLoading ? 'Chargement…' : 'Charger'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <Label>Livreur (UUID auth / driver_id GPS)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={replayDriverId}
              onChange={(e) => setReplayDriverId(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {(replayDriversQ.data || liveQ.data?.markers || []).map((m) => (
                <option key={m.driver_id} value={m.driver_id}>
                  {'label' in m ? m.label : m.display_name} ({shortId(m.driver_id)})
                </option>
              ))}
            </select>
            {!replayDriversQ.isLoading && !(replayDriversQ.data || []).length ? (
              <p className="text-[10px] text-amber-600">Aucun livreur actif trouvé pour replay.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Jour</Label>
            <Calendar
              mode="single"
              selected={replayDay}
              onSelect={setReplayDay}
              locale={fr}
              month={replayCalendarMonth}
              onMonthChange={setReplayCalendarMonth}
              modifiers={{ hasReplay: replayCalendarDates }}
              modifiersClassNames={{
                hasReplay:
                  'relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-emerald-500 data-[selected-single=true]:after:bg-primary-foreground',
              }}
              className="rounded-md border border-border p-2"
            />
            {replayDaysQ.isFetching ? (
              <p className="text-xs text-muted-foreground">Chargement des jours avec trajet…</p>
            ) : null}
            <p className="text-[10px] text-muted-foreground">
              Jours avec au moins un point GPS : pastille verte sous la date (mois affiché).
            </p>
            {replayDay ? (
              <p className="text-xs text-muted-foreground">
                {format(replayDay, 'PPP', { locale: fr })}
              </p>
            ) : null}
          </div>
        </div>
      </AdminDrawer>
    </motion.div>
  );
}
