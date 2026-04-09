'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useDashboardApi } from '@/lib/hooks/useDashboardApi';
import { supabase } from '@/lib/supabase/client';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  ShoppingCart, DollarSign, Users, TrendingUp, Package, AlertTriangle,
  RefreshCw, ExternalLink, Truck, Zap, X, BarChart3, Globe2, Clock, Bell, PlusCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

type AlertItem = { id: string; type: 'warning' | 'error' | 'info'; message: string; link?: string };
type BehaviorEvent = {
  id: string;
  user_id: string | null;
  product_id: string | null;
  action: string | null;
  source: string | null;
  created_at: string;
};

async function fetchDashboardAlerts(): Promise<AlertItem[]> {
  const alerts: AlertItem[] = [];
  const r = await fetch('/api/dashboard/alerts', { credentials: 'include' });
  if (!r.ok) return alerts;
  const j = (await r.json()) as {
    pending_stale_count?: number;
    chat_unread_conversations?: number;
  };
  if ((j.pending_stale_count ?? 0) > 0) {
    alerts.push({
      id: 'pending',
      type: 'warning',
      message: `${j.pending_stale_count} commande(s) en attente depuis +2h`,
      link: '/orders',
    });
  }
  if ((j.chat_unread_conversations ?? 0) > 0) {
    alerts.push({
      id: 'msg',
      type: 'info',
      message: `${j.chat_unread_conversations} conversation(s) avec messages non lus`,
      link: '/messages',
    });
  }
  return alerts;
}

async function fetchLiveStats() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [driverRes, onlineRes, todayOrdersRes] = await Promise.all([
    supabase.from('driver_locations').select('driver_id', { count: 'exact', head: true }).gte('captured_at', tenMinAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
  ]);
  return {
    activeDrivers: driverRes.count ?? 0,
    onlineUsers: onlineRes.count ?? 0,
    todayOrders: todayOrdersRes.count ?? 0,
  };
}

async function fetchBehaviorInsights(): Promise<{
  user_behavior_last_7d_count: number;
  user_behavior_sample: BehaviorEvent[];
}> {
  const r = await fetch('/api/security/behavior-insights', { credentials: 'include' });
  if (!r.ok) return { user_behavior_last_7d_count: 0, user_behavior_sample: [] };
  const j = (await r.json()) as {
    data?: { user_behavior_last_7d_count?: number; user_behavior_sample?: BehaviorEvent[] };
  };
  return {
    user_behavior_last_7d_count: j.data?.user_behavior_last_7d_count ?? 0,
    user_behavior_sample: j.data?.user_behavior_sample ?? [],
  };
}

