'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Eye, Heart, ShoppingCart, Users, TrendingUp } from 'lucide-react';
import Image from 'next/image';

type TopProduct = { id: string; name: string; main_image?: string | null; view_count?: number | null; favorite_count?: number | null; price?: number | null };
type RecentActivity = { id: string; user_id: string; action_type?: string | null; entity_type?: string | null; created_at: string; profiles?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null };

async function fetchMonitoringData() {
  const [topViewedRes, recentActivityRes, onlineUsersRes, cartRes] = await Promise.all([
    supabase.from('products').select('id, name, main_image, price').order('created_at', { ascending: false }).limit(10),
    supabase.from('user_activities').select('id, user_id, action_type, entity_type, created_at, profiles:user_id(first_name, last_name, email)').order('created_at', { ascending: false }).limit(30),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('cart_items').select('id', { count: 'exact', head: true }),
  ]);

  return {
    topProducts: (topViewedRes.data || []) as TopProduct[],
    recentActivities: (recentActivityRes.data || []).map((a: any) => ({
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

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

export default function MonitoringPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['monitoring'],
    queryFn: fetchMonitoringData,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const kpis = [
    { label: 'En ligne', value: data?.onlineUsers ?? 0, icon: <Users className="h-4 w-4" />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
    { label: 'Paniers actifs', value: data?.cartItems ?? 0, icon: <ShoppingCart className="h-4 w-4" />, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
    { label: 'Produits suivis', value: data?.topProducts.length ?? 0, icon: <TrendingUp className="h-4 w-4" />, bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
    { label: 'Activités récentes', value: data?.recentActivities.length ?? 0, icon: <Activity className="h-4 w-4" />, bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Monitoring" subtitle="Activité temps réel" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} iconBg={k.bg} iconColor={k.color} loading={isLoading} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Produits récents</p>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? [...Array(5)].map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-9 w-full" /></div>) :
              (data?.topProducts || []).map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-9 w-9 rounded-md overflow-hidden bg-muted shrink-0">
                    {p.main_image
                      ? <Image src={p.main_image} alt={p.name} width={36} height={36} className="h-9 w-9 object-cover" />
                      : <div className="flex h-full items-center justify-center text-muted-foreground text-xs">?</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    {p.price != null && <span className="font-medium text-foreground">{new Intl.NumberFormat('fr-FR').format(p.price)} XOF</span>}
                  </div>
                </div>
              ))
            }
          </div>
        </Card>

        {/* Recent activities */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Activités récentes</p>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {isLoading ? [...Array(8)].map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-8 w-full" /></div>) :
              (data?.recentActivities || []).map(a => {
                const name = [a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(' ') || a.profiles?.email || a.user_id.slice(0, 8);
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <span className="text-[10px] font-bold text-primary">{name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground"> · {fmtAction(a.action_type)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmtRelative(a.created_at)}</span>
                  </div>
                );
              })
            }
          </div>
        </Card>
      </div>
    </div>
  );
}
