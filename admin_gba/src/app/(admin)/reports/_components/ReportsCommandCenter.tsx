'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { ChartWrapper } from '@/components/shared/ChartWrapper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const COLORS = ['#6C47FF', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

type OverviewPayload = {
  kpis: {
    revenue_today: number;
    revenue_month: number;
    revenue_year: number;
    orders_today: number;
    orders_pending: number;
    orders_in_progress: number;
    new_users_today: number;
    active_users_30d: number;
  };
  charts: {
    revenue_and_orders_30d: { day: string; revenue: number; orders: number }[];
    active_users_by_day_30d: { day: string; active: number }[];
    revenue_by_category: { category: string; revenue: number }[];
    signups_retention_hint: { day: string; signups: number }[];
  };
  live: {
    recent_orders: Record<string, unknown>[];
    recent_unread_messages: Record<string, unknown>[];
    alerts: { id: string; label: string; severity: string; count: number }[];
    drivers_online: number;
  };
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

async function fetchOverview(): Promise<OverviewPayload> {
  const r = await fetch('/api/reports/overview', { credentials: 'include' });
  const j = (await r.json()) as { data?: OverviewPayload; error?: string };
  if (!r.ok) throw new Error(j.error || 'Overview');
  return j.data as OverviewPayload;
}

async function fetchType(type: string) {
  const r = await fetch(`/api/reports/${type}`, { credentials: 'include' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || type);
  return j;
}

function OrdersHeat({ matrix, max }: { matrix: number[][]; max: number }) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `auto repeat(24, minmax(10px,1fr))` }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[8px] text-center text-muted-foreground">
            {h}
          </div>
        ))}
        {matrix.map((row, di) => (
          <React.Fragment key={di}>
            <div className="pr-1 text-[10px] text-muted-foreground">{days[di]}</div>
            {row.map((v, hi) => {
              const i = Math.min(1, v / max);
              return (
                <div
                  key={hi}
                  className="h-3 w-full rounded-sm"
                  style={{ background: `color-mix(in srgb, var(--primary) ${Math.round(i * 100)}%, transparent)` }}
                  title={`${v} cmd`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function ReportsCommandCenter() {
  const [tab, setTab] = React.useState('overview');

  const overviewQ = useQuery({
    queryKey: ['reports-overview'],
    queryFn: fetchOverview,
    staleTime: 120_000,
  });

  const ordersQ = useQuery({
    queryKey: ['reports-type', 'orders'],
    queryFn: () => fetchType('orders'),
    enabled: tab === 'orders',
  });

  const usersQ = useQuery({
    queryKey: ['reports-type', 'users'],
    queryFn: () => fetchType('users'),
    enabled: tab === 'users',
  });

  const messagesQ = useQuery({
    queryKey: ['reports-type', 'messages'],
    queryFn: () => fetchType('messages'),
    enabled: tab === 'messages',
  });

  const o = overviewQ.data;

  const treemapData = React.useMemo(
    () =>
      (o?.charts.revenue_by_category || []).map((x) => ({
        name: x.category,
        size: Math.max(0, x.revenue),
      })),
    [o],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centrale de données"
        subtitle="Vue d’ensemble, analyses filtrées, exports — cache serveur 5 min (overview)"
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line" className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="gap-1">
            <LayoutDashboard className="size-3.5" /> Vue d’ensemble
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1">
            <ShoppingCart className="size-3.5" /> Commandes
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1">
            <Users className="size-3.5" /> Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1">
            <Package className="size-3.5" /> Produits
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1">
            <Truck className="size-3.5" /> Livreurs
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1">
            <MessageSquare className="size-3.5" /> Messages
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-1">
            <FileSpreadsheet className="size-3.5" /> Générer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {overviewQ.isLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : overviewQ.isError ? (
            <p className="text-sm text-destructive">{(overviewQ.error as Error).message}</p>
          ) : o ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="CA aujourd’hui" value={fmtMoney(o.kpis.revenue_today)} icon={<CreditCard className="size-5" />} />
                <KpiCard label="CA ce mois" value={fmtMoney(o.kpis.revenue_month)} icon={<TrendingUp className="size-5" />} />
                <KpiCard label="CA cette année" value={fmtMoney(o.kpis.revenue_year)} icon={<TrendingUp className="size-5" />} />
                <KpiCard label="Commandes aujourd’hui" value={o.kpis.orders_today} icon={<ShoppingCart className="size-5" />} />
                <KpiCard label="En attente" value={o.kpis.orders_pending} icon={<ShoppingCart className="size-5" />} />
                <KpiCard label="En cours" value={o.kpis.orders_in_progress} icon={<ShoppingCart className="size-5" />} />
                <KpiCard label="Nouveaux users (jour)" value={o.kpis.new_users_today} icon={<Users className="size-5" />} />
                <KpiCard label="Actifs 30j (acheteurs)" value={o.kpis.active_users_30d} icon={<Users className="size-5" />} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartWrapper title="CA + commandes (30j)" className="min-h-[280px]">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={o.charts.revenue_and_orders_30d}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="right" dataKey="orders" fill="var(--color-chart-2)" name="Commandes" />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--color-primary)"
                        name="CA"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartWrapper>
                <ChartWrapper title="Utilisateurs actifs par jour (30j)" className="min-h-[280px]">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={o.charts.active_users_by_day_30d}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="active" fill="var(--color-chart-3)" name="Actifs" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrapper>
                <ChartWrapper title="Revenus par ligne produit (top)" className="min-h-[280px]">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart layout="vertical" data={[...(o.charts.revenue_by_category || [])].slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v) => (typeof v === 'number' ? fmtMoney(v) : String(v))} />
                      <Bar dataKey="revenue" fill="var(--color-brand)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrapper>
                <ChartWrapper title="Treemap CA (produits agrégés)" className="min-h-[280px]">
                  <ResponsiveContainer width="100%" height={260}>
                    <Treemap
                      data={treemapData}
                      dataKey="size"
                      aspectRatio={4 / 3}
                      stroke="var(--border)"
                      fill="var(--color-chart-1)"
                    />
                  </ResponsiveContainer>
                </ChartWrapper>
              </div>

              <ChartWrapper title="Nouveaux inscrits / jour (30j)" className="min-h-[240px]">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={o.charts.signups_retention_hint}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="signups" stroke="var(--color-chart-4)" dot={false} name="Inscriptions" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Dernières commandes</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[220px] space-y-2 overflow-y-auto text-xs">
                    {o.live.recent_orders.map((row) => (
                      <div key={String(row.id)} className="flex justify-between gap-2 border-b border-border pb-1">
                        <span className="truncate">{String(row.order_number || row.id).slice(0, 14)}</span>
                        <span className="text-muted-foreground">{String(row.status)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bell className="size-3.5" /> Messages non lus (aperçu)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[220px] space-y-2 overflow-y-auto text-xs">
                    {o.live.recent_unread_messages.length === 0 ? (
                      <p className="text-muted-foreground">Aucun</p>
                    ) : (
                      o.live.recent_unread_messages.map((row) => (
                        <div key={String(row.id)} className="truncate border-b border-border pb-1">
                          {String(row.message || row.id).slice(0, 80)}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Alertes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    {o.live.alerts.map((a) => (
                      <div key={a.id} className="flex justify-between">
                        <span>{a.label}</span>
                        <span className="font-medium">{a.count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Livreurs (échantillon positions)</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Points distincts récents :{' '}
                    <span className="font-semibold text-foreground">{o.live.drivers_online}</span>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {ordersQ.isLoading ? <Skeleton className="h-64 w-full" /> : null}
          {ordersQ.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <KpiCard label="Total" value={ordersQ.data.kpis?.count ?? 0} icon={<ShoppingCart className="size-5" />} />
                <KpiCard label="CA période" value={fmtMoney(ordersQ.data.kpis?.revenue ?? 0)} icon={<CreditCard className="size-5" />} />
                <KpiCard label="Panier moyen" value={fmtMoney(ordersQ.data.kpis?.avg_basket ?? 0)} icon={<TrendingUp className="size-5" />} />
                <KpiCard
                  label="Taux annulation (approx.)"
                  value={`${Math.round((ordersQ.data.kpis?.cancel_rate ?? 0) * 100)}%`}
                  icon={<ShoppingCart className="size-5" />}
                />
              </div>
              <ChartWrapper title="Heatmap commandes (jour × heure)" className="min-h-[200px]">
                <OrdersHeat matrix={ordersQ.data.charts?.heatmap?.matrix} max={ordersQ.data.charts?.heatmap?.max || 1} />
              </ChartWrapper>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartWrapper title="Méthodes de paiement" className="min-h-[220px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={ordersQ.data.charts?.payment_donut || []}
                        dataKey="count"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label
                      >
                        {(ordersQ.data.charts?.payment_donut || []).map((_: unknown, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartWrapper>
                <ChartWrapper title="Commandes par statut" className="min-h-[220px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ordersQ.data.charts?.by_status || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="status" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="var(--color-brand)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrapper>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {usersQ.isLoading ? <Skeleton className="h-64 w-full" /> : null}
          {usersQ.data ? (
            <ChartWrapper title="Répartition par rôle" className="min-h-[240px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={usersQ.data.charts?.by_role_top || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="role" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-chart-3)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          ) : null}
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <ProductsTab active={tab === 'products'} />
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          <DriversTab active={tab === 'drivers'} />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          {messagesQ.isLoading ? <Skeleton className="h-64 w-full" /> : null}
          {messagesQ.data ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <KpiCard
                label="Messages non lus"
                value={messagesQ.data.kpis?.unread_pending ?? 0}
                icon={<MessageSquare className="size-5" />}
              />
              <ChartWrapper title="Volume / jour" className="min-h-[220px]">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={messagesQ.data.charts?.volume_by_day || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="var(--color-primary)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>
              <ChartWrapper title="Par type" className="min-h-[220px] lg:col-span-2">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={messagesQ.data.charts?.by_type || []}
                      dataKey="count"
                      nameKey="message_type"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label
                    >
                      {(messagesQ.data.charts?.by_type || []).map((_: unknown, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Exports rapides</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <a href="/api/users/export" download className={cn(buttonVariants({ size: 'sm' }))}>
                CSV utilisateurs
              </a>
              <a href="/api/orders/export" download className={cn(buttonVariants({ size: 'sm' }))}>
                CSV commandes
              </a>
              <Link href="/audit" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Journal d’audit
              </Link>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Rapports PDF planifiés (bibliothèque @react-pdf/renderer) : branchement possible sur les mêmes agrégations
            que cette centrale.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductsTab({ active }: { active: boolean }) {
  const q = useQuery({
    queryKey: ['reports-type', 'products'],
    queryFn: () => fetchType('products'),
    enabled: active,
  });
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = (q.data?.rows || []) as { id: string; name?: string; quantity?: number; price?: number }[];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Produits ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[360px] overflow-auto text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-2">Nom</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Prix</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 80).map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.quantity ?? '—'}</td>
                <td className="p-2">{p.price != null ? fmtMoney(Number(p.price)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function DriversTab({ active }: { active: boolean }) {
  const q = useQuery({
    queryKey: ['reports-type', 'drivers'],
    queryFn: () => fetchType('drivers'),
    enabled: active,
  });
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = (q.data?.rows || []) as {
    id: string;
    vehicle_type?: string;
    is_online?: boolean;
    total_deliveries?: number;
  }[];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Livreurs ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[360px] overflow-auto text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-2">Véhicule</th>
              <th className="p-2">En ligne</th>
              <th className="p-2">Livraisons</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-border/60">
                <td className="p-2">{d.vehicle_type || '—'}</td>
                <td className="p-2">{d.is_online ? 'oui' : 'non'}</td>
                <td className="p-2">{d.total_deliveries ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
