'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard, type PeriodKey } from '@/lib/hooks/useDashboard';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, TrendingUp, Clock, CheckCircle2,
  XCircle, DollarSign, Package, AlertTriangle,
  RefreshCw, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
];

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM HH:mm', { locale: fr }); }
  catch { return iso; }
}

export default function DashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>('7d');
  const { data, isLoading, refetch, isFetching } = useDashboard(period);

  const kpis = data?.kpis;
  const trends = data?.trends;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble en temps réel"
        actions={
          <>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <TabsList className="h-8">
                {PERIODS.map(p => (
                  <TabsTrigger key={p.key} value={p.key} className="text-xs px-3 h-7">{p.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        <KpiCard
          label="Commandes totales"
          value={kpis?.totalOrders ?? 0}
          icon={<ShoppingCart className="h-5 w-5" />}
          iconBg="rgba(99,102,241,0.12)"
          iconColor="#6366F1"
          trend={trends?.orders}
          loading={isLoading}
        />
        <KpiCard
          label="Chiffre d'affaires"
          value={kpis ? fmtCurrency(kpis.revenue) : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          iconBg="rgba(16,185,129,0.12)"
          iconColor="#10B981"
          trend={trends?.revenue}
          loading={isLoading}
        />
        <KpiCard
          label="En attente"
          value={kpis?.pending ?? 0}
          icon={<Clock className="h-5 w-5" />}
          iconBg="rgba(245,158,11,0.12)"
          iconColor="#F59E0B"
          loading={isLoading}
        />
        <KpiCard
          label="En cours"
          value={kpis?.inProgress ?? 0}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="rgba(139,92,246,0.12)"
          iconColor="#8B5CF6"
          loading={isLoading}
        />
        <KpiCard
          label="Livrées"
          value={kpis?.delivered ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBg="rgba(16,185,129,0.12)"
          iconColor="#10B981"
          loading={isLoading}
        />
        <KpiCard
          label="Annulées"
          value={kpis?.cancelled ?? 0}
          icon={<XCircle className="h-5 w-5" />}
          iconBg="rgba(239,68,68,0.12)"
          iconColor="#EF4444"
          loading={isLoading}
        />
        <KpiCard
          label="Produits"
          value={kpis?.totalProducts ?? 0}
          icon={<Package className="h-5 w-5" />}
          iconBg="rgba(59,130,246,0.12)"
          iconColor="#3B82F6"
          loading={isLoading}
        />
        <KpiCard
          label="Taux rupture stock"
          value={kpis ? `${kpis.stockoutRate}%` : '—'}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconBg="rgba(239,68,68,0.12)"
          iconColor="#EF4444"
          loading={isLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Revenue area chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Chiffre d&apos;affaires</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.revenueSeries || []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--border)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--border)" width={50}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
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

        {/* Top products bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top produits</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.topProducts?.length ?? 0) === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Pas de données
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.topProducts || []} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--border)" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} stroke="var(--border)" />
                  <RechartsTooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="sales" fill="#6366F1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Commandes récentes</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => router.push('/orders')}>
              Voir tout <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">N° commande</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Statut</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Montant</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.recentOrders || []).map((order: any) => (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        #{order.order_number || order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell max-w-[140px] truncate">
                        {order.customer_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status || 'pending'} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {order.total_amount ? fmtCurrency(order.total_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {fmtDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs"
                          onClick={() => router.push(`/orders?id=${order.id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(data?.recentOrders || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Aucune commande pour cette période
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
