'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Bell, Clock, ExternalLink, LogOut, Repeat, Shield, ShoppingBag, Smartphone } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Drawer } from '@/components/shared/Drawer';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  phone: z.string().max(50).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
});

type Row = Record<string, unknown> & { id: string };

type Detail = {
  profile: Record<string, unknown>;
  stats: Record<string, unknown>;
  bigdata?: {
    monthly_spending: { month: string; amount: number }[];
    behavior_counts: Record<string, number>;
    product_views: number;
    cart_adds: number;
    checkouts: number;
  };
  orders: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  device_tokens: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  role_audit_samples: Record<string, unknown>[];
  user_behaviors?: Record<string, unknown>[];
};

function displayName(p: Record<string, unknown>) {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return a || String(p.email || '?');
}

export interface UserClientSheetProps {
  user: Row | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Fiche client / utilisateur e-commerce (commandes, LTV, funnel). */
export function UserClientSheet({ user, open, onOpenChange }: UserClientSheetProps) {
  const qc = useQueryClient();
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [pushOpen, setPushOpen] = React.useState(false);
  const [pushTitle, setPushTitle] = React.useState('Message administrateur');
  const [pushBody, setPushBody] = React.useState('');
  const [pushDeeplink, setPushDeeplink] = React.useState('/home');
  const [tabVal, setTabVal] = React.useState('profil');
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);

  const q = useQuery({
    queryKey: ['user-detail', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/users/${user!.id}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      return j as Detail;
    },
    enabled: open && !!user?.id,
  });

