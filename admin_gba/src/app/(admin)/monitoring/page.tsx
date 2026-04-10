'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Activity, Eye, Heart, ShoppingCart, Users, TrendingUp, Download, MousePointerClick } from 'lucide-react';
import Image from 'next/image';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type TopProduct = {
  id: string;
  name: string;
  main_image?: string | null;
  view_count?: number | null;
  favorite_count?: number | null;
  price?: number | null;
};
type RecentActivity = {
  id: string;
  user_id: string;
  action_type?: string | null;
  entity_type?: string | null;
  created_at: string;
  profiles?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

async function fetchMonitoringData() {
  const [topViewedRes, recentActivityRes, onlineUsersRes, cartRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, main_image, price, view_count, favorite_count')
      .order('view_count', { ascending: false })
      .limit(12),
    supabase
      .from('user_activities')
      .select('id, user_id, action_type, entity_type, created_at, profiles:user_id(first_name, last_name, email)')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('cart_items').select('id', { count: 'exact', head: true }),
  ]);

  return {
    topProducts: (topViewedRes.data || []) as TopProduct[],
    recentActivities: (recentActivityRes.data || []).map((a: Record<string, unknown>) => ({
      ...a,
      profiles: Array.isArray(a.profiles) ? a.profiles[0] : a.profiles,
    })) as RecentActivity[],
    onlineUsers: onlineUsersRes.count ?? 0,
    cartItems: cartRes.count ?? 0,
  };
}

function fmtAction(type?: string | null) {
  const t = (type || '').toLowerCase();
  if (t === 'product_view') return 'Vue produit';
  if (t === 'cart_add') return 'Ajout panier';
  if (t === 'favorite_add' || t === 'fav_add') return 'Favori ajouté';
  if (t === 'order_created') return 'Commande créée';
  if (t === 'app_opened') return 'App ouverte';
  return type || '—';
}

function activityIcon(type?: string | null) {
  const t = (type || '').toLowerCase();
  if (t === 'product_view') return Eye;
  if (t === 'cart_add') return ShoppingCart;
  if (t === 'favorite_add' || t === 'fav_add') return Heart;
  if (t === 'order_created') return TrendingUp;
  return MousePointerClick;
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

export default function MonitoringPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['monitoring'],
    queryFn: fetchMonitoringData,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const activityByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of data?.recentActivities || []) {
      const k = fmtAction(a.action_type);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [data?.recentActivities]);

  const exportAll = () => {
    const actRows: string[][] = [
      ['created_at', 'user_id', 'action', 'entity_type', 'user_email'],
      ...(data?.recentActivities || []).map((a) => [
        a.created_at,
        a.user_id,
        a.action_type || '',
        a.entity_type || '',
        a.profiles?.email || '',
      ]),
    ];
    downloadCsv(`gba-monitoring-activities-${Date.now()}.csv`, actRows);
    const prodRows: string[][] = [
      ['id', 'name', 'view_count', 'favorite_count', 'price'],
      ...(data?.topProducts || []).map((p) => [
        p.id,
        p.name,
        String(p.view_count ?? 0),
        String(p.favorite_count ?? 0),
        String(p.price ?? ''),
      ]),
    ];
    downloadCsv(`gba-monitoring-products-${Date.now()}.csv`, prodRows);
  };

  const kpis = [
    { label: 'En ligne', value: data?.onlineUsers ?? 0, icon: <Users className="h-4 w-4" />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
    { label: 'Paniers actifs', value: data?.cartItems ?? 0, icon: <ShoppingCart className="h-4 w-4" />, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
    { label: 'Top produits', value: data?.topProducts.length ?? 0, icon: <TrendingUp className="h-4 w-4" />, bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
    { label: 'Activités (échantillon)', value: data?.recentActivities.length ?? 0, icon: <Activity className="h-4 w-4" />, bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring"
        subtitle="Activité temps réel"
        actions={
          <Button variant="outline" size="sm" onClick={exportAll} disabled={isLoading || !data}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} iconBg={k.bg} iconColor={k.color} loading={isLoading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-4">
          <p className="text-sm font-semibold mb-3">Activités par type (échantillon)</p>
          <div className="h-[220px] w-full min-w-0">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : activityByType.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Aucune activité récente</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={activityByType} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--brand)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-4">
          <p className="text-sm font-semibold mb-3">Répartition (top types)</p>
          <div className="h-[220px] w-full min-w-0">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : activityByType.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">—</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={activityByType.slice(0, 6)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {activityByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold">Produits les plus consultés</p>
            <span className="text-[10px] text-muted-foreground">Clic → fiche</span>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-9 w-full" />
                </div>
              ))
            ) : (
              (data?.topProducts || []).map((p) => (
                <Link
                  key={p.id}
                  href={`/products?product=${encodeURIComponent(p.id)}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-md overflow-hidden bg-muted shrink-0">
                    {p.main_image ? (
                      <Image src={p.main_image} alt={p.name} width={36} height={36} className="h-9 w-9 object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.view_count ?? 0} vues · {p.favorite_count ?? 0} fav.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    {p.price != null && (
                      <span className="font-medium text-foreground">{new Intl.NumberFormat('fr-FR').format(p.price)} XOF</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Activités récentes</p>
          </div>
          <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-10 w-full" />
                </div>
              ))
            ) : (
              (data?.recentActivities || []).map((a) => {
                const name =
                  [a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(' ') || a.profiles?.email || a.user_id.slice(0, 8);
                const Icon = activityIcon(a.action_type);
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-l-2 border-transparent hover:border-primary/40"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{fmtAction(a.action_type)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/80">{name}</span>
                        {a.entity_type ? ` · ${a.entity_type}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{fmtRelative(a.created_at)}</span>
                      <Link href="/users" className="text-[10px] text-primary hover:underline">
                        Utilisateurs
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
