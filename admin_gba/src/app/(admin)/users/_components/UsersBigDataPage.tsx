'use client';

import * as React from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Download,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  MoreHorizontal,
  PieChart as PieChartIcon,
  RefreshCw,
  Shield,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { ChartWrapper } from '@/components/shared/ChartWrapper';
import { Drawer } from '@/components/shared/Drawer';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { FilterBar } from '@/components/shared/FilterBar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatApiError } from '@/lib/format-api-error';

import { UserDetailDrawer } from './UserDetailDrawer';
import { UsersAdminSection } from './UsersAdminSection';
import { CreateUserWizard } from './CreateUserWizard';

type Row = Record<string, unknown> & {
  id: string;
  orders_count?: number;
  total_spent?: number;
  device_tokens_count?: number;
  ltv_score?: number;
  notifications_received_count?: number;
};

type UsersApi = {
  data: Row[];
  nextCursor: string | null;
  totalApprox: number | null;
  kpis: {
    total_users: number;
    active_30d: number;
    new_today: number;
    premium_ltv_count: number;
    role_breakdown: { client: number; driver: number; admin: number; superadmin: number; other: number };
    delta_new_users_week_pct: number;
  };
  bigdata_charts: {
    signup_series_30d: { date: string; count: number }[];
    top_countries: { country: string; count: number }[];
    spend_histogram: { range: string; count: number }[];
    cohort_retention_matrix: number[][];
    cohort_row_labels?: string[];
    cohort_col_labels?: string[];
  };
};

function buildQuery(params: Record<string, string>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) u.set(k, v);
  });
  return u.toString();
}