  const form = useForm({
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      city: '',
      country: '',
    },
  });

  React.useEffect(() => {
    const p = q.data?.profile;
    if (!p) return;
    form.reset({
      first_name: String(p.first_name || ''),
      last_name: String(p.last_name || ''),
      phone: String(p.phone || ''),
      city: String(p.city || ''),
      country: String(p.country || ''),
    });
  }, [q.data?.profile, form]);

  const saveMut = useMutation({
    mutationFn: async (values: z.infer<typeof profileSchema>) => {
      const r = await fetch(`/api/users/${user!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec');
      return j;
    },
    onSuccess: () => {
      toast.success('Profil mis à jour');
      void qc.invalidateQueries({ queryKey: ['user-detail', user?.id] });
      void qc.invalidateQueries({ queryKey: ['users-bigdata'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: async (payload: { role: string; role_change_reason: string }) => {
      const r = await fetch(`/api/users/${user!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec');
      return j;
    },
    onSuccess: () => {
      toast.success('Rôle mis à jour');
      void qc.invalidateQueries({ queryKey: ['user-detail', user?.id] });
      void qc.invalidateQueries({ queryKey: ['users-bigdata'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateTokMut = useMutation({
    mutationFn: async (tokenId: string) => {
      const r = await fetch(`/api/users/${user!.id}/device-tokens/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_valid: false }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec');
      return j;
    },
    onSuccess: () => {
      toast.success('Token invalidé');
      void qc.invalidateQueries({ queryKey: ['user-detail', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recoQ = useQuery({
    queryKey: ['user-reco-preview', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/users/${user!.id}/recommendations`, { credentials: 'include' });
      const j = (await r.json()) as { data?: { products?: Record<string, unknown>[] } };
      if (!r.ok) throw new Error('Reco');
      return j.data?.products || [];
    },
    enabled: open && !!user?.id && tabVal === 'comportement',
  });

  const pushMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: pushTitle.trim(),
          body: pushBody.trim(),
          user_ids: [user!.id],
          data: { route: pushDeeplink.trim() || '/home', source: 'admin_user_drawer' },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec envoi');
      return j;
    },
    onSuccess: () => {
      toast.success('Notification envoyée');
      setPushOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessionsDel = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/users/${user!.id}/sessions`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success('Sessions révoquées');
      void qc.invalidateQueries({ queryKey: ['user-detail', user?.id] });
      setRevokeOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avatarMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/users/${user!.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || 'Upload avatar échoué');
    },
    onSuccess: () => {
      toast.success('Avatar mis à jour');
      void qc.invalidateQueries({ queryKey: ['user-detail', user?.id] });
      void qc.invalidateQueries({ queryKey: ['users-bigdata'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orderCols = React.useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      { id: 'id', header: '#', cell: ({ row }) => <span className="font-mono text-xs">{String(row.original.id).slice(0, 8)}</span> },
      {
        id: 'd',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.created_at
              ? format(new Date(String(row.original.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr })
              : '—'}
          </span>
        ),
      },
      { id: 'st', header: 'Statut', cell: ({ row }) => <StatusBadge status={String(row.original.status || '')} /> },
      {
        id: 'tot',
        header: 'Total',
        cell: ({ row }) => (
          <span className="tabular-nums">{Number(row.original.total_amount || 0).toLocaleString('fr-FR')} FCFA</span>
        ),
      },
      {
        id: 'act',
        header: '',
        cell: ({ row }) => (
          <Link
            href={`/orders?focus=${String(row.original.id)}`}
            className="inline-flex h-7 items-center rounded-md border border-input bg-background px-2 text-[10px] hover:bg-muted"
          >
              Détails
              <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        ),
      },
    ],
    [],
  );

  const payCols = React.useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      {
        id: 'd',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.created_at
              ? format(new Date(String(row.original.created_at)), 'dd/MM/yyyy', { locale: fr })
              : '—'}
          </span>
        ),
      },
      {
        id: 'amt',
        header: 'Montant',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {Number(row.original.amount || 0).toLocaleString('fr-FR')} {String(row.original.currency || 'XOF')}
          </span>
        ),
      },
      { id: 'st', header: 'Statut', cell: ({ row }) => <StatusBadge status={String(row.original.status || '')} /> },
      { id: 'pr', header: 'Provider', cell: ({ row }) => <span className="text-xs">{String(row.original.provider || '—')}</span> },
    ],
    [],
  );

  const devCols = React.useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      { id: 'pl', header: 'Plateforme', cell: ({ row }) => <span className="text-xs">{String(row.original.platform)}</span> },
      {
        id: 'tk',
        header: 'Token',
        cell: ({ row }) => <span className="font-mono text-[10px]">{String(row.original.token).slice(0, 12)}…</span>,
      },
      {
        id: 'inv',
        header: 'Valide',
        cell: ({ row }) => <StatusBadge status={row.original.is_valid === false ? 'suspended' : 'active'} customLabel={row.original.is_valid === false ? 'Non' : 'Oui'} />,
      },
      {
        id: 'act',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => invalidateTokMut.mutate(String(row.original.id))}
            disabled={row.original.is_valid === false}
          >
            Invalider
          </Button>
        ),
      },
    ],
    [invalidateTokMut],
  );

  const p = q.data?.profile;
  const [newRole, setNewRole] = React.useState('client');
  const [roleReason, setRoleReason] = React.useState('');

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title={user && p ? displayName(p) : 'Utilisateur'}
        description={user && p ? String(p.email || '') : undefined}
        className="!max-w-[580px] sm:!w-[580px]"
      >
        {!user ? null : q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : p ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AvatarWithInitials src={p.avatar_url as string | null} name={displayName(p)} size={56} />
              <div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={String(p.role || 'user')} />
                  <StatusBadge status={p.is_suspended ? 'suspended' : 'active'} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Inscrit le{' '}
                  {p.created_at
                    ? format(new Date(String(p.created_at)), 'dd MMM yyyy', { locale: fr })
                    : '—'}
                  {p.last_sign_in_at
                    ? ` · Dernière connexion ${formatDistanceToNow(new Date(String(p.last_sign_in_at)), { addSuffix: true, locale: fr })}`
                    : ''}
                </p>
              </div>
            </div>

            <div
                className="relative overflow-hidden rounded-xl border border-border"
                style={{ background: 'linear-gradient(135deg, rgba(108,71,255,0.12), transparent)' }}
              >
                <div className="grid grid-cols-3 divide-x border-b border-border/80">
                  {[
                    { label: 'Commandes', value: String(q.data?.stats?.orders_count ?? 0) },
                    {
                      label: 'Total dépensé',
                      value: `${new Intl.NumberFormat('fr-FR').format(Number(q.data?.stats?.total_spent ?? 0))} FCFA`,
                    },
                    { label: 'Score LTV', value: String(q.data?.stats?.ltv_score ?? '—') },
                  ].map((s) => (
                    <div key={s.label} className="p-3 text-center">
                      <p className="font-semibold text-sm tabular-nums">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                  {(
                    [
                      {
                        icon: ShoppingBag,
                        label: 'Panier moy.',
                        value: `${new Intl.NumberFormat('fr-FR').format(Number(q.data?.stats?.avg_basket ?? 0))} FCFA`,
                      },
                      { icon: Repeat, label: 'Réachat (2+ cmd)', value: `${Number(q.data?.stats?.reorder_rate ?? 0)}%` },
                      { icon: Smartphone, label: 'Devices', value: String(q.data?.stats?.device_tokens_count ?? 0) },
                      {
                        icon: Clock,
                        label: 'Activité',
                        value: p.last_sign_in_at
                          ? formatDistanceToNow(new Date(String(p.last_sign_in_at)), { locale: fr })
                          : '—',
                      },
                    ] as const
                  ).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                      <div className="rounded-md bg-background p-1.5">
                        <Icon className="h-3.5 w-3.5 text-[#6C47FF]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="truncate text-xs font-semibold">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {q.data?.bigdata?.monthly_spending && q.data.bigdata.monthly_spending.length > 0 ? (
                  <div className="border-t border-border px-3 pb-3 pt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Dépenses par mois (12 mois)</p>
                    <div className="h-[140px] w-full min-h-[140px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={q.data.bigdata.monthly_spending}>
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 9 }}
                            tickFormatter={(m) => format(new Date(`${m}-01`), 'MMM', { locale: fr })}
                          />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                          <Tooltip
                            formatter={(value) => [
                              `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`,
                              '',
                            ]}
                          />
                          <Area type="monotone" dataKey="amount" stroke="#6C47FF" fill="rgba(108,71,255,0.2)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : null}
                {q.data?.bigdata ? (
                  <div className="space-y-1.5 border-t border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Funnel (user_behavior)</p>
                    {(
                      [
                        { label: 'Vues', value: q.data.bigdata.product_views, color: 'bg-blue-500' },
                        { label: 'Panier', value: q.data.bigdata.cart_adds, color: 'bg-amber-500' },
                        { label: 'Achats trace', value: q.data.bigdata.checkouts, color: 'bg-emerald-500' },
                        { label: 'Commandes', value: Number(q.data.stats.orders_count ?? 0), color: 'bg-violet-600' },
                      ] as const
                    ).map((step, i, arr) => {
                      const maxVal = Math.max(1, ...arr.map((a) => a.value));
                      const pct = Math.round((step.value / maxVal) * 100);
                      return (
                        <div key={step.label} className="flex items-center gap-2">
                          <p className="w-24 truncate text-[10px] text-muted-foreground">{step.label}</p>
                          <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('flex h-full items-center rounded-full pl-2', step.color)}
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            >
                              <span className="text-[10px] font-medium text-white">{step.value}</span>
                            </div>
                          </div>
                          <span className="w-8 text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setPushOpen(true)}>
                  <Bell className="h-3.5 w-3.5" />
                  Envoyer push
                </Button>
            </div>

            <Tabs value={tabVal} onValueChange={setTabVal}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="profil">Profil</TabsTrigger>
                <TabsTrigger value="orders">Commandes</TabsTrigger>
                <TabsTrigger value="pay">Paiements</TabsTrigger>
                <TabsTrigger value="dev">Devices</TabsTrigger>
                <TabsTrigger value="act">Activité</TabsTrigger>
                <TabsTrigger value="comportement">Comportement</TabsTrigger>
                <TabsTrigger value="role">Rôles</TabsTrigger>
                <TabsTrigger value="sec">Sécurité</TabsTrigger>
              </TabsList>
              <TabsContent value="profil" className="space-y-3 pt-3">
                <form
                  className="grid gap-2"
                  onSubmit={form.handleSubmit((vals) => {
                    const parsed = profileSchema.safeParse(vals);
                    if (!parsed.success) {
                      toast.error('Formulaire invalide');
                      return;
                    }
                    saveMut.mutate(parsed.data);
                  })}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Prénom</Label>
                      <Input {...form.register('first_name')} />
                    </div>
                    <div>
                      <Label>Nom</Label>
                      <Input {...form.register('last_name')} />
                    </div>
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input {...form.register('phone')} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Ville</Label>
                      <Input {...form.register('city')} />
                    </div>
                    <div>
                      <Label>Pays</Label>
                      <Input {...form.register('country')} />
                    </div>
                  </div>
                  <Button type="submit" size="sm" disabled={saveMut.isPending}>
                    Enregistrer
                  </Button>
                </form>
                <div className="rounded-md border border-border p-2 text-xs">
                  <p className="mb-2 text-muted-foreground">Avatar</p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) avatarMut.mutate(f);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarMut.isPending}
                    >
                      {avatarMut.isPending ? 'Upload...' : 'Changer la photo'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="orders" className="pt-3">
                    <DataTable columns={orderCols} data={q.data?.orders || []} emptyTitle="Aucune commande" />
                  </TabsContent>
                  <TabsContent value="pay" className="pt-3">
                    <DataTable columns={payCols} data={q.data?.payments || []} emptyTitle="Aucun paiement" />
                  </TabsContent>
              <TabsContent value="dev" className="pt-3">
                <DataTable columns={devCols} data={q.data?.device_tokens || []} emptyTitle="Aucun device" />
              </TabsContent>
              <TabsContent value="act" className="pt-3 space-y-2 max-h-80 overflow-y-auto">
                {(q.data?.activities || []).map((a) => {
                  const act = String(a.action_type || '');
                  const desc =
                    act === 'product_view' ? 'Consultation produit' :
                    act === 'app_opened' ? 'Ouverture application' :
                    act === 'cart_add' ? 'Ajout au panier' :
                    act === 'review_posted' ? 'Avis publié' :
                    act === 'favorite_remove' ? 'Retrait favori' : act;
                  return (
                  <div key={String(a.id)} className="rounded-md border border-border/70 bg-muted/20 px-2 py-2 text-xs">
                    <span className="font-medium">{desc}</span>
                    <div className="text-[10px] text-muted-foreground">
                      {a.created_at ? format(new Date(String(a.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr }) : ''}
                    </div>
                  </div>
                )})}
                {!q.data?.activities?.length ? <p className="text-sm text-muted-foreground">Aucune activité</p> : null}
              </TabsContent>
              <TabsContent value="comportement" className="pt-3 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Événements (user_behavior)</h4>
                    <div className="space-y-1 text-xs">
                      {(q.data?.user_behaviors || []).map((b) => (
                        <div key={String(b.id)} className="border-b border-border pb-1">
                          <span className="font-medium">{String(b.action)}</span> · produit{' '}
                          <span className="font-mono">{String(b.product_id || '').slice(0, 8)}</span>
                          {b.created_at ? (
                            <span className="text-muted-foreground">
                              {' '}
                              — {format(new Date(String(b.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </span>
                          ) : null}
                        </div>
                      ))}
                      {!q.data?.user_behaviors?.length ? (
                        <p className="text-muted-foreground">Aucune entrée (migration ou tracking app requis).</p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Recommandations (aperçu API)</h4>
                    {recoQ.isLoading ? <Skeleton className="h-16 w-full" /> : null}
                    {recoQ.isError ? (
                      <p className="text-xs text-destructive">{(recoQ.error as Error).message}</p>
                    ) : (
                      <ul className="text-xs space-y-1 rounded-md border border-border/70 bg-muted/20 p-2">
                        {(recoQ.data || []).slice(0, 8).map((pr) => (
                          <li key={String(pr.id)} className="truncate">
                            <span className="font-medium">{String(pr.name || pr.id)}</span>
                            <span className="text-muted-foreground"> · {Number(pr.price || 0).toLocaleString('fr-FR')} FCFA</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => void qc.invalidateQueries({ queryKey: ['user-reco-preview', user?.id] })}
                    >
                      Rafraîchir l’aperçu
                    </Button>
                  </div>
                </TabsContent>
              <TabsContent value="role" className="pt-3 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Rôle actuel :</span>
                  <StatusBadge status={String(p.role || 'user')} />
                </div>
                <div className="space-y-2">
                  <Label>Nouveau rôle</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v ?? 'client')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">client</SelectItem>
                      <SelectItem value="driver">driver</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="superadmin">superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label>Motif (obligatoire)</Label>
                  <Input value={roleReason} onChange={(e) => setRoleReason(e.target.value)} placeholder="Raison du changement" />
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => roleMut.mutate({ role: newRole, role_change_reason: roleReason })}
                    disabled={roleReason.trim().length < 3}
                  >
                    Appliquer
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
                  {(q.data?.role_audit_samples || []).map((l) => (
                    <div key={String(l.id)} className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                      <div className="font-medium">{String(l.action_type)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {l.created_at
                          ? format(new Date(String(l.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr })
                          : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="sec" className="pt-3 space-y-3">
                <Button variant="destructive" size="sm" type="button" onClick={() => setRevokeOpen(true)}>
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  Révoquer toutes les sessions
                </Button>
                <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                  {(q.data?.sessions || []).map((s) => (
                    <div key={String(s.id)} className="border-b border-border pb-1">
                      {String(s.device_type || '—')} · {String(s.ip_address || '—')} ·{' '}
                      {s.revoked_at ? 'Révoquée' : 'Active'}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </Drawer>

      <ConfirmModal
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Révoquer toutes les sessions"
        description="Déconnexion de tous les appareils pour cet utilisateur."
        confirmationPhrase="REVOQUER"
        confirmLabel="Révoquer"
        onConfirm={() => void sessionsDel.mutateAsync()}
        variant="destructive"
      />

      <Sheet open={pushOpen} onOpenChange={setPushOpen}>
        <SheetContent side="right" className="w-full max-w-[320px] sm:max-w-[320px]">
          <SheetHeader>
            <SheetTitle>Push utilisateur</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Cible : {user && p ? displayName(p) : user?.id?.slice(0, 8) || '—'} — FCM.
            </p>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6 text-sm">
            <div>
              <Label>Titre</Label>
              <Input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
            </div>
            <div>
              <Label>Corps</Label>
              <Textarea rows={4} value={pushBody} onChange={(e) => setPushBody(e.target.value)} />
            </div>
            <div>
              <Label>Deep link (route)</Label>
              <Input className="font-mono text-xs" value={pushDeeplink} onChange={(e) => setPushDeeplink(e.target.value)} />
            </div>
            <Button
              className="w-full"
              type="button"
              disabled={pushMut.isPending || !pushTitle.trim() || !pushBody.trim()}
              onClick={() => pushMut.mutate()}
            >
              Envoyer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
