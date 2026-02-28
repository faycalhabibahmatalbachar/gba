'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  App,
  Empty,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  PhoneOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  CarOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  fetchAllDriversWithState,
  fetchDriverLocation,
  fetchDriverTrail,
  type DriverWithState,
  type DriverProfile,
  type DriverLocation,
  type ActiveOrder,
} from '@/lib/services/delivery-tracking';
import PageHeader from '@/components/ui/PageHeader';
import { useThemeMode } from '@/components/layout/ThemeProvider';

const DeliveryTrackingMap = dynamic(() => import('./DeliveryTrackingMap'), { ssr: false });

function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

const STALE_MINUTES = 10;
const OVERLOAD_THRESHOLD = 5;
const TRAIL_MAX = 10;

const mapName = (d: DriverProfile) =>
  `${[d.first_name, d.last_name].filter(Boolean).join(' ')}`.trim() || d.email || d.phone || `Livreur ${d.id.slice(0, 8)}`;

export default function DeliveryTrackingPage() {
  const { dark } = useThemeMode();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [fleet, setFleet] = useState<DriverWithState[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null);
  const [clientLoc, setClientLoc] = useState<DriverLocation | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const driverChRef = useRef<any>(null);
  const clientChRef = useRef<any>(null);

  const loadFleet = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setPageError(null);
    try {
      const data = await fetchAllDriversWithState();
      setFleet(data);
      if (!selectedDriverId && data.length) setSelectedDriverId(data[0].driver.id);
    } catch (e: any) {
      const msg = e?.message || 'Erreur chargement flotte';
      setPageError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDriverId, message]);

  const selectedDriverState = useMemo(
    () => fleet.find((f) => f.driver.id === selectedDriverId) || null,
    [fleet, selectedDriverId],
  );
  const orders = selectedDriverState?.orders ?? [];
  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || orders[0],
    [orders, selectedOrderId],
  );

  const fetchClientLoc = useCallback(async (userId: string) => {
    const { data } = await supabase.from('user_locations').select('*').eq('user_id', userId).maybeSingle();
    setClientLoc((data as any) || null);
  }, []);

  const loadDriverDetail = useCallback(async (driverId: string) => {
    if (!driverId) return;
    try {
      const [loc, trailData] = await Promise.all([
        fetchDriverLocation(driverId),
        fetchDriverTrail(driverId, TRAIL_MAX),
      ]);
      setDriverLoc(loc);
      setTrail(trailData);
      if (!loc) setClientLoc(null);
    } catch {
      setDriverLoc(null);
      setTrail([]);
    }
  }, []);

  const subscribeDriver = useCallback((driverId: string) => {
    driverChRef.current?.unsubscribe?.();
    driverChRef.current = supabase
      .channel(`dt-drv-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        ({ new: loc }: any) => {
          if (loc?.lat == null) return;
          setDriverLoc(loc);
          setTrail((p) => [...p.slice(-(TRAIL_MAX - 1)), [loc.lat, loc.lng]]);
          void loadFleet(true);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        ({ new: loc }: any) => {
          if (loc?.lat == null) return;
          setDriverLoc(loc);
          setTrail((p) => [...p.slice(-(TRAIL_MAX - 1)), [loc.lat, loc.lng]]);
          void loadFleet(true);
        },
      )
      .subscribe();
  }, [loadFleet]);

  const subscribeClient = useCallback((userId: string) => {
    clientChRef.current?.unsubscribe?.();
    if (!userId) return;
    clientChRef.current = supabase
      .channel(`dt-cli-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_locations', filter: `user_id=eq.${userId}` },
        ({ new: loc }: any) => {
          if (loc?.lat != null) setClientLoc(loc);
        },
      )
      .subscribe();
  }, []);

  useEffect(() => {
    void loadFleet();
  }, []);

  useEffect(() => {
    if (!selectedDriverId) {
      setDriverLoc(null);
      setTrail([]);
      setClientLoc(null);
      return;
    }
    void loadDriverDetail(selectedDriverId);
    subscribeDriver(selectedDriverId);
    return () => driverChRef.current?.unsubscribe?.();
  }, [selectedDriverId, loadDriverDetail, subscribeDriver]);

  useEffect(() => {
    if (!selectedOrder?.user_id) {
      setClientLoc(null);
      return;
    }
    void fetchClientLoc(selectedOrder.user_id);
    subscribeClient(selectedOrder.user_id);
    return () => clientChRef.current?.unsubscribe?.();
  }, [selectedOrder?.user_id, fetchClientLoc, subscribeClient]);

  useEffect(() => {
    if (orders.length && !selectedOrderId) setSelectedOrderId(orders[0].id);
    if (!orders.find((o) => o.id === selectedOrderId)) setSelectedOrderId(orders[0]?.id ?? '');
  }, [orders, selectedOrderId]);

  const fitterPos = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    if (driverLoc?.lat != null) pts.push({ lat: driverLoc.lat, lng: driverLoc.lng });
    if (clientLoc?.lat != null) pts.push({ lat: clientLoc.lat, lng: clientLoc.lng });
    return pts;
  }, [driverLoc, clientLoc]);

  const kpis = useMemo(() => {
    const online = fleet.filter((f) => f.isOnline).length;
    const offline = fleet.filter((f) => f.isStale).length;
    const overloaded = fleet.filter((f) => f.isOverloaded).length;
    const delayed = fleet.reduce((s, f) => s + f.delayedOrdersCount, 0);
    const totalOrders = fleet.reduce((s, f) => s + f.orders.length, 0);
    return { online, offline, overloaded, delayed, total: fleet.length, totalOrders };
  }, [fleet]);

  const alerts = useMemo(() => {
    const items: { type: 'warning' | 'error'; msg: string; driverId?: string }[] = [];
    fleet.forEach((f) => {
      if (f.isStale && f.lastSeenMinutes != null)
        items.push({
          type: 'warning',
          msg: `${mapName(f.driver)} hors ligne depuis ${f.lastSeenMinutes} min`,
          driverId: f.driver.id,
        });
      if (f.isOverloaded)
        items.push({
          type: 'warning',
          msg: `${mapName(f.driver)} surchargé (${f.orders.length} livraisons)`,
          driverId: f.driver.id,
        });
      if (f.delayedOrdersCount > 0)
        items.push({
          type: 'error',
          msg: `${mapName(f.driver)} : ${f.delayedOrdersCount} livraison(s) > 2h (SLA)`,
          driverId: f.driver.id,
        });
    });
    return items;
  }, [fleet]);

  if (loading) {
    return (
      <div className="delivery-command-center flex min-h-[400px] items-center justify-center">
        <Spin size="large" tip="Chargement du centre de pilotage..." />
      </div>
    );
  }

  return (
    <div className="delivery-command-center space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Delivery Operations Command Center"
          subtitle="Centre de pilotage logistique temps réel"
        />
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={() => void loadFleet(true)}
          loading={refreshing}
        >
          Actualiser
        </Button>
      </div>

      {pageError ? (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Données partielles"
          description={pageError}
        />
      ) : null}

      {fleet.length === 0 ? (
        <Card className="border-dashed">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                Aucun livreur enregistré. Les profils avec rôle <code>driver</code> apparaîtront ici.
              </span>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="delivery-kpi-card dashboard-card-glass">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                  <TeamOutlined style={{ fontSize: 20 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Flotte</div>
                  <div className="text-xl font-bold">{kpis.total}</div>
                  <div className="text-xs text-gray-500">livreurs</div>
                </div>
              </div>
            </Card>
            <Card className="delivery-kpi-card dashboard-card-glass">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                  <CheckCircleOutlined style={{ fontSize: 20 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">En ligne</div>
                  <div className="text-xl font-bold text-emerald-600">{kpis.online}</div>
                  <div className="text-xs text-gray-500">actifs</div>
                </div>
              </div>
            </Card>
            <Card className="delivery-kpi-card dashboard-card-glass">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                  <ClockCircleOutlined style={{ fontSize: 20 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Hors ligne</div>
                  <div className="text-xl font-bold text-amber-600">{kpis.offline}</div>
                  <div className="text-xs text-gray-500">&gt; {STALE_MINUTES} min</div>
                </div>
              </div>
            </Card>
            <Card className="delivery-kpi-card dashboard-card-glass">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                  <ThunderboltOutlined style={{ fontSize: 20 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Surchargés</div>
                  <div className="text-xl font-bold text-orange-600">{kpis.overloaded}</div>
                  <div className="text-xs text-gray-500">≥ {OVERLOAD_THRESHOLD} liv.</div>
                </div>
              </div>
            </Card>
            <Tooltip title="Livraisons en cours depuis plus de 2h (dépassement SLA)">
              <Card className="delivery-kpi-card dashboard-card-glass cursor-help">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                    <ExclamationCircleOutlined style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">En retard (SLA)</div>
                    <div className="text-xl font-bold text-red-600">{kpis.delayed}</div>
                    <div className="text-xs text-gray-500">&gt; 2h</div>
                  </div>
                </div>
              </Card>
            </Tooltip>
            <Card className="delivery-kpi-card dashboard-card-glass">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                  <CarOutlined style={{ fontSize: 20 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Livraisons</div>
                  <div className="text-xl font-bold">{kpis.totalOrders}</div>
                  <div className="text-xs text-gray-500">en cours</div>
                </div>
              </div>
            </Card>
          </div>

          {alerts.length > 0 && (
            <div className="delivery-alert-strip flex flex-wrap gap-2">
              {alerts.slice(0, 5).map((a, i) => (
                <Alert
                  key={i}
                  type={a.type}
                  showIcon
                  icon={<WarningOutlined />}
                  message={a.msg}
                  action={
                    a.driverId ? (
                      <Button
                        size="small"
                        type="link"
                        onClick={() => setSelectedDriverId(a.driverId!)}
                      >
                        Voir
                      </Button>
                    ) : undefined
                  }
                  className="flex-1 min-w-[200px]"
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
            <Card title="Livreurs" className="overflow-hidden">
              <div className="max-h-[480px] overflow-y-auto space-y-1 pr-1">
                {fleet.map((f) => (
                  <div
                    key={f.driver.id}
                    className={`delivery-driver-row cursor-pointer rounded-lg border p-3 ${
                      selectedDriverId === f.driver.id ? 'delivery-driver-row--selected' : ''
                    }`}
                    onClick={() => setSelectedDriverId(f.driver.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            f.isOnline ? 'delivery-status-dot bg-emerald-500' : 'delivery-status-dot--offline bg-gray-400'
                          }`}
                        />
                        <span className="font-medium truncate">{mapName(f.driver)}</span>
                      </div>
                      <Badge count={f.orders.length} size="small" />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Tag color={f.isOnline ? 'green' : f.isStale ? 'orange' : 'default'} className="text-xs">
                        {f.lastSeenMinutes != null ? `${f.lastSeenMinutes} min` : '—'}
                      </Tag>
                      {f.isOverloaded && <Tag color="orange">Surchargé</Tag>}
                      {f.delayedOrdersCount > 0 && (
                        <Tag color="red">SLA {f.delayedOrdersCount}</Tag>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-3">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <Space wrap>
                    <Tag color="blue" icon={<EnvironmentOutlined />}>
                      {selectedDriverState ? mapName(selectedDriverState.driver) : '—'}
                    </Tag>
                    {selectedOrder && (
                      <Tag color="purple">{selectedOrder.displayNum}</Tag>
                    )}
                    {clientLoc && <Tag color="green">Client localisé</Tag>}
                  </Space>
                  <Button
                    icon={isMapFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    size="small"
                    onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                  >
                    {isMapFullscreen ? 'Réduire' : 'Plein écran'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                  <Select
                    value={selectedDriverId || undefined}
                    placeholder="Livreur"
                    style={{ width: '100%' }}
                    options={fleet.map((f) => ({ value: f.driver.id, label: mapName(f.driver) }))}
                    onChange={(v) => setSelectedDriverId(v)}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Select
                    value={selectedOrderId || undefined}
                    placeholder="Commande"
                    style={{ width: '100%' }}
                    options={orders.map((o) => ({ value: o.id, label: `${o.displayNum} — ${o.displayName}` }))}
                    onChange={(v) => setSelectedOrderId(v)}
                    showSearch
                    optionFilterProp="label"
                    disabled={!orders.length}
                  />
                  {selectedOrderId && (
                    <Link href={`/orders?open=${encodeURIComponent(selectedOrderId)}`}>
                      <Button type="primary" icon={<EyeOutlined />} block>
                        Voir commande
                      </Button>
                    </Link>
                  )}
                  {selectedDriverState?.driver.phone && (
                    <a href={`tel:${selectedDriverState.driver.phone}`}>
                      <Button icon={<PhoneOutlined />} block>
                        Appeler
                      </Button>
                    </a>
                  )}
                </div>

                <div className="delivery-map-container" style={{ height: isMapFullscreen ? 'calc(100vh - 220px)' : 480 }}>
                  {driverLoc?.lat != null ? (
                    <ClientOnly>
                      <DeliveryTrackingMap
                        driverLoc={driverLoc}
                        clientLoc={clientLoc}
                        trail={trail}
                        fitterPos={fitterPos}
                        selectedDriver={selectedDriverState?.driver}
                        mapName={mapName}
                      />
                    </ClientOnly>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-900/50">
                      <div className="text-center p-6">
                        <EnvironmentOutlined className="text-4xl text-gray-400 mb-2" />
                        <div className="font-semibold text-gray-500">Aucune position reçue</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Le livreur doit envoyer sa position GPS via l&apos;app mobile.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