async function fetchUsers(cursor: string | null, filters: Record<string, string>): Promise<UsersApi> {
  const q = buildQuery({ ...filters, ...(cursor ? { cursor } : {}) });
  const r = await fetch(`/api/users?${q}`, { credentials: 'include' });
  const j = (await r.json()) as UsersApi & { error?: string };
  if (!r.ok) throw new Error(j.error || 'Erreur');
  return j as UsersApi;
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

function displayName(r: Row) {
  const a = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
  return a || String(r.email || '?');
}

export default function UsersBigDataPage() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState('');
  const [debouncedQ, setDebouncedQ] = React.useState('');
  const [roles, setRoles] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState('all');
  const [countries, setCountries] = React.useState<string[]>([]);
  const [ltvMin, setLtvMin] = React.useState('');
  const [ltvMax, setLtvMax] = React.useState('');
  const [ordersMin, setOrdersMin] = React.useState('');
  const [ordersMax, setOrdersMax] = React.useState('');
  const [hasDevice, setHasDevice] = React.useState('all');
  const [inactiveDays, setInactiveDays] = React.useState('');
  const [selected, setSelected] = React.useState<Row | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [showRolePie, setShowRolePie] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [blockTarget, setBlockTarget] = React.useState<Row | null>(null);
  const [blockReason, setBlockReason] = React.useState('');
  const [blockHours, setBlockHours] = React.useState<number | null>(null);
  const [bulkBroadcastOpen, setBulkBroadcastOpen] = React.useState(false);
  const [bulkMsg, setBulkMsg] = React.useState('');
  const [mainTab, setMainTab] = React.useState<'users' | 'admins'>('users');

  const meQ = useQuery({
    queryKey: ['admin-me'],
    queryFn: async (): Promise<{ isSuperAdmin: boolean }> => {
      const r = await fetch('/api/admin/me', { credentials: 'include' });
      if (!r.ok) return { isSuperAdmin: false };
      const j = (await r.json()) as { isSuperAdmin?: boolean };
      return { isSuperAdmin: Boolean(j.isSuperAdmin) };
    },
  });

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  const filters = React.useMemo(() => {
    const f: Record<string, string> = {};
    if (debouncedQ) f.q = debouncedQ;
    if (roles.length) f.role = roles.join(',');
    else f.role = 'all';
    if (status === 'suspended') f.status = 'suspended';
    if (status === 'active') f.status = 'active';
    if (status === 'inactive') f.status = 'inactive';
    if (countries.length) f.country = countries.join(',');
    if (ltvMin) f.ltv_min = ltvMin;
    if (ltvMax) f.ltv_max = ltvMax;
    if (ordersMin) f.orders_min = ordersMin;
    if (ordersMax) f.orders_max = ordersMax;
    if (hasDevice === 'yes') f.has_device = 'true';
    if (hasDevice === 'no') f.has_device = 'false';
    if (inactiveDays) f.inactive_days = inactiveDays;
    return f;
  }, [debouncedQ, roles, status, countries, ltvMin, ltvMax, ordersMin, ordersMax, hasDevice, inactiveDays]);

  const inf = useInfiniteQuery({
    queryKey: ['users-bigdata', filters],
    queryFn: ({ pageParam }) => fetchUsers((pageParam as string | null) ?? null, filters),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: null as string | null,
  });

  const flat = inf.data?.pages.flatMap((p) => p.data) ?? [];
  const lastKpis = inf.data?.pages[0]?.kpis;
  const charts = inf.data?.pages[0]?.bigdata_charts;

  const rolePieData = React.useMemo(() => {
    if (!lastKpis?.role_breakdown) return [];
    const rb = lastKpis.role_breakdown;
    const palette = ['#16a34a', '#4ade80', '#6366f1', '#ea580c', '#94a3b8'];
    const entries = [
      { name: 'Clients', value: rb.client },
      { name: 'Livreurs', value: rb.driver },
      { name: 'Admin', value: rb.admin },
      { name: 'Superadmin', value: rb.superadmin },
      { name: 'Autre', value: rb.other },
    ].filter((e) => e.value > 0);
    return entries.map((e, i) => ({ ...e, fill: palette[i % palette.length] }));
  }, [lastKpis]);

  const pwdResetMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/users/${id}/password-reset`, { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec');
      return j;
    },
    onSuccess: () => toast.success('Email de réinitialisation envoyé'),
    onError: (e: Error) => toast.error(e.message),
  });

  const sessionsRevokeMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/users/${id}/sessions`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success('Sessions révoquées');
      void qc.invalidateQueries({ queryKey: ['user-detail'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockMut = useMutation({
    mutationFn: async (payload: { id: string; reason: string; duration_hours: number | null }) => {
      const r = await fetch(`/api/users/${payload.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'block',
          reason: payload.reason,
          duration_hours: payload.duration_hours,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || 'Blocage échoué');
    },
    onSuccess: () => {
      toast.success('Compte bloqué');
      setBlockOpen(false);
      setBlockTarget(null);
      setBlockReason('');
      void inf.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblockMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/users/${id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'unblock' }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || 'Déblocage échoué');
    },
    onSuccess: () => {
      toast.success('Compte débloqué');
      void inf.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'u',
        header: 'Utilisateur',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-[200px]">
            <AvatarWithInitials src={row.original.avatar_url as string | null} name={displayName(row.original)} size={36} />
            <div className="min-w-0">
              <div className="font-medium truncate">{displayName(row.original)}</div>
              <div className="text-xs text-muted-foreground truncate">{String(row.original.email || '')}</div>
            </div>
          </div>
        ),
      },
      { id: 'email', header: 'Email', cell: ({ row }) => <span className="text-sm">{String(row.original.email || '—')}</span> },
      { id: 'phone', header: 'Tél.', cell: ({ row }) => <span className="text-sm">{String(row.original.phone || '—')}</span> },
      {
        id: 'role',
        header: 'Rôle',
        cell: ({ row }) => <StatusBadge status={String(row.original.role || 'user')} />,
      },
      {
        id: 'st',
        header: 'Statut',
        cell: ({ row }) => <StatusBadge status={row.original.is_suspended ? 'suspended' : 'active'} />,
      },
      {
        id: 'loc',
        header: 'Pays · Ville',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {[row.original.country, row.original.city].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
      },
      {
        id: 'created',
        header: 'Inscription',
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">
            {row.original.created_at
              ? format(new Date(String(row.original.created_at)), 'dd MMM yyyy', { locale: fr })
              : '—'}
          </span>
        ),
      },
      {
        id: 'last',
        header: 'Dernière activité',
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">
            {row.original.last_seen_at
              ? format(new Date(String(row.original.last_seen_at)), 'dd MMM yyyy HH:mm', { locale: fr })
              : '—'}
          </span>
        ),
      },
      { id: 'oc', header: 'Cmd', cell: ({ row }) => <span className="tabular-nums">{row.original.orders_count ?? 0}</span> },
      {
        id: 'spent',
        header: 'Total dépensé',
        cell: ({ row }) => <span className="tabular-nums text-sm">{fmtMoney(Number(row.original.total_spent || 0))}</span>,
      },
      {
        id: 'ltv',
        header: 'LTV',
        cell: ({ row }) => {
          const v = Number(row.original.ltv_score || 0);
          return (
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', v > 66 ? 'bg-emerald-500' : v > 33 ? 'bg-amber-500' : 'bg-slate-400')}
                style={{ width: `${v}%` }}
              />
            </div>
          );
        },
      },
      {
        id: 'dev',
        header: 'Devices',
        cell: ({ row }) => <span className="tabular-nums">{row.original.device_tokens_count ?? 0}</span>,
      },
      {
        id: 'act',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelected(row.original);
                  setDrawerOpen(true);
                }}
              >
                Voir fiche
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelected(row.original);
                  setDrawerOpen(true);
                }}
              >
                Modifier rôle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pwdResetMut.mutate(row.original.id)}>
                <KeyRound className="h-3.5 w-3.5 mr-1" />
                Reset MDP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => sessionsRevokeMut.mutate(row.original.id)}>
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Révoquer sessions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.original.is_suspended ? (
                <DropdownMenuItem
                  className="text-emerald-600"
                  onClick={() => unblockMut.mutate(row.original.id)}
                >
                  <Unlock className="h-3.5 w-3.5 mr-1" />
                  Débloquer
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-amber-600"
                  onClick={() => {
                    setBlockTarget(row.original);
                    setBlockReason('');
                    setBlockHours(null);
                    setBlockOpen(true);
                  }}
                >
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  Bloquer
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [pwdResetMut, sessionsRevokeMut, unblockMut],
  );

  const filterChips = React.useMemo(() => {
    const c: { id: string; label: string }[] = [];
    roles.forEach((r) => c.push({ id: `role-${r}`, label: `Rôle: ${r}` }));
    countries.forEach((co) => c.push({ id: `ct-${co}`, label: `Pays: ${co}` }));
    if (ltvMin) c.push({ id: 'ltvmin', label: `LTV ≥ ${ltvMin}` });
    if (ltvMax) c.push({ id: 'ltvmax', label: `LTV ≤ ${ltvMax}` });
    return c;
  }, [roles, countries, ltvMin, ltvMax]);

  const onRemoveChip = (id: string) => {
    if (id.startsWith('role-')) setRoles((x) => x.filter((y) => y !== id.slice(6)));
    else if (id.startsWith('ct-')) setCountries((x) => x.filter((y) => y !== id.slice(3)));
    else if (id === 'ltvmin') setLtvMin('');
    else if (id === 'ltvmax') setLtvMax('');
  };

  const exportCsv = () => {
    const headers = ['id', 'email', 'name', 'role', 'orders', 'spent'];
    const lines = [headers.join(';')].concat(
      flat.map((r) =>
        [r.id, r.email, displayName(r), r.role, r.orders_count, r.total_spent].map((x) => `"${String(x ?? '')}"`).join(';'),
      ),
    );
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  const loading = inf.isLoading && !flat.length;
  const bulkBroadcastMut = useMutation({
    mutationFn: async () => {
      const ids = flat.map((r) => r.id).slice(0, 1000);
      const r = await fetch('/api/messages/broadcast-inapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          target: 'specific',
          user_ids: ids,
          message: { body: bulkMsg.trim(), message_type: 'text', attachments: [] },
          send_push: false,
        }),
      });
      const x = (await r.json().catch(() => ({}))) as unknown;
      if (!r.ok) throw new Error(formatApiError(x, 'Broadcast échoué'));
      return x as { sent_count: number };
    },
    onSuccess: (x) => {
      toast.success(`Broadcast in-app envoyé à ${x.sent_count} utilisateurs`);
      setBulkBroadcastOpen(false);
      setBulkMsg('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs"
        subtitle="BigData · filtres avancés · fiches complètes"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Créer
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!flat.length}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkBroadcastOpen(true)} disabled={!flat.length}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Broadcast In-App
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => setShowRolePie((v) => !v)}>
              <PieChartIcon className="h-3.5 w-3.5 mr-1" />
              {showRolePie ? 'Masquer rôles' : 'Répartition rôles'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void inf.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'users' | 'admins')}>
        <TabsList>
          <TabsTrigger value="users">Tous les utilisateurs</TabsTrigger>
          {meQ.data?.isSuperAdmin ? (
            <TabsTrigger value="admins" className="gap-1">
              <Shield className="h-3.5 w-3.5" />
              Admins
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="admins" className="pt-4">
          {meQ.data?.isSuperAdmin ? <UsersAdminSection /> : null}
        </TabsContent>
        <TabsContent value="users" className="space-y-6 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              label="Total utilisateurs"
              value={lastKpis?.total_users ?? 0}
              delta={lastKpis?.delta_new_users_week_pct}
              deltaLabel="vs semaine préc."
              icon={<Users className="h-5 w-5" />}
              loading={loading}
            />
            <KPICard
              label="Actifs 30j"
              value={lastKpis?.active_30d ?? 0}
              delta={lastKpis?.delta_new_users_week_pct}
              deltaLabel="vs semaine préc."
              icon={<UserPlus className="h-5 w-5" />}
              loading={loading}
            />
            <KPICard
              label="Nouveaux aujourd'hui"
              value={lastKpis?.new_today ?? 0}
              delta={lastKpis?.delta_new_users_week_pct}
              deltaLabel="vs semaine préc."
              icon={<Mail className="h-5 w-5" />}
              loading={loading}
            />
            <KPICard
              label="Premium LTV (≥100k)"
              value={lastKpis?.premium_ltv_count ?? 0}
              delta={lastKpis?.delta_new_users_week_pct}
              deltaLabel="vs semaine préc."
              icon={<Shield className="h-5 w-5" />}
              loading={loading}
            />
            <KPICard
              label="Clients / utilisateurs"
              value={lastKpis?.role_breakdown.client ?? 0}
              icon={<Users className="h-5 w-5" />}
              loading={loading}
            />
            <KPICard label="Drivers" value={lastKpis?.role_breakdown.driver ?? 0} icon={<Users className="h-5 w-5" />} loading={loading} />
            <KPICard label="Admins" value={lastKpis?.role_breakdown.admin ?? 0} icon={<Shield className="h-5 w-5" />} loading={loading} />
            <KPICard
              label="Superadmins"
              value={lastKpis?.role_breakdown.superadmin ?? 0}
              icon={<Shield className="h-5 w-5" />}
              loading={loading}
            />
          </div>

          <FilterBar
            searchPlaceholder="Recherche email, nom, téléphone…"
            searchValue={q}
            onSearchChange={setQ}
            chips={filterChips}
            onRemoveChip={onRemoveChip}
            onClearChips={() => {
              setRoles([]);
              setCountries([]);
              setLtvMin('');
              setLtvMax('');
              setOrdersMin('');
              setOrdersMax('');
              setHasDevice('all');
              setInactiveDays('');
              setStatus('all');
            }}
            advancedFilters={
              <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
                <div className="space-y-2">
                  <Label>Rôles (multi)</Label>
                  {(['client', 'driver', 'admin', 'superadmin'] as const).map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border border-input"
                        checked={roles.includes(r)}
                        onChange={(e) =>
                          setRoles((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))
                        }
                      />
                      {r}
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v ?? 'all')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="suspended">Suspendu</SelectItem>
                      <SelectItem value="inactive">Inactif 30j+</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="pt-2">Device token</Label>
                  <Select value={hasDevice} onValueChange={(v) => setHasDevice(v ?? 'all')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="yes">Avec device</SelectItem>
                      <SelectItem value="no">Sans device</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>LTV min / max (FCFA)</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Min" value={ltvMin} onChange={(e) => setLtvMin(e.target.value)} />
                    <Input placeholder="Max" value={ltvMax} onChange={(e) => setLtvMax(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Commandes min / max</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Min" value={ordersMin} onChange={(e) => setOrdersMin(e.target.value)} />
                    <Input placeholder="Max" value={ordersMax} onChange={(e) => setOrdersMax(e.target.value)} />
                  </div>
                  <Label className="pt-2">Inactif depuis (jours)</Label>
                  <Input placeholder="ex: 14" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Pays (virgule)</Label>
                  <Input
                    placeholder="CI, SN, ML…"
                    value={countries.join(', ')}
                    onChange={(e) =>
                      setCountries(
                        e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </div>
              </div>
            }
          />

          {charts ? (
            <motion.div
              className="grid gap-4 md:grid-cols-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ChartWrapper title="Nouveaux utilisateurs / jour (30j)" isLoading={loading}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.signup_series_30d}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis width={32} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="var(--brand)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>
              <ChartWrapper title="Top 10 pays" isLoading={loading}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart layout="vertical" data={charts.top_countries} margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="country" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--brand)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
              <ChartWrapper title="Histogramme dépenses (échantillon)" isLoading={loading}>
                <div className="h-[220px] w-full min-h-[220px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.spend_histogram}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis width={32} />
                      <Tooltip />
                      <Bar dataKey="count" fill="color-mix(in srgb, var(--brand) 80%, white)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartWrapper>
              {showRolePie ? (
                <ChartWrapper title="Répartition des rôles (échantillon liste)" isLoading={loading}>
                  <div className="h-[220px] w-full min-h-[220px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={rolePieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={84}
                          paddingAngle={2}
                        >
                          {rolePieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartWrapper>
              ) : (
                <ChartWrapper title="Rétention par cohorte (commandes)" isLoading={loading}>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Lignes : semaine de la première commande (UTC). Colonnes : semaines suivantes (S+0 = même semaine). Pourcentage
                    d&apos;acheteurs ayant au moins une commande cette semaine-là.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr>
                          <th className="p-2 border border-border text-left text-muted-foreground font-medium bg-muted/30">
                            Cohorte
                          </th>
                          {(charts.cohort_col_labels ?? ['S+0', 'S+1', 'S+2', 'S+3', 'S+4', 'S+5']).map((lab) => (
                            <th
                              key={lab}
                              className="p-2 border border-border text-center text-muted-foreground font-medium bg-muted/30 min-w-[48px]"
                            >
                              {lab}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {charts.cohort_retention_matrix.map((row, i) => (
                          <tr key={i}>
                            <td className="p-2 border border-border font-medium text-muted-foreground bg-muted/20 whitespace-nowrap">
                              {charts.cohort_row_labels?.[i] ?? `L${i + 1}`}
                            </td>
                            {row.map((cell, j) => (
                              <td
                                key={j}
                                className={cn(
                                  'p-2 border border-border text-center min-w-[48px]',
                                  cell >= 70 && 'bg-emerald-600/80 text-white',
                                  cell >= 40 && cell < 70 && 'bg-emerald-500/50',
                                  cell < 40 && 'bg-emerald-900/20',
                                )}
                              >
                                {cell}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartWrapper>
              )}
              {showRolePie ? (
                <ChartWrapper title="Rétention par cohorte (commandes)" isLoading={loading} className="md:col-span-2">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Lignes : semaine de la première commande (UTC). Colonnes : semaines suivantes (S+0 = même semaine). Pourcentage
                    d&apos;acheteurs ayant au moins une commande cette semaine-là.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr>
                          <th className="p-2 border border-border text-left text-muted-foreground font-medium bg-muted/30">
                            Cohorte
                          </th>
                          {(charts.cohort_col_labels ?? ['S+0', 'S+1', 'S+2', 'S+3', 'S+4', 'S+5']).map((lab) => (
                            <th
                              key={lab}
                              className="p-2 border border-border text-center text-muted-foreground font-medium bg-muted/30 min-w-[48px]"
                            >
                              {lab}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {charts.cohort_retention_matrix.map((row, i) => (
                          <tr key={i}>
                            <td className="p-2 border border-border font-medium text-muted-foreground bg-muted/20 whitespace-nowrap">
                              {charts.cohort_row_labels?.[i] ?? `L${i + 1}`}
                            </td>
                            {row.map((cell, j) => (
                              <td
                                key={j}
                                className={cn(
                                  'p-2 border border-border text-center min-w-[48px]',
                                  cell >= 70 && 'bg-emerald-600/80 text-white',
                                  cell >= 40 && cell < 70 && 'bg-emerald-500/50',
                                  cell < 40 && 'bg-emerald-900/20',
                                )}
                              >
                                {cell}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartWrapper>
              ) : null}
            </motion.div>
          ) : null}

          {inf.isError ? (
            <Card className="p-6 text-center border-destructive/30">
              <p className="text-sm text-destructive mb-2">{(inf.error as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => void inf.refetch()}>
                Réessayer
              </Button>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={flat}
              isLoading={loading}
              emptyTitle="Aucun utilisateur"
              emptyDescription="Ajustez les filtres ou attendez les premières inscriptions."
              emptyAction={
                <Button variant="outline" size="sm" onClick={() => void inf.refetch()}>
                  Actualiser
                </Button>
              }
              cursorFooter={
                inf.hasNextPage ? (
                  <div className="flex justify-center py-2">
                    <Button variant="ghost" size="sm" onClick={() => void inf.fetchNextPage()} disabled={inf.isFetchingNextPage}>
                      {inf.isFetchingNextPage ? 'Chargement…' : 'Charger la suite'}
                    </Button>
                  </div>
                ) : null
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <UserDetailDrawer user={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />

      <CreateUserWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => void inf.refetch()}
      />

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquer {blockTarget ? displayName(blockTarget) : ''}</DialogTitle>
            <DialogDescription>L’utilisateur ne pourra plus se connecter selon la durée choisie.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Motif *</Label>
              <Textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} rows={3} placeholder="Raison du blocage" />
            </div>
            <div className="space-y-1">
              <Label>Durée</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '24h', h: 24 },
                  { label: '7j', h: 168 },
                  { label: '30j', h: 720 },
                  { label: 'Permanent', h: null as number | null },
                ].map(({ label, h }) => (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={blockHours === h ? 'default' : 'outline'}
                    onClick={() => setBlockHours(h)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBlockOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!blockReason.trim() || !blockTarget}
              onClick={() => {
                if (!blockTarget) return;
                blockMut.mutate({
                  id: blockTarget.id,
                  reason: blockReason.trim(),
                  duration_hours: blockHours,
                });
              }}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkBroadcastOpen} onOpenChange={setBulkBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast In-App (liste filtrée)</DialogTitle>
            <DialogDescription>
              Envoi vers les utilisateurs actuellement chargés ({Math.min(flat.length, 1000)} max par envoi).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Message</Label>
            <Textarea rows={4} value={bulkMsg} onChange={(e) => setBulkMsg(e.target.value)} placeholder="Message in-app..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkBroadcastOpen(false)}>
              Annuler
            </Button>
            <Button type="button" disabled={!bulkMsg.trim() || bulkBroadcastMut.isPending} onClick={() => bulkBroadcastMut.mutate()}>
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