const FUNNEL_COLORS = ['#6366F1', '#8B5CF6', '#F59E0B', '#10B981'];
const BAR_COL = '#6366F1';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  try {
    return format(new Date(iso), 'dd MMM HH:mm', { locale: fr });
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [chartDays, setChartDays] = useState<7 | 30>(7);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const { data, isLoading, error, refetch, isFetching, isError } = useDashboardApi(chartDays);

  useEffect(() => {
    if (isError && error) toast.error((error as Error).message);
  }, [isError, error]);

  const alertsQuery = useQuery({
    queryKey: ['dash-alerts'],
    queryFn: fetchDashboardAlerts,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const liveQuery = useQuery({ queryKey: ['dash-live'], queryFn: fetchLiveStats, staleTime: 15_000, refetchInterval: 20_000 });
  const behaviorQuery = useQuery({
    queryKey: ['dash-behavior-insights'],
    queryFn: fetchBehaviorInsights,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const apiAlerts = data?.alerts;
  const mergedAlerts: AlertItem[] = [
    ...(alertsQuery.data || []),
    ...(apiAlerts?.criticalStockCount
      ? [
          {
            id: 'stock-crit',
            type: 'error' as const,
            message: `${apiAlerts.criticalStockCount} produit(s) sous le seuil de stock (<5)`,
            link: '/inventory',
          },
        ]
      : []),
    ...(apiAlerts?.pendingOver2h
      ? [{ id: 'pend-api', type: 'warning' as const, message: `${apiAlerts.pendingOver2h} commande(s) pending >2h`, link: '/orders' }]
      : []),
    ...(apiAlerts?.oneStarReviews
      ? [{ id: 'rev1', type: 'warning' as const, message: `${apiAlerts.oneStarReviews} avis 1★ à modérer`, link: '/reviews' }]
      : []),
  ];
  const visibleAlerts = mergedAlerts.filter((a) => !dismissedAlerts.includes(a.id));

  const live = liveQuery.data;
  const kt = data?.kpisToday;
  const funnelData = (data?.funnel || []).map((step, i) => ({ ...step, fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tableau de bord"
        subtitle="KPIs et tendances (données serveur + actualisation 10s)"
        actions={
          <>
            <Tabs value={String(chartDays)} onValueChange={(v) => setChartDays(Number(v) as 7 | 30)}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs px-3 h-7">
                  7 jours
                </TabsTrigger>
                <TabsTrigger value="30" className="text-xs px-3 h-7">
                  30 jours
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => router.push('/products')}>
          <PlusCircle className="h-3.5 w-3.5 mr-1" /> Produit
        </Button>
        <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => router.push('/notifications')}>
          <Bell className="h-3.5 w-3.5 mr-1" /> Notification push
        </Button>
        <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => router.push('/orders')}>
          <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Commandes
        </Button>
      </div>

      {visibleAlerts.length > 0 && (
        <div className="space-y-1.5">
          {visibleAlerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                a.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : a.type === 'warning'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-xs font-medium">{a.message}</span>
              {a.link && (
                <button type="button" onClick={() => router.push(a.link!)} className="text-xs underline font-semibold shrink-0">
                  Voir
                </button>
              )}
              <button type="button" onClick={() => setDismissedAlerts((p) => [...p, a.id])} className="shrink-0 opacity-60 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-600">Live</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            <strong className="text-foreground">{live?.activeDrivers ?? '—'}</strong> livreurs actifs
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <strong className="text-foreground">{live?.onlineUsers ?? '—'}</strong> en ligne
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <strong className="text-foreground">{live?.todayOrders ?? '—'}</strong>
            <span>commandes aujourd&apos;hui</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Commandes aujourd'hui"
          value={kt?.orders ?? 0}
          icon={<ShoppingCart className="h-5 w-5" />}
          iconBg="rgba(99,102,241,0.12)"
          iconColor="#6366F1"
          loading={isLoading}
        />
        <KpiCard
          label="CA aujourd'hui"
          value={kt ? fmtCurrency(kt.revenue) : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          iconBg="rgba(16,185,129,0.12)"
          iconColor="#10B981"
          loading={isLoading}
        />
        <KpiCard
          label="Nouveaux utilisateurs"
          value={kt?.newUsers ?? 0}
          icon={<Users className="h-5 w-5" />}
          iconBg="rgba(59,130,246,0.12)"
          iconColor="#3B82F6"
          loading={isLoading}
        />
        <KpiCard
          label="Panier moyen (jour)"
          value={kt ? fmtCurrency(kt.avgBasket) : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="rgba(245,158,11,0.12)"
          iconColor="#F59E0B"
          loading={isLoading}
        />
      </div>

      {data?.windowSummary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
          <Card className="p-3">
            <div className="font-medium text-foreground">{data.chartDays} jours</div>
            <div>{data.windowSummary.orders} commandes · {fmtCurrency(data.windowSummary.revenue)} CA</div>
            {data.windowMeta?.start ? (
              <div className="mt-1 text-[10px]">
                Fenetre: {fmtDate(data.windowMeta.start)} a {fmtDate(data.windowMeta.end)}
              </div>
            ) : null}
          </Card>
          <Card className="p-3">
            <div className="font-medium text-foreground">Commerce (echantillon)</div>
            <div>LTV moy. ~{fmtCurrency(data.bigData.avgLtv)} · Réachat {Math.round(data.bigData.repeatPurchaseRate * 100)}%</div>
            <div className="mt-1 text-[10px]">{data.bigData.cohortNote}</div>
          </Card>
          <Card className="p-3">
            <div className="font-medium text-foreground">Stock critique (aperçu)</div>
            <div className="truncate">
              {(data.alerts.criticalStockSample || [])
                .slice(0, 3)
                .map((p: { name?: string }) => p.name)
                .filter(Boolean)
                .join(', ') || '—'}
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Chiffre d&apos;affaires ({data?.chartDays ?? '—'} j)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.revenueSeries || []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--border)" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="var(--border)"
                    width={48}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v != null ? fmtCurrency(Number(v)) : '—', 'CA']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Commandes par statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.ordersByStatus || []} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="statusLabel" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} stroke="var(--border)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--border)" width={32} />
                  <RechartsTooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(data?.ordersByStatus || []).map((_, i) => (
                      <Cell key={i} fill={BAR_COL} opacity={0.75 + (i % 3) * 0.08} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evenements (user_behavior)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">
              7 derniers jours: <span className="font-semibold text-foreground">{behaviorQuery.data?.user_behavior_last_7d_count ?? 0}</span>
            </div>
            <ul className="divide-y divide-border max-h-64 overflow-y-auto">
              {(behaviorQuery.data?.user_behavior_sample ?? []).map((ev) => (
                <li key={ev.id} className="py-2 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{ev.action || 'event'}</div>
                    <div className="text-muted-foreground truncate">{ev.source || 'app'} · {fmtDate(ev.created_at)}</div>
                  </div>
                  {ev.product_id ? (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => router.push(`/products?product=${ev.product_id}`)}>
                      Ouvrir produit
                    </Button>
                  ) : null}
                </li>
              ))}
              {(behaviorQuery.data?.user_behavior_sample ?? []).length === 0 && (
                <li className="py-8 text-center text-xs text-muted-foreground">Aucune entree (migration ou tracking app requis).</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 produits (90j) — Ouverture rapide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(data?.topProducts ?? []).map((p) => (
              <button
                type="button"
                key={`${p.name}-${p.id ?? 'na'}`}
                className="w-full text-left rounded-md border border-border px-2.5 py-2 hover:bg-muted/60 transition text-xs flex items-center justify-between"
                onClick={() => (p.id ? router.push(`/products?product=${p.id}`) : undefined)}
                disabled={!p.id}
              >
                <span className="truncate">{p.fullName || p.name}</span>
                <span className="font-semibold tabular-nums">{p.sales}</span>
              </button>
            ))}
            {(data?.topProducts ?? []).length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">Pas de données</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" /> Heures de commande (volume)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.orderHourHeatmap || []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} stroke="var(--border)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--border)" width={32} />
                  <RechartsTooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe2 className="h-4 w-4" /> Ventes par pays (livraison)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={data?.geoSales || []}
                  margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--border)" />
                  <YAxis type="category" dataKey="country" width={72} tick={{ fontSize: 10 }} stroke="var(--border)" />
                  <RechartsTooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="orders" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 produits (90j)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.topProducts?.length ?? 0) === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Pas de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.topProducts || []} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--border)" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} stroke="var(--border)" />
                  <RechartsTooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="sales" fill={BAR_COL} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Entonnoir (période)</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 || isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="flex items-end gap-2 h-24">
                {funnelData.map((step) => {
                  const maxVal = funnelData[0]?.value || 1;
                  const pct = maxVal > 0 ? Math.round((step.value / maxVal) * 100) : 0;
                  return (
                    <div key={step.name} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-bold tabular-nums" style={{ color: step.fill }}>
                        {step.value}
                      </span>
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: Math.max(8, (step.value / maxVal) * 56),
                          background: step.fill,
                          opacity: 0.85,
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{step.name}</span>
                      <span className="text-[9px] text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activité — commandes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {(data?.activity.recentOrders || []).map((order: any) => (
                  <li key={order.id} className="px-4 py-2 flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground truncate">#{order.order_number || order.id?.slice(0, 8)}</div>
                      <div className="truncate text-xs">{order.customer_name || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={order.status || 'pending'} size="sm" />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => router.push(`/orders?id=${order.id}`)}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
                {(data?.activity.recentOrders || []).length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune commande</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activité — inscriptions (jour)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {(data?.activity.newSignups || []).map((p: any) => (
                  <li key={p.id} className="px-4 py-2 text-sm">
                    <div className="font-medium truncate">
                      {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    <div className="text-[10px] text-muted-foreground">{p.created_at ? fmtDate(p.created_at) : ''}</div>
                  </li>
                ))}
                {(data?.activity.newSignups || []).length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune inscription aujourd&apos;hui</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
