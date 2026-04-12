'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, UserPlus } from 'lucide-react';

import { DataTable } from '@/components/shared/DataTable';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AdminRow = Record<string, unknown> & {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_suspended?: boolean | null;
  last_seen_at?: string | null;
  is_online?: boolean | null;
};

const SECTIONS = ['products', 'orders', 'users', 'drivers', 'reports', 'settings', 'audit', 'notifications'] as const;
const ACTIONS = ['read', 'create', 'update', 'delete'] as const;

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%';
  let s = '';
  for (let i = 0; i < 14; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function UsersAdminSection() {
  const qc = useQueryClient();
  const [adminFilter, setAdminFilter] = React.useState<'all' | 'suspended' | 'active'>('all');
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'superadmin'>('admin');
  const [perm, setPerm] = React.useState<Record<string, Record<string, boolean>>>({});

  const q = useQuery({
    queryKey: ['admin-roles-list'],
    queryFn: async () => {
      const r = await fetch('/api/admin/roles', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      return j as { admins: AdminRow[] };
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const permissions: Record<string, Record<string, boolean>> = {};
      SECTIONS.forEach((s) => {
        permissions[s] = { ...perm[s] };
      });
      const r = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role,
          permissions,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec création');
      return j;
    },
    onSuccess: () => {
      toast.success('Admin créé');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin-roles-list'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredAdmins = React.useMemo(() => {
    const list = q.data?.admins || [];
    if (adminFilter === 'suspended') return list.filter((a) => a.is_suspended);
    if (adminFilter === 'active') return list.filter((a) => !a.is_suspended);
    return list;
  }, [q.data?.admins, adminFilter]);

  const columns = React.useMemo<ColumnDef<AdminRow>[]>(
    () => [
      {
        id: 'n',
        header: 'Admin',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <AvatarWithInitials
              name={[row.original.first_name, row.original.last_name].filter(Boolean).join(' ') || String(row.original.email)}
              src={row.original.avatar_url as string | null}
              size={32}
            />
            <span className="text-sm font-medium">
              {[row.original.first_name, row.original.last_name].filter(Boolean).join(' ') || row.original.email}
            </span>
          </div>
        ),
      },
      { id: 'em', header: 'Email', cell: ({ row }) => <span className="text-xs">{String(row.original.email)}</span> },
      { id: 'r', header: 'Rôle', cell: ({ row }) => <StatusBadge status={String(row.original.role || '')} /> },
      {
        id: 'st',
        header: 'Statut',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.is_suspended ? <StatusBadge status="suspended" /> : <StatusBadge status="active" />}
            {row.original.is_online ? (
              <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700">
                En ligne
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'seen',
        header: 'Dernière activité',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.last_seen_at
              ? formatDistanceToNow(new Date(String(row.original.last_seen_at)), { addSuffix: true, locale: fr })
              : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  const togglePerm = (section: string, action: string, v: boolean) => {
    setPerm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [action]: v },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filtre :</span>
          <Select value={adminFilter} onValueChange={(v) => setAdminFilter((v as typeof adminFilter) ?? 'all')}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les administrateurs</SelectItem>
              <SelectItem value="active">Comptes actifs</SelectItem>
              <SelectItem value="suspended">Suspendus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setPassword(randomPassword()); setOpen(true); }}>
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Créer admin
        </Button>
      </div>
      <Card className="p-0 overflow-hidden border-border">
        <DataTable
          columns={columns}
          data={filteredAdmins}
          isLoading={q.isLoading}
          emptyTitle="Aucun admin listé"
          emptyDescription="Créez un compte administrateur."
        />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel administrateur</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div>
              <Label>Mot de passe temporaire</Label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(password); toast.success('Copié'); }}>
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Prénom</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole((v as 'admin' | 'superadmin') ?? 'admin')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="superadmin">superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs font-semibold pt-2">Permissions</div>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-2 text-left">Section</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="p-2">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((s) => (
                    <tr key={s} className="border-t border-border">
                      <td className="p-2 capitalize">{s}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="p-2 text-center">
                          <input
                            type="checkbox"
                            className="rounded border border-input"
                            checked={Boolean(perm[s]?.[a])}
                            onChange={(e) => togglePerm(s, a, e.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => createMut.mutate()} disabled={createMut.isPending || !email || password.length < 8}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
