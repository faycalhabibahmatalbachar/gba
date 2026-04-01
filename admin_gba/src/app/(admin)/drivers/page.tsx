'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Truck, CheckCircle2, Search, RefreshCw, Phone } from 'lucide-react';

type Driver = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at: string;
  delivered_count?: number;
  in_progress_count?: number;
};

async function fetchDrivers(search?: string): Promise<Driver[]> {
  let q = supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active, created_at')
    .eq('role', 'driver')
    .order('full_name');
  if (search?.trim()) {
    const s = search.trim();
    q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Driver[];
}

async function toggleDriverActive(id: string, active: boolean) {
  const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', id);
  if (error) throw error;
}

export default function DriversPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['drivers', search],
    queryFn: () => fetchDrivers(search),
    staleTime: 30_000,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleDriverActive(id, active),
    onSuccess: (_, { active }) => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success(active ? 'Livreur activé' : 'Livreur désactivé');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const drivers = query.data || [];
  const active = drivers.filter(d => d.is_active !== false).length;
  const inactive = drivers.filter(d => d.is_active === false).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Livreurs"
        subtitle={`${drivers.length} livreur${drivers.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['drivers'] })}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total" value={drivers.length} icon={<Users className="h-4 w-4" />} iconBg="rgba(99,102,241,0.12)" iconColor="#6366F1" loading={query.isLoading} />
        <KpiCard label="Actifs" value={active} icon={<Truck className="h-4 w-4" />} iconBg="rgba(16,185,129,0.12)" iconColor="#10B981" loading={query.isLoading} />
        <KpiCard label="Inactifs" value={inactive} icon={<CheckCircle2 className="h-4 w-4" />} iconBg="rgba(239,68,68,0.12)" iconColor="#EF4444" loading={query.isLoading} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher livreur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Grid */}
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : drivers.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title="Aucun livreur" description={search ? 'Aucun résultat.' : 'Les livreurs seront listés ici.'} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {drivers.map(d => (
            <Card key={d.id} className={`p-4 space-y-3 transition-opacity ${d.is_active === false ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {(d.full_name || d.email || '?')[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{d.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.email || '—'}</p>
                </div>
                <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${d.is_active === false ? 'bg-muted-foreground' : 'bg-emerald-500'}`} />
              </div>

              {d.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{d.phone}</span>
                </div>
              )}

              <Button
                variant={d.is_active === false ? 'default' : 'outline'}
                size="sm"
                className="w-full h-7 text-xs"
                disabled={toggleMut.isPending}
                onClick={() => toggleMut.mutate({ id: d.id, active: d.is_active === false })}
              >
                {d.is_active === false ? 'Activer' : 'Désactiver'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
