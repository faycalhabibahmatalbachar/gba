'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
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
  MenuOutlined,
  MenuFoldOutlined,
  ShoppingCartOutlined,
  RiseOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  fetchAllDriversWithState,
  fetchDriverLocation,
  fetchDriverTrail,
  fetchClientLocation,
  type DriverWithState,
  type DriverProfile,
  type DriverLocation,
  type ActiveOrder,
} from '@/lib/services/delivery-tracking';
import PageHeader from '@/components/ui/PageHeader';
import { useThemeMode } from '@/components/layout/ThemeProvider';
import { formatDuration } from '@/lib/i18n/translations';
// TODO: Créer ces composants extraits
// import FleetMetrics from './FleetMetrics';
// import AlertsPanel from './AlertsPanel';
// import DriverCard from './DriverCard';
// import OrderDetailsDrawer from './OrderDetailsDrawer';

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
  const [sidebarVisible, setSidebarVisible] = useState(true);

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
    try {
      const loc = await fetchClientLocation(userId);
      setClientLoc(loc);
    } catch (e) {
      console.error('Error fetching client location:', e);
      setClientLoc(null);
    }
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
        { event: 'INSERT', schema: 'public', table: 'driver_location_history', filter: `driver_id=eq.${driverId}` },
        ({ new: loc }: any) => {
          if (loc?.latitude == null) return;
          setDriverLoc(loc);
          setTrail((p) => [...p.slice(-(TRAIL_MAX - 1)), [loc.latitude, loc.longitude]]);
          void loadFleet(true);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_location_history', filter: `driver_id=eq.${driverId}` },
        ({ new: loc }: any) => {
          if (loc?.latitude == null) return;
          setDriverLoc(loc);
          setTrail((p) => [...p.slice(-(TRAIL_MAX - 1)), [loc.latitude, loc.longitude]]);
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
        { event: '*', schema: 'public', table: 'user_location_history', filter: `user_id=eq.${userId}` },
        ({ new: loc }: any) => {
          if (loc?.latitude != null) setClientLoc(loc);
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
    const pts: { latitude: number; longitude: number }[] = [];
    if (driverLoc?.latitude != null) pts.push({ latitude: driverLoc.latitude, longitude: driverLoc.longitude });
    if (clientLoc?.latitude != null) pts.push({ latitude: clientLoc.latitude, longitude: clientLoc.longitude });
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

  // Alertes désactivées - supprimées à la demande de l'utilisateur
  // const alerts = useMemo(() => {
  //   const items: { type: 'warning' | 'error'; msg: string; driverId?: string }[] = [];
  //   return items;
  // }, [fleet]);

  if (loading) {
    return (
      <div className="delivery-command-center flex min-h-[400px] items-center justify-center">
        <Spin size="large" description="Chargement du centre de pilotage..." />
      </div>
    );
  }

  return (
    <div className="delivery-command-center space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Centre d'opérations de livraison"
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
          title="Données partielles"
          description={pageError}
        />
      ) : null}

      {/* Section KPIs - Ops Center Style */}
      {fleet.length > 0 && (
        <Row gutter={[16, 16]}>
          {/* Livreurs en ligne */}
          <Col xs={24} sm={12} lg={6}>
            <div className="ops-kpi-card success">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="kpi-label mb-2">LIVREURS EN LIGNE</div>
                  <div className="kpi-value mb-1">
                    {kpis.online}<span style={{ fontSize: '18px', opacity: 0.6 }}>/{kpis.total}</span>
                  </div>
                  <div className="kpi-sublabel">Actifs maintenant</div>
                </div>
                <TeamOutlined className="ops-kpi-icon success" />
              </div>
            </div>
          </Col>

          {/* Commandes actives */}
          <Col xs={24} sm={12} lg={6}>
            <div className="ops-kpi-card accent">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="kpi-label mb-2">COMMANDES ACTIVES</div>
                  <div className="kpi-value mb-1">{kpis.totalOrders}</div>
                  <div className="kpi-sublabel">En cours de livraison</div>
                </div>
                <ShoppingCartOutlined className="ops-kpi-icon accent" />
              </div>
            </div>
          </Col>

          {/* Livraisons en retard */}
          <Col xs={24} sm={12} lg={6}>
            <div className="ops-kpi-card warning">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="kpi-label mb-2">EN RETARD</div>
                  <div className="kpi-value mb-1">{kpis.delayed}</div>
                  <div className="kpi-sublabel">
                    {kpis.delayed > 0 ? 'Livraisons > 2h' : 'Tout est à jour'}
                  </div>
                </div>
                <ClockCircleOutlined className="ops-kpi-icon warning" />
              </div>
            </div>
          </Col>

          {/* Livreurs surchargés */}
          <Col xs={24} sm={12} lg={6}>
            <div className="ops-kpi-card danger">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="kpi-label mb-2">SURCHARGÉS</div>
                  <div className="kpi-value mb-1">{kpis.overloaded}</div>
                  <div className="kpi-sublabel">
                    {kpis.overloaded > 0 ? 'Livreurs > 5 commandes' : 'Charge équilibrée'}
                  </div>
                </div>
                <WarningOutlined className="ops-kpi-icon danger" />
              </div>
            </div>
          </Col>
        </Row>
      )}

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
          {/* Alertes supprimées - section désactivée */}

          <div className={`grid grid-cols-1 gap-4 ${sidebarVisible ? 'lg:grid-cols-[340px_1fr]' : 'lg:grid-cols-1'}`}>
            {sidebarVisible && (
            <Card
              title={
                <div className="flex items-center gap-2">
                  <TeamOutlined className="text-lg" />
                  <span className="font-semibold">Livreurs actifs</span>
                  <Badge count={fleet.length} showZero style={{ backgroundColor: '#52c41a' }} />
                </div>
              }
              className="glass-card overflow-hidden border-0 shadow-md"
              extra={
                <Button
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined />}
                  onClick={() => setSidebarVisible(false)}
                  title="Masquer la liste"
                  className="hover:bg-slate-100 dark:hover:bg-slate-700"
                />
              }
            >
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto space-y-2 pr-1">
                {fleet.map((f) => {
                  const initials = mapName(f.driver).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const loadPercent = Math.min((f.orders.length / OVERLOAD_THRESHOLD) * 100, 100);
                  const isSelected = selectedDriverId === f.driver.id;
                  
                  return (
                    <div
                      key={f.driver.id}
                      className={`driver-card cursor-pointer ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedDriverId(f.driver.id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar avec badge de statut */}
                        <div className="relative shrink-0">
                          <Avatar 
                            size={48} 
                            className={`font-semibold ${
                              f.isOnline 
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' 
                                : 'bg-gradient-to-br from-slate-400 to-slate-500'
                            }`}
                          >
                            {initials}
                          </Avatar>
                          <span 
                            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${
                              f.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            }`}
                          />
                        </div>

                        {/* Informations livreur */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-sm truncate text-slate-800 dark:text-slate-100">
                              {mapName(f.driver)}
                            </span>
                            <Badge 
                              count={f.orders.length} 
                              showZero 
                              style={{ 
                                backgroundColor: f.isOverloaded ? '#ff4d4f' : f.orders.length > 0 ? '#1890ff' : '#d9d9d9' 
                              }} 
                            />
                          </div>
                          
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            {f.isOnline ? (
                              <span className="flex items-center gap-1">
                                <CheckCircleOutlined className="text-emerald-500" />
                                Actif {f.lastSeenMinutes != null ? `il y a ${f.lastSeenMinutes} min` : 'maintenant'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <ClockCircleOutlined className="text-slate-400" />
                                Hors ligne {f.lastSeenMinutes != null ? `depuis ${formatDuration(f.lastSeenMinutes)}` : ''}
                              </span>
                            )}
                          </div>

                          {/* Barre de progression de charge */}
                          {f.orders.length > 0 && (
                            <div className="space-y-1">
                              <Progress 
                                percent={Math.round(loadPercent)} 
                                size="small"
                                strokeColor={
                                  f.isOverloaded 
                                    ? { from: '#ff4d4f', to: '#ff7875' }
                                    : loadPercent > 60
                                    ? { from: '#faad14', to: '#ffc53d' }
                                    : { from: '#52c41a', to: '#73d13d' }
                                }
                                showInfo={false}
                                className="mb-0"
                              />
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {f.orders.length} commande{f.orders.length > 1 ? 's' : ''}
                                </span>
                                {f.delayedOrdersCount > 0 && (
                                  <span className="text-red-500 font-medium flex items-center gap-1">
                                    <ClockCircleOutlined />
                                    {f.delayedOrdersCount} en retard
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            )}

            <div className="space-y-3">
              <Card className="ops-card-surface" variant="borderless">
                {/* Barre de sélection - Ops Center Style */}
                <div className="ops-selection-bar flex flex-wrap items-center justify-between gap-3 mb-4">
                  <Space wrap size="small">
                    {!sidebarVisible && (
                      <Button
                        type="text"
                        size="small"
                        icon={<MenuOutlined />}
                        onClick={() => setSidebarVisible(true)}
                        title="Afficher la liste des livreurs"
                      />
                    )}
                    {selectedDriverState && (
                      <span className="ops-tag">
                        <UserOutlined />
                        {mapName(selectedDriverState.driver)}
                      </span>
                    )}
                    {selectedOrder && (
                      <span className="ops-tag purple">
                        <ShoppingCartOutlined />
                        {selectedOrder.displayNum}
                      </span>
                    )}
                    {clientLoc && (
                      <span className="ops-tag success">
                        <EnvironmentOutlined />
                        Client localisé
                      </span>
                    )}
                  </Space>
                  <Button
                    icon={isMapFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    size="middle"
                    onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                    type="text"
                  >
                    {isMapFullscreen ? 'Réduire' : 'Plein écran'}
                  </Button>
                </div>

                {/* Panel Info Livreur - Ops Center Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <Select
                    className="ops-select"
                    value={selectedDriverId || undefined}
                    placeholder="Livreur"
                    style={{ width: '100%' }}
                    options={fleet.map((f) => ({ value: f.driver.id, label: mapName(f.driver) }))}
                    onChange={(v) => setSelectedDriverId(v)}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Select
                    className="ops-select"
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
                      <Button className="ops-btn-primary" icon={<EyeOutlined />} block>
                        Voir commande
                      </Button>
                    </Link>
                  )}
                  {selectedDriverState?.driver.phone && (
                    <a href={`tel:${selectedDriverState.driver.phone}`}>
                      <Button className="ops-btn-secondary" icon={<PhoneOutlined />} block>
                        Appeler
                      </Button>
                    </a>
                  )}
                </div>

                {isMapFullscreen ? (
                  <div
                    className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-gray-900"
                    style={{ top: 0, left: 0, right: 0, bottom: 0 }}
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                      <Space>
                        <Tag color="blue" icon={<EnvironmentOutlined />}>
                          {selectedDriverState ? mapName(selectedDriverState.driver) : '—'}
                        </Tag>
                        {selectedOrder && <Tag color="purple">{selectedOrder.displayNum}</Tag>}
                        {clientLoc && <Tag color="green">Client localisé</Tag>}
                      </Space>
                      <Button
                        icon={<FullscreenExitOutlined />}
                        onClick={() => setIsMapFullscreen(false)}
                      >
                        Quitter le plein écran
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0" style={{ height: 'calc(100vh - 56px)' }}>
                      {driverLoc?.latitude != null ? (
                        <ClientOnly>
                          <div className="w-full h-full" style={{ height: 'calc(100vh - 56px)' }}>
                            <DeliveryTrackingMap
                              driverLoc={driverLoc}
                              clientLoc={clientLoc}
                              trail={trail}
                              fitterPos={fitterPos}
                              selectedDriver={selectedDriverState?.driver}
                              selectedOrder={selectedOrder}
                              orders={orders}
                              mapName={mapName}
                            />
                          </div>
                        </ClientOnly>
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900/50">
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
                  </div>
                ) : (
                  <div className="ops-map-wrapper" style={{ height: 480 }}>
                    {driverLoc?.latitude != null ? (
                      <ClientOnly>
                        <DeliveryTrackingMap
                          driverLoc={driverLoc}
                          clientLoc={clientLoc}
                          trail={trail}
                          fitterPos={fitterPos}
                          selectedDriver={selectedDriverState?.driver}
                          selectedOrder={selectedOrder}
                          orders={orders}
                          mapName={mapName}
                        />
                      </ClientOnly>
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900/50">
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
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
