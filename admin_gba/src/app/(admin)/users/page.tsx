'use client';

import { Suspense, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import { fetchUsers, fetchUsersKpis, type ProfileRow } from '@/lib/services/users';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { KpiCard } from '@/components/ui/custom/KpiCard';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Users, UserCheck, UserX, ShoppingCart, Search,
  ChevronLeft, ChevronRight, RefreshCw, Mail, Phone, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PAGE_SIZE = 20;

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM yyyy', { locale: fr }); } catch { return iso; }
}

async function suspendUser(id: string) {
  const { error } = await supabase.from('profiles').update({ is_suspended: true }).eq('id', id);
  if (error) throw error;
}
async function unsuspendUser(id: string) {
  const { error } = await supabase.from('profiles').update({ is_suspended: false }).eq('id', id);
  if (error) throw error;
}

function UsersContent() {
  const qc = useQueryClient();
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null);
  const getDisplayName = (u: ProfileRow) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '?';
  const [confirmAction, setConfirmAction] = useState<{ type: 'suspend' | 'unsuspend'; user: ProfileRow } | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', { search, page }],
    queryFn: () => fetchUsers({ page, pageSize: PAGE_SIZE, search: search || undefined }),
    staleTime: 20_000,
  });

  const kpisQuery = useQuery({
    queryKey: ['users-kpis'],
    queryFn: () => fetchUsersKpis(),
    staleTime: 60_000,
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) => suspend ? suspendUser(id) : unsuspendUser(id),
    onSuccess: (_, { suspend }) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users-kpis'] });
      setConfirmAction(null);
      setSelectedUser(null);
      toast.success(suspend ? 'Compte suspendu' : 'Compte réactivé');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const users = usersQuery.data?.data || [];
  const total = usersQuery.data?.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const kpis = kpisQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        subtitle={`${total} client${total !== 1 ? 's' : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['users-kpis'] }); }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={kpis?.total ?? 0} icon={<Users className="h-4 w-4" />} iconBg="rgba(99,102,241,0.12)" iconColor="#6366F1" loading={kpisQuery.isLoading} />
        <KpiCard label="Clients" value={kpis?.clients ?? 0} icon={<UserCheck className="h-4 w-4" />} iconBg="rgba(16,185,129,0.12)" iconColor="#10B981" loading={kpisQuery.isLoading} />
        <KpiCard label="Livreurs" value={kpis?.drivers ?? 0} icon={<UserX className="h-4 w-4" />} iconBg="rgba(139,92,246,0.12)" iconColor="#8B5CF6" loading={kpisQuery.isLoading} />
        <KpiCard label="Admins" value={kpis?.admins ?? 0} icon={<ShoppingCart className="h-4 w-4" />} iconBg="rgba(245,158,11,0.12)" iconColor="#F59E0B" loading={kpisQuery.isLoading} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher nom, email, téléphone..."
          value={search}
          onChange={e => { setSearch(e.target.value || null); setPage(1); }}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Téléphone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden xl:table-cell">Inscrit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersQuery.isLoading && [...Array(8)].map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-9 w-full" /></td></tr>
              ))}
              {!usersQuery.isLoading && users.map(u => (
                <tr
                  key={u.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedUser(u)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {getDisplayName(u)[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[180px]">{getDisplayName(u)}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {u.phone || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {(u as any).is_suspended ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        Suspendu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Actif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden xl:table-cell">
                    {u.created_at ? fmtDate(u.created_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {(u as any).is_suspended ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => setConfirmAction({ type: 'unsuspend', user: u })}>
                        Réactiver
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                        onClick={() => setConfirmAction({ type: 'suspend', user: u })}>
                        Suspendre
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!usersQuery.isLoading && users.length === 0 && (
                <tr><td colSpan={5}>
                  <EmptyState icon={<Users className="h-8 w-8" />} title="Aucun client" description={search ? 'Aucun résultat.' : 'Les clients apparaîtront ici.'} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Page {page} / {totalPages} — {total} clients</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* User detail drawer */}
      <Sheet open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="text-sm">Profil client</SheetTitle>
          </SheetHeader>
          {selectedUser && (
            <div className="p-4 space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl font-bold text-primary">
                    {getDisplayName(selectedUser)[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{getDisplayName(selectedUser)}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{selectedUser.email || '—'}</span>
                </div>
                {selectedUser.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{selectedUser.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Inscrit le {selectedUser.created_at ? fmtDate(selectedUser.created_at) : '—'}</span>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2 pt-2">
                {(selectedUser as any).is_suspended ? (
                  <Button
                    className="flex-1"
                    onClick={() => setConfirmAction({ type: 'unsuspend', user: selectedUser })}
                    disabled={suspendMut.isPending}
                  >
                    Réactiver le compte
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setConfirmAction({ type: 'suspend', user: selectedUser })}
                    disabled={suspendMut.isPending}
                  >
                    Suspendre le compte
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm suspend/unsuspend */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={open => !open && setConfirmAction(null)}
        title={confirmAction ? (confirmAction.type === 'suspend' ? `Suspendre ce compte?` : `Réactiver ce compte?`) : ''}
        description={confirmAction?.type === 'suspend' ? 'Ce client ne pourra plus se connecter ni passer de commandes.' : 'Ce client pourra à nouveau utiliser son compte.'}
        confirmLabel={confirmAction?.type === 'suspend' ? 'Suspendre' : 'Réactiver'}
        variant={confirmAction?.type === 'suspend' ? 'destructive' : 'default'}
        loading={suspendMut.isPending}
        onConfirm={() => confirmAction && suspendMut.mutate({ id: confirmAction.user.id, suspend: confirmAction.type === 'suspend' })}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <UsersContent />
    </Suspense>
  );
}
