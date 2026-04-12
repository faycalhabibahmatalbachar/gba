'use client';

import * as React from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Activity, Copy, KeyRound, Loader2, LogOut, MessageSquare, Shield, ShieldAlert } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Drawer } from '@/components/shared/Drawer';
import { AvatarWithInitials } from '@/components/shared/AvatarWithInitials';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminPermissions } from '@/components/providers/AdminPermissionsProvider';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ADMIN_PAGE_ACCESS_KEYS,
  ADMIN_PERM_ACTIONS,
  ADMIN_PERM_SCOPES,
} from '@/app/(admin)/users/_lib/admin-permission-ui';
import { formatOutboundEmailError } from '@/lib/email/format-outbound-error';
import { adminProfileCopy } from './adminProfileCopy';

type Row = Record<string, unknown> & { id: string };

type Matrix = Record<string, Record<string, boolean>>;

function displayName(p: Record<string, unknown>) {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return a || String(p.email || '?');
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Création',
  update: 'Mise à jour',
  delete: 'Suppression',
  permission_change: 'Permissions',
};

const ENTITY_LABEL: Record<string, string> = {
  user: 'Utilisateur',
  message: 'Message',
  order: 'Commande',
  product: 'Produit',
  permission: 'Droits',
  conversation: 'Conversation',
};

function activitySummary(changes: unknown): string {
  if (!changes || typeof changes !== 'object') return '';
  const o = changes as Record<string, unknown>;
  const after = o.after as Record<string, unknown> | undefined;
  if (after && typeof after === 'object') {
    if (after.deleted === true) return 'Élément supprimé';
    if (after.read === true) return 'Marqué comme lu';
    if (after.important !== undefined) return 'Priorité mise à jour';
    if (typeof after.message_type === 'string')
      return `Message · ${String(after.message_type)}`;
    if (typeof after.conversation_id === 'string') return 'Conversation liée';
    const keys = Object.keys(after).filter((k) => after[k] != null);
    if (keys.length && keys.length <= 4) return keys.map((k) => `${k}`).join(' · ');
    if (keys.length > 4) return `${keys.length} changements`;
  }
  return 'Activité enregistrée';
}

