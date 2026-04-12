'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Bell, Clock, ExternalLink, LogOut, MapPin, Smartphone, Truck } from 'lucide-react';

import { Drawer } from '@/components/shared/Drawer';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  device_tokens: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  role_audit_samples: Record<string, unknown>[];
};

function displayName(p: Record<string, unknown>) {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return a || String(p.email || '?');
}

export interface UserDriverSheetProps {
  user: Row | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Fiche livreur : pas de tunnel e-commerce ; lien vers la liste livreurs. */
export function UserDriverSheet({ user, open, onOpenChange }: UserDriverSheetProps) {
  const qc = useQueryClient();
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [pushOpen, setPushOpen] = React.useState(false);
  const [pushTitle, setPushTitle] = React.useState('Message livreur');
  const [pushBody, setPushBody] = React.useState('');
  const [pushDeeplink, setPushDeeplink] = React.useState('/driver/home');
  const [tabVal, setTabVal] = React.useState('profil');
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);

  const q = useQuery({
    queryKey: ['user-detail', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/users/${user!.id}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      return j as Detail;
    },
    enabled: open && !!user?.id,
  });

  const form = useForm({
    defaultValues: { first_name: '', last_name: '', phone: '', city: '', country: '' },
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
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec');
      return j;
    },
    onSuccess: () => {
      toast.success('Profil mis à jour');
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
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec');
      return j;
    },
    onSuccess: () => {
      toast.success('Token invalidé');
      void qc.invalidateQueries({ queryKey: ['user-detail', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
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
          data: { route: pushDeeplink.trim() || '/driver/home', source: 'admin_driver_sheet' },
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
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.is_valid === false ? 'suspended' : 'active'}
            customLabel={row.original.is_valid === false ? 'Non' : 'Oui'}
          />
        ),
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
  const driversLink = `/drivers?q=${encodeURIComponent(String(p?.email || '').trim())}`;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title={user && p ? displayName(p) : 'Livreur'}
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
                  <StatusBadge status="driver" />
                  <StatusBadge status={p.is_suspended ? 'suspended' : 'active'} />
                  {p.is_available !== undefined && p.is_available !== null ? (
                    <StatusBadge
                      status={p.is_available ? 'active' : 'offline'}
                      customLabel={p.is_available ? 'Disponible' : 'Indisponible'}
                    />
                  ) : null}
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
              style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), transparent)' }}
            >
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                {(
                  [
                    { icon: Truck, label: 'Rôle', value: 'Livreur' },
                    { icon: Smartphone, label: 'Devices', value: String(q.data?.stats?.device_tokens_count ?? 0) },
                    {
                      icon: Clock,
                      label: 'Dernière activité',
                      value: p.last_sign_in_at
                        ? formatDistanceToNow(new Date(String(p.last_sign_in_at)), { locale: fr })
                        : '—',
                    },
                    { icon: MapPin, label: 'Zone', value: [p.city, p.country].filter(Boolean).join(', ') || '—' },
                  ] as const
                ).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                    <div className="rounded-md bg-background p-1.5">
                      <Icon className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="truncate text-xs font-semibold">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={driversLink}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex gap-1')}
              >
                Liste livreurs
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setPushOpen(true)}>
                <Bell className="h-3.5 w-3.5" />
                Envoyer push
              </Button>
            </div>

            <Tabs value={tabVal} onValueChange={setTabVal}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="profil">Profil</TabsTrigger>
                <TabsTrigger value="dev">Devices</TabsTrigger>
                <TabsTrigger value="act">Activité</TabsTrigger>
                <TabsTrigger value="sec">Sessions</TabsTrigger>
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
              <TabsContent value="dev" className="pt-3">
                <DataTable columns={devCols} data={q.data?.device_tokens || []} emptyTitle="Aucun device" />
              </TabsContent>
              <TabsContent value="act" className="pt-3 space-y-2 max-h-80 overflow-y-auto">
                {(q.data?.activities || []).map((a) => {
                  const act = String(a.action_type || '');
                  const desc =
                    act === 'product_view'
                      ? 'Consultation produit'
                      : act === 'app_opened'
                        ? 'Ouverture application'
                        : act === 'cart_add'
                          ? 'Ajout au panier'
                          : act === 'review_posted'
                            ? 'Avis publié'
                            : act === 'favorite_remove'
                              ? 'Retrait favori'
                              : act;
                  return (
                    <div key={String(a.id)} className="rounded-md border border-border/70 bg-muted/20 px-2 py-2 text-xs">
                      <span className="font-medium">{desc}</span>
                      <div className="text-[10px] text-muted-foreground">
                        {a.created_at
                          ? format(new Date(String(a.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr })
                          : ''}
                      </div>
                    </div>
                  );
                })}
                {!q.data?.activities?.length ? <p className="text-sm text-muted-foreground">Aucune activité</p> : null}
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
        description="Déconnexion de tous les appareils pour ce livreur."
        confirmationPhrase="REVOQUER"
        confirmLabel="Révoquer"
        onConfirm={() => void sessionsDel.mutateAsync()}
        variant="destructive"
      />

      <Sheet open={pushOpen} onOpenChange={setPushOpen}>
        <SheetContent side="right" className="w-full max-w-[320px] sm:max-w-[320px]">
          <SheetHeader>
            <SheetTitle>Push livreur</SheetTitle>
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
