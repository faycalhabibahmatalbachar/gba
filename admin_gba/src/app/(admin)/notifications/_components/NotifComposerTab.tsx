'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { PhoneNotifPreview } from '@/components/ui/custom/PhoneNotifPreview';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { Send, Users, User, AlertTriangle, Trash2, Plus, MessageSquare } from 'lucide-react';
import type { PushDraft, SegmentFiltersState } from './notif-types';

const MAX_SYNC = 400;

type Props = {
  draftFromTemplate: PushDraft | null;
  onConsumeDraft?: () => void;
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const t = await r.text();
  let body: unknown;
  try {
    body = t ? JSON.parse(t) : {};
  } catch {
    throw new Error(t || r.statusText);
  }
  if (!r.ok) {
    const err = body as { error?: unknown };
    throw new Error(typeof err.error === 'string' ? err.error : r.statusText);
  }
  return body as T;
}

export function NotifComposerTab({ draftFromTemplate, onConsumeDraft }: Props) {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const preUser = searchParams.get('user');
  const preTitle = searchParams.get('title');
  const preBody = searchParams.get('body');
  const preDeeplink = searchParams.get('deeplink');
  const contextSrc = searchParams.get('src') || 'admin';
  const gpsLat = searchParams.get('gps_lat');
  const gpsLng = searchParams.get('gps_lng');

  const [mode, setMode] = React.useState<'individual' | 'segment' | 'all'>('individual');
  const [userQuery, setUserQuery] = React.useState('');
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(preUser);
  const [selectedTokens, setSelectedTokens] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState('Message administrateur');
  const [body, setBody] = React.useState('');
  const [deeplink, setDeeplink] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [filters, setFilters] = React.useState<SegmentFiltersState>({
    role: '',
    country: '',
    platform: 'all',
    valid_only: true,
  });
  const [scheduledLocal, setScheduledLocal] = React.useState('');
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [confirmAllOpen, setConfirmAllOpen] = React.useState(false);
  const [channelPush, setChannelPush] = React.useState(true);
  const [channelInApp, setChannelInApp] = React.useState(false);

  const [schedDialog, setSchedDialog] = React.useState(false);
  const [schedName, setSchedName] = React.useState('');
  const [schedTitle, setSchedTitle] = React.useState('');
  const [schedBody, setSchedBody] = React.useState('');
  const [schedImage, setSchedImage] = React.useState('');
  const [schedFreq, setSchedFreq] = React.useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [schedDow, setSchedDow] = React.useState('1');
  const [schedDom, setSchedDom] = React.useState('1');
  const [schedTime, setSchedTime] = React.useState('09:00');
  const [schedEmails, setSchedEmails] = React.useState('');
  const [savedSegmentPick, setSavedSegmentPick] = React.useState('');
  const [saveSegmentName, setSaveSegmentName] = React.useState('');

  React.useEffect(() => {
    if (preUser) setSelectedUserId(preUser);
  }, [preUser]);

  React.useEffect(() => {
    if (preTitle) setTitle(preTitle);
  }, [preTitle]);

  React.useEffect(() => {
    if (preBody) setBody(preBody);
  }, [preBody]);

  React.useEffect(() => {
    if (preDeeplink) setDeeplink(preDeeplink);
  }, [preDeeplink]);

  React.useEffect(() => {
    if (!draftFromTemplate) return;
    setTitle(draftFromTemplate.title);
    setBody(draftFromTemplate.body);
    setImageUrl(draftFromTemplate.imageUrl?.trim() ?? '');
    onConsumeDraft?.();
  }, [draftFromTemplate, onConsumeDraft]);

  const contactsQ = useQuery({
    queryKey: ['notif-contacts', userQuery],
    queryFn: () =>
      jsonFetch<{ data: { id: string; email?: string; first_name?: string; last_name?: string }[] }>(
        `/api/notifications/contacts?q=${encodeURIComponent(userQuery)}`,
      ).then((r) => r.data),
    enabled: userQuery.trim().length >= 2,
  });

  const tokensQ = useQuery({
    queryKey: ['notif-contact-tokens', selectedUserId],
    queryFn: () =>
      jsonFetch<{ data: { id: string; token: string; platform: string }[] }>(
        `/api/notifications/contacts/${selectedUserId}/tokens`,
      ).then((r) => r.data),
    enabled: !!selectedUserId && mode === 'individual',
  });

  const segmentsQ = useQuery({
    queryKey: ['notification-segments'],
    queryFn: () =>
      jsonFetch<{ data: { id: string; name: string; filters: Record<string, unknown> }[] }>(
        '/api/notifications/segments',
      ).then((r) => r.data),
  });

  const filtersPayload = React.useMemo(() => {
    const f: Record<string, unknown> = {
      platform: filters.platform,
      valid_only: filters.valid_only,
    };
    if (filters.role.trim()) f.role = filters.role.trim();
    if (filters.country.trim()) f.country = filters.country.trim();
    return f;
  }, [filters]);

  const estimateQ = useQuery({
    queryKey: ['push-estimate', filtersPayload, mode],
    queryFn: () =>
      jsonFetch<{ data: { count: number } }>(
        `/api/admin/push/estimate?filters=${encodeURIComponent(JSON.stringify(filtersPayload))}`,
      ).then((r) => r.data.count),
    enabled: mode === 'segment' || mode === 'all',
  });

  const statusQ = useQuery({
    queryKey: ['push-status', jobId],
    queryFn: () =>
      jsonFetch<{ data: Record<string, unknown> }>(`/api/admin/push/status?jobId=${jobId}`).then((r) => r.data),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === 'processing') return 2000;
      return false;
    },
  });

  React.useEffect(() => {
    if (!jobId || !statusQ.data) return;
    const s = String(statusQ.data.status);
    if (s === 'processing') return;
    if (s === 'completed') toast.success('Campagne terminée');
    else if (s === 'failed') toast.error(String(statusQ.data.error_detail || 'Campagne en échec'));
    else if (s === 'scheduled') toast.success('Campagne planifiée');
    setJobId(null);
    qc.invalidateQueries({ queryKey: ['push-campaign-history'] });
  }, [jobId, statusQ.data, qc]);

  const schedulesQ = useQuery({
    queryKey: ['push-schedules'],
    queryFn: () =>
      jsonFetch<{ data: Record<string, unknown>[] }>('/api/notifications/schedules').then((r) => r.data),
  });

  const pushDataPayload = React.useMemo(() => {
    const data: Record<string, string> = {
      route: deeplink.trim() || '/home',
      source: contextSrc,
    };
    if (gpsLat && gpsLng) {
      data.gps_lat = gpsLat;
      data.gps_lng = gpsLng;
    }
    return data;
  }, [deeplink, contextSrc, gpsLat, gpsLng]);

  const sendIndividualMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title,
        body,
        data: { ...pushDataPayload },
      };
      if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      if (selectedTokens.length) payload.specific_tokens = selectedTokens;
      else if (selectedUserId) payload.user_ids = [selectedUserId];
      else throw new Error('Sélectionnez un utilisateur');
      await jsonFetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      toast.success('Notification envoyée');
      await logAuditEvent({
        actionType: 'send_notification',
        entityType: 'notification',
        description: `Push individuel: ${title.slice(0, 80)}`,
      });
      qc.invalidateQueries({ queryKey: ['push-campaign-history'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendCampaignMut = useMutation({
    mutationFn: async (opts: { filters: Record<string, unknown>; isAll?: boolean }) => {
      const scheduledAt =
        scheduledLocal.trim() ? new Date(scheduledLocal).toISOString() : null;
      if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) {
        throw new Error('Date planifiée invalide');
      }
      const res = await jsonFetch<{ data: { job_id: string; estimated_devices: number; capped: boolean } }>(
        '/api/admin/push/campaign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body,
            imageUrl: imageUrl.trim() || null,
            data: { ...pushDataPayload },
            filters: opts.isAll ? {} : opts.filters,
            scheduledAt,
          }),
        },
      );
      return res.data;
    },
    onSuccess: async (data, vars) => {
      if (scheduledLocal.trim()) {
        toast.success('Envoi planifié');
        setJobId(null);
      } else {
        toast.success(
          data.capped
            ? `Campagne lancée (plafond ${MAX_SYNC} utilisateurs / synchrone)`
            : 'Campagne lancée',
        );
        setJobId(data.job_id);
      }
      await logAuditEvent({
        actionType: 'send_notification',
        entityType: 'notification',
        entityId: data.job_id,
        description: vars.isAll ? 'Push tous utilisateurs' : 'Push segment',
        changes: { after: { estimated: data.estimated_devices, capped: data.capped } },
      });
      setConfirmAllOpen(false);
      qc.invalidateQueries({ queryKey: ['push-campaign-history'] });
      qc.invalidateQueries({ queryKey: ['push-schedules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createScheduleMut = useMutation({
    mutationFn: async () => {
      const emails = schedEmails
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await jsonFetch('/api/notifications/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schedName.trim(),
          title: schedTitle.trim(),
          body: schedBody.trim(),
          image_url: schedImage.trim() || null,
          filters: filtersPayload,
          frequency: schedFreq,
          day_of_week: schedFreq === 'weekly' ? Number(schedDow) : null,
          day_of_month: schedFreq === 'monthly' ? Number(schedDom) : null,
          send_time: schedTime,
          recipient_emails: emails,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Planification créée');
      setSchedDialog(false);
      setSchedName('');
      setSchedTitle('');
      setSchedBody('');
      setSchedImage('');
      await logAuditEvent({
        actionType: 'create',
        entityType: 'notification',
        description: 'Planification push créée',
      });
      qc.invalidateQueries({ queryKey: ['push-schedules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchScheduleMut = useMutation({
    mutationFn: async (p: { id: string; active: boolean }) => {
      await jsonFetch(`/api/notifications/schedules/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: p.active }),
      });
    },
    onSuccess: () => {
      toast.success('Mis à jour');
      qc.invalidateQueries({ queryKey: ['push-schedules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNamedSegmentMut = useMutation({
    mutationFn: async () => {
      const name = saveSegmentName.trim();
      if (!name) throw new Error('Nom requis');
      await jsonFetch('/api/notifications/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters: filtersPayload }),
      });
    },
    onSuccess: async () => {
      toast.success('Segment enregistré');
      setSaveSegmentName('');
      await logAuditEvent({
        actionType: 'create',
        entityType: 'notification',
        description: 'Segment notification enregistré',
      });
      qc.invalidateQueries({ queryKey: ['notification-segments'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteScheduleMut = useMutation({
    mutationFn: async (id: string) => {
      await jsonFetch(`/api/notifications/schedules/${id}`, { method: 'DELETE' });
    },
    onSuccess: async () => {
      toast.success('Supprimé');
      await logAuditEvent({
        actionType: 'delete',
        entityType: 'notification',
        description: 'Planification push supprimée',
      });
      qc.invalidateQueries({ queryKey: ['push-schedules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applySegment = (id: string) => {
    const s = segmentsQ.data?.find((x) => x.id === id);
    if (!s?.filters || typeof s.filters !== 'object') return;
    const f = s.filters as Record<string, string | boolean>;
    setFilters({
      role: typeof f.role === 'string' ? f.role : '',
      country: typeof f.country === 'string' ? f.country : '',
      platform: (f.platform as SegmentFiltersState['platform']) || 'all',
      valid_only: f.valid_only !== false,
    });
    toast.message(`Filtres « ${s.name} » appliqués`);
    setSavedSegmentPick('');
  };

  const onSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Titre et message requis');
      return;
    }
    if (!channelPush && !channelInApp) {
      toast.error('Sélectionnez au moins un canal (Push ou In-App)');
      return;
    }
    if (mode === 'individual') {
      if (channelPush) sendIndividualMut.mutate();
      if (channelInApp && selectedUserId) {
        void fetch('/api/messages/broadcast-inapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            target: 'specific',
            user_ids: [selectedUserId],
            message: { body, message_type: 'text', attachments: [] },
            send_push: false,
          }),
        }).then(async (r) => {
          const x = await r.json();
          if (!r.ok) throw new Error(x.error || 'In-app échec');
          toast.success('Message in-app envoyé');
        }).catch((e: Error) => toast.error(e.message));
      }
      return;
    }
    if (mode === 'all') {
      setConfirmAllOpen(true);
      return;
    }
    if (channelPush) sendCampaignMut.mutate({ filters: filtersPayload });
    if (channelInApp) {
      void fetch('/api/messages/broadcast-inapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          target: 'segment',
          filters: filtersPayload,
          message: { body, message_type: 'text', attachments: [] },
          send_push: false,
        }),
      }).then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw new Error(x.error || 'Broadcast in-app échec');
        toast.success(`Broadcast in-app envoyé (${x.sent_count || 0})`);
      }).catch((e: Error) => toast.error(e.message));
    }
  };

  const estimate = estimateQ.data ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Message</CardTitle>
            <CardDescription>Prévisualisation type mobile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'individual' ? 'default' : 'outline'}
                onClick={() => setMode('individual')}
                className="gap-1"
              >
                <User className="size-3.5" /> Individuel
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'segment' ? 'default' : 'outline'}
                onClick={() => setMode('segment')}
                className="gap-1"
              >
                <Users className="size-3.5" /> Segment
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'all' ? 'destructive' : 'outline'}
                onClick={() => setMode('all')}
                className="gap-1"
              >
                <AlertTriangle className="size-3.5" /> Tous
              </Button>
            </div>

            {mode === 'individual' && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <Label className="text-xs">Recherche contact (2+ caractères)</Label>
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Email, nom ou UUID…"
                  className="h-9 text-sm"
                />
                {contactsQ.isFetching && <Skeleton className="h-8 w-full" />}
                {contactsQ.data && contactsQ.data.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md border border-border text-xs">
                    {contactsQ.data.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => {
                          setSelectedUserId(p.id);
                          setSelectedTokens([]);
                        }}
                      >
                        {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email} — {p.email}
                      </button>
                    ))}
                  </div>
                )}
                {selectedUserId && (
                  <div className="space-y-2">
                    <Label className="text-xs">Appareils (cases = ciblage précis)</Label>
                    {tokensQ.isLoading && <Skeleton className="h-12 w-full" />}
                    <div className="max-h-36 space-y-1 overflow-y-auto">
                      {(tokensQ.data || []).map((t) => (
                        <label key={t.id} className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selectedTokens.includes(t.token)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTokens((s) => [...s, t.token]);
                              else setSelectedTokens((s) => s.filter((x) => x !== t.token));
                            }}
                          />
                          <span className="font-mono">{t.platform}</span>
                          <span className="truncate text-muted-foreground">{t.token.slice(0, 16)}…</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(mode === 'segment' || mode === 'all') && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                {mode === 'segment' && (
                  <>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[160px] flex-1 space-y-1">
                        <Label className="text-xs">Segment enregistré</Label>
                        <select
                          className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={savedSegmentPick}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSavedSegmentPick(v);
                            if (v) applySegment(v);
                          }}
                        >
                          <option value="">Appliquer un segment…</option>
                          {(segmentsQ.data || []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Rôle profil</Label>
                        <Input
                          className="h-9 text-sm"
                          placeholder="ex. client (vide = tous)"
                          value={filters.role}
                          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pays</Label>
                        <Input
                          className="h-9 text-sm"
                          placeholder="Code pays exact"
                          value={filters.country}
                          onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Plateforme</Label>
                        <Select
                          value={filters.platform}
                          onValueChange={(v) =>
                            setFilters((f) => ({ ...f, platform: (v as SegmentFiltersState['platform']) || 'all' }))
                          }
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Toutes</SelectItem>
                            <SelectItem value="ios">iOS</SelectItem>
                            <SelectItem value="android">Android</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 pt-6 text-xs">
                        <Switch
                          checked={filters.valid_only}
                          onCheckedChange={(c) => setFilters((f) => ({ ...f, valid_only: c }))}
                        />
                        Jetons valides uniquement
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="h-9 max-w-xs flex-1 text-sm"
                        placeholder="Nom pour réutiliser ce segment…"
                        value={saveSegmentName}
                        onChange={(e) => setSaveSegmentName(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={saveNamedSegmentMut.isPending}
                        onClick={() => saveNamedSegmentMut.mutate()}
                      >
                        Enregistrer le segment
                      </Button>
                    </div>
                  </>
                )}
                {mode === 'all' && (
                  <p className="text-xs text-muted-foreground">
                    Envoie à tous les utilisateurs ayant au moins un jeton FCM enregistré (filtrés par profil).
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {estimateQ.isFetching ? (
                    <Skeleton className="h-5 w-40" />
                  ) : (
                    <Badge variant="secondary">
                      ~{mode === 'all' ? estimate : estimate} appareils éligibles
                    </Badge>
                  )}
                  {estimate > MAX_SYNC && !scheduledLocal.trim() && (
                    <span className="text-amber-600 dark:text-amber-400">
                      Seuls {MAX_SYNC} utilisateurs sont traités par envoi synchrone.
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Planifier (optionnel)</Label>
                  <Input
                    type="datetime-local"
                    className="h-9 text-sm"
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Corps</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Deep link (payload route / ouverture app)</Label>
              <Input
                value={deeplink}
                onChange={(e) => setDeeplink(e.target.value)}
                placeholder="/home ou schéma personnalisé"
                className="h-9 text-sm font-mono"
              />
              {gpsLat && gpsLng ? (
                <p className="text-[10px] text-muted-foreground">
                  Contexte GPS attaché : {gpsLat}, {gpsLng} (source : {contextSrc})
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium">Canal d'envoi</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={channelPush} onCheckedChange={setChannelPush} />
                  Push
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={channelInApp} onCheckedChange={setChannelInApp} />
                  <MessageSquare className="h-3.5 w-3.5" />
                  In-App
                </label>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={
                sendIndividualMut.isPending ||
                sendCampaignMut.isPending ||
                !body.trim() ||
                !title.trim()
              }
              onClick={onSend}
            >
              <Send className="mr-2 size-3.5" />
              {mode === 'individual' ? 'Envoyer' : scheduledLocal.trim() ? 'Planifier' : 'Lancer campagne'}
            </Button>

            {jobId && statusQ.isFetching && (
              <p className="text-center text-xs text-muted-foreground">Mise à jour du statut…</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-4">
          <PhoneNotifPreview title={title || 'Titre'} body={body || 'Message…'} imageUrl={imageUrl.trim() || undefined} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Planifications récurrentes</CardTitle>
            <CardDescription>
              Prochaine exécution calculée côté serveur — déclenchement réel nécessite un cron / Edge Function.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setSchedDialog(true)}>
            <Plus className="size-3.5" /> Nouvelle
          </Button>
        </CardHeader>
        <CardContent>
          {schedulesQ.isLoading && <Skeleton className="h-24 w-full" />}
          {schedulesQ.isError && (
            <EmptyState
              icon={<AlertTriangle className="size-8" />}
              title="Erreur de chargement"
              description={(schedulesQ.error as Error).message}
              action={{ label: 'Réessayer', onClick: () => schedulesQ.refetch() }}
            />
          )}
          {!schedulesQ.isLoading && !schedulesQ.isError && (schedulesQ.data || []).length === 0 && (
            <EmptyState
              title="Aucune planification"
              description="Créez une récurrence pour documenter les envois (exécution automatique à brancher)."
            />
          )}
          {(schedulesQ.data || []).length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Fréquence</TableHead>
                    <TableHead>Prochain</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(schedulesQ.data || []).map((row) => (
                    <TableRow key={String(row.id)}>
                      <TableCell className="font-medium">{String(row.name)}</TableCell>
                      <TableCell className="text-xs capitalize">{String(row.frequency)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.next_run_at ? new Date(String(row.next_run_at)).toLocaleString('fr-FR') : '—'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={Boolean(row.active)}
                          onCheckedChange={(c) => patchScheduleMut.mutate({ id: String(row.id), active: c })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => deleteScheduleMut.mutate(String(row.id))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer à tous les utilisateurs ?</DialogTitle>
            <DialogDescription>
              Environ {estimate} destinataires éligibles. Les envois synchrones sont plafonnés à {MAX_SYNC}{' '}
              utilisateurs par campagne.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmAllOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={sendCampaignMut.isPending}
              onClick={() => sendCampaignMut.mutate({ filters: {}, isAll: true })}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={schedDialog} onOpenChange={setSchedDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle planification</DialogTitle>
            <DialogDescription>Les filtres segment ci-dessous reprennent l’onglet segment courant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nom interne</Label>
              <Input className="h-9" value={schedName} onChange={(e) => setSchedName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Titre push</Label>
              <Input className="h-9" value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Corps</Label>
              <Textarea rows={3} value={schedBody} onChange={(e) => setSchedBody(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Image URL</Label>
              <Input className="h-9" value={schedImage} onChange={(e) => setSchedImage(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Fréquence</Label>
                <Select value={schedFreq} onValueChange={(v) => v && setSchedFreq(v as typeof schedFreq)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidien</SelectItem>
                    <SelectItem value="weekly">Hebdo</SelectItem>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Heure (locale)</Label>
                <Input className="h-9" type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
              </div>
            </div>
            {schedFreq === 'weekly' && (
              <div className="space-y-1">
                <Label className="text-xs">Jour (1=lun … 7=dim)</Label>
                <Select value={schedDow} onValueChange={(v) => v && setSchedDow(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['1', '2', '3', '4', '5', '6', '7'].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {schedFreq === 'monthly' && (
              <div className="space-y-1">
                <Label className="text-xs">Jour du mois</Label>
                <Input
                  className="h-9"
                  type="number"
                  min={1}
                  max={31}
                  value={schedDom}
                  onChange={(e) => setSchedDom(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Emails (rapports / suivi, séparés par virgule)</Label>
              <Input className="h-9" value={schedEmails} onChange={(e) => setSchedEmails(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Filtres appliqués : rôle «{filters.role || '—'}», pays «{filters.country || '—'}», plateforme{' '}
              {filters.platform}, valides seuls : {filters.valid_only ? 'oui' : 'non'}.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSchedDialog(false)}>
              Fermer
            </Button>
            <Button
              type="button"
              disabled={createScheduleMut.isPending || !schedName.trim() || !schedTitle.trim() || !schedBody.trim()}
              onClick={() => createScheduleMut.mutate()}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