function ActivityEntry({ item }: { item: Record<string, unknown> }) {
  const at = String(item.action_type || '');
  const et = String(item.entity_type || '');
  const title = [ACTION_LABEL[at] || at, ENTITY_LABEL[et] || et].filter(Boolean).join(' · ');
  return (
    <div className="rounded-lg border border-border/80 bg-gradient-to-br from-muted/40 to-transparent p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground">{title || 'Événement'}</p>
          <p className="text-xs text-muted-foreground">
            {item.created_at
              ? format(new Date(String(item.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr })
              : ''}
          </p>
          <p className="text-xs text-foreground/90 leading-relaxed">{activitySummary(item.changes)}</p>
        </div>
        <Activity className="h-4 w-4 shrink-0 text-[var(--gba-brand)] opacity-80" />
      </div>
    </div>
  );
}

export interface AdminProfileSheetProps {
  user: Row | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isSuperAdminTarget: boolean;
}

export function AdminProfileSheet({ user, open, onOpenChange, isSuperAdminTarget }: AdminProfileSheetProps) {
  const qc = useQueryClient();
  const { superadmin: viewerIsSuper } = useAdminPermissions();
  const [tab, setTab] = React.useState('presence');
  const [permDraft, setPermDraft] = React.useState<Matrix>({});
  const [pageDraft, setPageDraft] = React.useState<Record<string, boolean>>({});
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const [cloneSourceId, setCloneSourceId] = React.useState<string>('');

  const [confirmSuspend, setConfirmSuspend] = React.useState(false);
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [resetLinkDialog, setResetLinkDialog] = React.useState<{
    link: string;
    emailSent: boolean;
    emailError?: string | null;
  } | null>(null);

  const profileQ = useQuery({
    queryKey: ['admin-command-profile', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/profile`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : adminProfileCopy.errors.loadProfile);
      return j as {
        profile: Record<string, unknown>;
        presence: Record<string, unknown>;
        stats: Record<string, unknown>;
      };
    },
    enabled: open && !!user?.id,
  });

  const presenceQ = useQuery({
    queryKey: ['admin-command-presence', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/presence-stats`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur présence');
      return j as {
        chart_30d: { date: string; minutes: number }[];
        heatmap_24x7: Record<string, number>;
        top_pages: { path: string; visits: number }[];
        note: string | null;
      };
    },
    enabled: open && !!user?.id && tab === 'presence',
  });

  const permQ = useQuery({
    queryKey: ['admin-command-perms', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/permissions`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur permissions');
      return j as { matrix: Matrix | null; page_access: Record<string, boolean> };
    },
    enabled: open && !!user?.id && tab === 'permissions',
  });

  React.useEffect(() => {
    if (!permQ.data) return;
    const m = permQ.data.matrix || {};
    const next: Matrix = {};
    for (const s of ADMIN_PERM_SCOPES) {
      next[s] = {};
      for (const a of ADMIN_PERM_ACTIONS) {
        next[s][a] = Boolean(m[s]?.[a]);
      }
    }
    setPermDraft(next);
    setPageDraft(permQ.data.page_access || {});
  }, [permQ.data]);

  const sessionCfgQ = useQuery({
    queryKey: ['admin-session-config', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/session-config`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Config');
      return j as { config: Record<string, unknown> };
    },
    enabled: open && !!user?.id && (tab === 'security' || tab === 'profile'),
  });

  const loginHistQ = useQuery({
    queryKey: ['admin-login-history', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/login-history`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Historique');
      return j as { items: Record<string, unknown>[] };
    },
    enabled: open && !!user?.id && tab === 'security',
  });

  const sessionsQ = useQuery({
    queryKey: ['admin-command-sessions', user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/sessions`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Sessions');
      return j as { active: Record<string, unknown>[]; history: Record<string, unknown>[] };
    },
    enabled: open && !!user?.id && tab === 'sessions',
  });

  const activityQ = useInfiniteQuery({
    queryKey: ['admin-activity', user?.id],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const u = new URL(`/api/admin/${user!.id}/activity`, window.location.origin);
      u.searchParams.set('limit', '40');
      if (pageParam) u.searchParams.set('cursor', pageParam);
      const r = await fetch(u.toString(), { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Audit');
      return j as { items: Record<string, unknown>[]; next_cursor: string | null };
    },
    getNextPageParam: (last) => last.next_cursor,
    enabled: open && !!user?.id && tab === 'actions',
  });

  const activityItems = activityQ.data?.pages.flatMap((p) => p.items) ?? [];
  const actParentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: activityItems.length,
    getScrollElement: () => actParentRef.current,
    estimateSize: () => 108,
    overscan: 8,
  });

  const adminsQ = useQuery({
    queryKey: ['admin-roles-list'],
    queryFn: async () => {
      const r = await fetch('/api/admin/roles', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Admins');
      return j as { admins: { id: string; email?: string; first_name?: string; last_name?: string }[] };
    },
    enabled: cloneOpen,
  });

  const profileForm = useForm({
    defaultValues: { first_name: '', last_name: '', phone: '', internal_note: '' },
  });

  React.useEffect(() => {
    const p = profileQ.data?.profile;
    const cfg = sessionCfgQ.data?.config;
    if (!p) return;
    profileForm.reset({
      first_name: String(p.first_name || ''),
      last_name: String(p.last_name || ''),
      phone: String(p.phone || ''),
      internal_note: typeof cfg?.internal_note === 'string' ? cfg.internal_note : '',
    });
  }, [profileQ.data?.profile, sessionCfgQ.data?.config, profileForm]);

  const saveProfileMut = useMutation({
    mutationFn: async (vals: { first_name: string; last_name: string; phone: string; internal_note: string }) => {
      const r = await fetch(`/api/users/${user!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: vals.first_name,
          last_name: vals.last_name,
          phone: vals.phone,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec profil');
      const r2 = await fetch(`/api/admin/${user!.id}/session-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ internal_note: vals.internal_note || null }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(typeof j2.error === 'string' ? j2.error : 'Échec note interne');
      return { j, j2 };
    },
    onSuccess: () => {
      toast.success('Profil enregistré');
      void qc.invalidateQueries({ queryKey: ['admin-command-profile', user?.id] });
      void qc.invalidateQueries({ queryKey: ['admin-session-config', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePermMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matrix: permDraft, page_access: pageDraft }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? JSON.stringify(j.error) : 'Sauvegarde refusée');
    },
    onSuccess: () => {
      toast.success('Permissions mises à jour');
      void qc.invalidateQueries({ queryKey: ['admin-command-perms', user?.id] });
      void qc.invalidateQueries({ queryKey: ['me-admin-permissions'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloneMut = useMutation({
    mutationFn: async () => {
      if (!cloneSourceId) throw new Error('Choisir un administrateur source');
      const r = await fetch(`/api/admin/${cloneSourceId}/permissions`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Lecture source');
      const matrix = j.matrix as Matrix | null;
      const page_access = (j.page_access || {}) as Record<string, boolean>;
      const r2 = await fetch(`/api/admin/${user!.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          matrix: matrix || {},
          page_access,
        }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(typeof j2.error === 'string' ? JSON.stringify(j2.error) : 'Copie refusée');
    },
    onSuccess: () => {
      toast.success('Permissions clonées');
      setCloneOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin-command-perms', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspendMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec');
    },
    onSuccess: () => {
      toast.success('Compte suspendu');
      setConfirmSuspend(false);
      void qc.invalidateQueries({ queryKey: ['admin-command-profile', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/reactivate`, { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec');
    },
    onSuccess: () => {
      toast.success('Compte réactivé');
      void qc.invalidateQueries({ queryKey: ['admin-command-profile', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/revoke-sessions`, { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec');
    },
    onSuccess: () => {
      toast.success('Sessions révoquées');
      setConfirmRevoke(false);
      void qc.invalidateQueries({ queryKey: ['admin-command-sessions', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/${user!.id}/password-reset`, { method: 'POST', credentials: 'include' });
      const j = (await r.json()) as {
        error?: string;
        action_link?: string | null;
        email_sent?: boolean;
        email_error?: string | null;
      };
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec');
      return j;
    },
    onSuccess: (data) => {
      if (data.email_sent) toast.success('Email de réinitialisation envoyé');
      else toast.message('Lien généré — copiez-le ou activez l’envoi e-mail.');
      if (data.email_error) toast.message(data.email_error);
      setConfirmReset(false);
      if (data.action_link) {
        setResetLinkDialog({
          link: data.action_link,
          emailSent: Boolean(data.email_sent),
          emailError: data.email_error ?? null,
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessionCfgMut = useMutation({
    mutationFn: async (payload: { session_ttl_days?: number }) => {
      const r = await fetch(`/api/admin/${user!.id}/session-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Échec');
    },
    onSuccess: () => {
      toast.success('Paramètres enregistrés');
      void qc.invalidateQueries({ queryKey: ['admin-session-config', user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = profileQ.data?.profile;
  const stats = profileQ.data?.stats as Record<string, unknown> | undefined;
  const pres = profileQ.data?.presence as Record<string, unknown> | undefined;

  const heatMax = React.useMemo(() => {
    const h = presenceQ.data?.heatmap_24x7 || {};
    let m = 1;
    for (const v of Object.values(h)) m = Math.max(m, v);
    return m;
  }, [presenceQ.data?.heatmap_24x7]);

  if (!user) return null;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title={p ? displayName(p) : adminProfileCopy.drawerTitle}
        description={p ? String(p.email || '') : undefined}
        className="!max-w-[720px] sm:!w-[720px]"
      >
        {profileQ.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : profileQ.isError ? (
          <p className="text-sm text-destructive">{(profileQ.error as Error).message}</p>
        ) : p ? (
          <div className="space-y-4">
            <div
              className={cn(
                'relative overflow-hidden rounded-xl border border-border p-4',
                'bg-gradient-to-br from-[color-mix(in_srgb,var(--gba-brand)_20%,transparent)] to-slate-900/50',
              )}
            >
              <div className="flex flex-wrap items-start gap-4">
                <AvatarWithInitials src={p.avatar_url as string | null} name={displayName(p)} size={72} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={String(p.role || 'admin')} />
                    <StatusBadge status={p.is_suspended ? 'suspended' : 'active'} />
                    {isSuperAdminTarget ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="h-3 w-3" />
                        Super admin
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      {pres?.is_online ? (
                        <span className="text-emerald-600 font-medium">{adminProfileCopy.header.online}</span>
                      ) : (
                        <span>{adminProfileCopy.header.offline}</span>
                      )}
                      {pres?.last_ip ? ` · IP ${String(pres.last_ip)}` : ''}
                    </p>
                    <p className="truncate">{String(pres?.browser_line || '')}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    { label: adminProfileCopy.header.chipMinutes, value: `${Number(stats?.connected_minutes_month ?? 0)} min` },
                    { label: adminProfileCopy.header.chipLoginsOk, value: String(stats?.logins_ok_30d ?? 0) },
                    { label: adminProfileCopy.header.chipLoginsFail, value: String(stats?.logins_fail_30d ?? 0) },
                    { label: adminProfileCopy.header.chipScore, value: `${Number(stats?.security_score ?? 0)}/100` },
                  ] as const
                ).map((c) => (
                  <div key={c.label} className="rounded-lg border border-white/10 bg-background/40 px-2 py-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-semibold tabular-nums">{c.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/messages?user=${encodeURIComponent(String(user.id))}`}
                  className={cn(buttonVariants({ size: 'sm', variant: 'secondary' }), 'inline-flex items-center gap-1')}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {adminProfileCopy.header.quickMessage}
                </Link>
                <Button size="sm" variant="outline" type="button" onClick={() => setConfirmReset(true)}>
                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                  {adminProfileCopy.header.resetPassword}
                </Button>
                <Button size="sm" variant="outline" type="button" onClick={() => setConfirmRevoke(true)}>
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  {adminProfileCopy.header.revokeSessions}
                </Button>
                {viewerIsSuper && !isSuperAdminTarget ? (
                  <>
                    {p.is_suspended ? (
                      <Button size="sm" variant="secondary" type="button" onClick={() => reactivateMut.mutate()}>
                        {adminProfileCopy.header.reactivate}
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" type="button" onClick={() => setConfirmSuspend(true)}>
                        {adminProfileCopy.header.suspend}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" type="button" onClick={() => setCloneOpen(true)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      {adminProfileCopy.header.clonePerms}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="presence">{adminProfileCopy.tabs.presence}</TabsTrigger>
                <TabsTrigger value="actions">{adminProfileCopy.tabs.actions}</TabsTrigger>
                <TabsTrigger value="permissions">{adminProfileCopy.tabs.permissions}</TabsTrigger>
                <TabsTrigger value="security">{adminProfileCopy.tabs.security}</TabsTrigger>
                <TabsTrigger value="sessions">{adminProfileCopy.tabs.sessions}</TabsTrigger>
                <TabsTrigger value="profile">{adminProfileCopy.tabs.profile}</TabsTrigger>
              </TabsList>

              <TabsContent value="presence" className="space-y-4 pt-3">
                {presenceQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
                {presenceQ.data ? (
                  <>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{adminProfileCopy.presence.chartTitle}</p>
                      <div className="h-[200px] w-full min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={presenceQ.data.chart_30d}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="minutes" stroke="var(--gba-brand)" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{adminProfileCopy.presence.heatmapTitle}</p>
                      <div className="overflow-x-auto">
                        <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(24, minmax(0,1fr))` }}>
                          {Array.from({ length: 24 * 7 }).map((_, i) => {
                            const day = Math.floor(i / 24);
                            const hour = i % 24;
                            const key = `${day}-${hour}`;
                            const v = presenceQ.data.heatmap_24x7[key] || 0;
                            const intensity = heatMax ? v / heatMax : 0;
                            return (
                              <div
                                key={key}
                                title={`J${day} ${hour}h — ${v}`}
                                className="h-4 rounded-[2px] bg-muted"
                                style={{ opacity: 0.2 + intensity * 0.8 }}
                              />
                            );
                          })}
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">{presenceQ.data.note || adminProfileCopy.presence.emptyHeatmap}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{adminProfileCopy.presence.topPages}</p>
                      <ul className="space-y-1 text-xs">
                        {(presenceQ.data.top_pages || []).map((x) => (
                          <li key={x.path} className="flex justify-between gap-2 border-b border-border/60 py-1">
                            <span className="font-mono truncate">{x.path}</span>
                            <span className="tabular-nums text-muted-foreground">{x.visits}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}
              </TabsContent>

              <TabsContent value="actions" className="pt-3">
                <div ref={actParentRef} className="h-[420px] overflow-auto rounded-md border border-border">
                  {activityQ.isLoading ? <Skeleton className="h-32 w-full" /> : null}
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((vi) => {
                      const item = activityItems[vi.index];
                      return (
                        <div
                          key={vi.key}
                          className="absolute left-0 top-0 w-full border-b border-border/60 px-2 py-2"
                          style={{ transform: `translateY(${vi.start}px)` }}
                        >
                          <ActivityEntry item={item as Record<string, unknown>} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                {!activityItems.length && !activityQ.isLoading ? (
                  <p className="text-sm text-muted-foreground">{adminProfileCopy.actions.empty}</p>
                ) : null}
                {activityQ.hasNextPage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={activityQ.isFetchingNextPage}
                    onClick={() => void activityQ.fetchNextPage()}
                  >
                    {activityQ.isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        …
                      </>
                    ) : (
                      adminProfileCopy.actions.loadMore
                    )}
                  </Button>
                ) : null}
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4 pt-3">
                {!viewerIsSuper ? (
                  <p className="text-sm text-muted-foreground">{adminProfileCopy.permissions.superadminOnly}</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold">{adminProfileCopy.permissions.matrixTitle}</p>
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="p-2 text-left">Section</th>
                            {ADMIN_PERM_ACTIONS.map((a) => (
                              <th key={a} className="p-2">
                                {a}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ADMIN_PERM_SCOPES.map((s) => (
                            <tr key={s} className="border-t border-border">
                              <td className="p-2 capitalize">{s}</td>
                              {ADMIN_PERM_ACTIONS.map((a) => (
                                <td key={a} className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    className="rounded border border-input"
                                    checked={Boolean(permDraft[s]?.[a])}
                                    onChange={(e) =>
                                      setPermDraft((prev) => ({
                                        ...prev,
                                        [s]: { ...prev[s], [a]: e.target.checked },
                                      }))
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs font-semibold">{adminProfileCopy.permissions.pagesTitle}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ADMIN_PAGE_ACCESS_KEYS.map((pk) => (
                        <label key={pk.path} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="rounded border border-input"
                            checked={Boolean(pageDraft[pk.path])}
                            onChange={(e) =>
                              setPageDraft((prev) => ({ ...prev, [pk.path]: e.target.checked }))
                            }
                          />
                          {pk.label}
                        </label>
                      ))}
                    </div>
                    <Button type="button" size="sm" onClick={() => savePermMut.mutate()} disabled={savePermMut.isPending}>
                      {savePermMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
                      {adminProfileCopy.permissions.save}
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="security" className="space-y-4 pt-3">
                <div>
                  <p className="mb-2 text-xs font-medium">{adminProfileCopy.security.loginHistory}</p>
                  {loginHistQ.isLoading ? <Skeleton className="h-24 w-full" /> : null}
                  <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
                    {(loginHistQ.data?.items || []).map((row) => (
                      <div key={String(row.id)} className="flex justify-between gap-2 border-b border-border/60 py-1">
                        <span>{row.success === false ? 'Échec' : 'OK'}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{String(row.ip_address || '—')}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {row.created_at
                            ? format(new Date(String(row.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr })
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {viewerIsSuper ? (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <Label>{adminProfileCopy.security.sessionConfig}</Label>
                    <p className="text-[10px] text-muted-foreground">{adminProfileCopy.security.sessionConfigHint}</p>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className="max-w-[120px]"
                      defaultValue={Number(sessionCfgQ.data?.config?.session_ttl_days ?? 7)}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) sessionCfgMut.mutate({ session_ttl_days: n });
                      }}
                    />
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="sessions" className="space-y-3 pt-3">
                {sessionsQ.isLoading ? <Skeleton className="h-24 w-full" /> : null}
                <div>
                  <p className="mb-1 text-xs font-medium">{adminProfileCopy.sessions.active}</p>
                  <ul className="space-y-1 text-xs">
                    {(sessionsQ.data?.active || []).map((s) => (
                      <li key={String(s.id)} className="font-mono">
                        {String(s.device_type)} · {String(s.ip_address || '—')}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium">{adminProfileCopy.sessions.history}</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {(sessionsQ.data?.history || []).map((s) => (
                      <li key={String(s.id)}>
                        {String(s.started_at || s.created_at || '')} — {String(s.device_type || '')}
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="profile" className="space-y-3 pt-3">
                <form
                  className="grid gap-2"
                  onSubmit={profileForm.handleSubmit((vals) => saveProfileMut.mutate(vals))}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Prénom</Label>
                      <Input {...profileForm.register('first_name')} />
                    </div>
                    <div>
                      <Label>Nom</Label>
                      <Input {...profileForm.register('last_name')} />
                    </div>
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input {...profileForm.register('phone')} />
                  </div>
                  <div>
                    <Label>{adminProfileCopy.profile.internalNote}</Label>
                    <Textarea rows={3} {...profileForm.register('internal_note')} />
                  </div>
                  <Button type="submit" size="sm" disabled={saveProfileMut.isPending}>
                    {adminProfileCopy.permissions.save}
                  </Button>
                </form>
                <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">{adminProfileCopy.profile.readOnly}</p>
                  <p>UUID : {String(p.id)}</p>
                  <p>
                    Créé le :{' '}
                    {p.created_at ? format(new Date(String(p.created_at)), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </Drawer>

      <ConfirmModal
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title="Suspendre le compte"
        description="Le compte ne pourra plus se connecter jusqu’à réactivation."
        confirmationPhrase={adminProfileCopy.confirm.suspendPhrase}
        confirmLabel="Suspendre"
        onConfirm={() => void suspendMut.mutateAsync()}
        variant="destructive"
      />
      <ConfirmModal
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Révoquer les sessions"
        description="Tous les appareils seront déconnectés."
        confirmationPhrase={adminProfileCopy.confirm.revokePhrase}
        confirmLabel="Révoquer"
        onConfirm={() => void revokeMut.mutateAsync()}
        variant="destructive"
      />
      <ConfirmModal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Réinitialiser le mot de passe"
        description="Un lien de récupération sera généré et envoyé par email si configuré."
        confirmationPhrase={adminProfileCopy.confirm.resetPhrase}
        confirmLabel="Envoyer"
        onConfirm={() => void resetMut.mutateAsync()}
      />

      <Dialog
        open={Boolean(resetLinkDialog)}
        onOpenChange={(o) => {
          if (!o) setResetLinkDialog(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Réinitialisation du mot de passe</DialogTitle>
            <DialogDescription>
              {resetLinkDialog?.emailSent
                ? 'Un email avec le lien a été envoyé (si la boîte du destinataire accepte l’expéditeur).'
                : 'Copiez le lien ci-dessous ou configurez l’envoi e-mail (ENABLE_OUTBOUND_EMAIL).'}
            </DialogDescription>
          </DialogHeader>
          {resetLinkDialog?.emailError ? (
            <p className="text-sm text-destructive">{formatOutboundEmailError(resetLinkDialog.emailError)}</p>
          ) : null}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Lien de récupération</Label>
            <ScrollArea className="max-h-[min(200px,40vh)] w-full rounded-md border border-border">
              <p className="break-all p-3 font-mono text-[11px] leading-relaxed">{resetLinkDialog?.link || ''}</p>
            </ScrollArea>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setResetLinkDialog(null)}>
              Fermer
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!resetLinkDialog?.link) return;
                try {
                  await navigator.clipboard.writeText(resetLinkDialog.link);
                  toast.success('Lien copié');
                } catch {
                  toast.error('Copie impossible');
                }
              }}
            >
              Copier le lien
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adminProfileCopy.permissions.cloneTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{adminProfileCopy.permissions.cloneHint}</p>
          <Select value={cloneSourceId} onValueChange={(v) => setCloneSourceId(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Administrateur source" />
            </SelectTrigger>
            <SelectContent>
              {(adminsQ.data?.admins || [])
                .filter((a) => a.id !== user.id)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {[a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || a.id.slice(0, 8)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCloneOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => cloneMut.mutate()} disabled={cloneMut.isPending || !cloneSourceId}>
              {cloneMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cloner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
