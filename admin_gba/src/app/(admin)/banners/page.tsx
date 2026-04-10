'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog';
import { AdminDrawer } from '@/components/ui/custom/AdminDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, Image as ImageIcon, Eye, EyeOff, RefreshCw, Pencil, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Banner = {
  id: string;
  title?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
};

function canUseNextImage(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase.from('banners').select('*').order('display_order', { ascending: true });
  if (error) throw error;
  return (data || []) as Banner[];
}

async function createBanner(b: Partial<Banner>) {
  const { error } = await supabase.from('banners').insert({
    ...b,
    is_active: b.is_active ?? true,
    display_order: b.display_order ?? 0,
  });
  if (error) throw error;
}

async function updateBanner(id: string, b: Partial<Banner>) {
  const { error } = await supabase.from('banners').update(b).eq('id', id);
  if (error) throw error;
}

async function toggleBanner(id: string, active: boolean) {
  const { error } = await supabase.from('banners').update({ is_active: active }).eq('id', id);
  if (error) throw error;
}

async function deleteBanner(id: string) {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) throw error;
}

const STEPS = ['Contenu', 'Visuel', 'Programmation'] as const;

export default function BannersPage() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewBanner, setViewBanner] = useState<Banner | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [uploading, setUploading] = useState(false);

  const query = useQuery({ queryKey: ['banners'], queryFn: fetchBanners, staleTime: 30_000 });

  const resetForm = () => {
    setEditId(null);
    setStep(0);
    setTitle('');
    setLinkUrl('');
    setImageUrl('');
    setScheduleEnabled(false);
    setStartsAt('');
    setEndsAt('');
    setDisplayOrder('0');
  };

  const openCreate = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditId(b.id);
    setTitle(b.title || '');
    setLinkUrl(b.link_url || '');
    setImageUrl(b.image_url || '');
    setScheduleEnabled(Boolean(b.starts_at || b.ends_at));
    setStartsAt(b.starts_at ? format(new Date(b.starts_at), "yyyy-MM-dd'T'HH:mm") : '');
    setEndsAt(b.ends_at ? format(new Date(b.ends_at), "yyyy-MM-dd'T'HH:mm") : '');
    setDisplayOrder(String(b.display_order ?? 0));
    setStep(0);
    setDrawerOpen(true);
  };

  const createMut = useMutation({
    mutationFn: createBanner,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      setDrawerOpen(false);
      resetForm();
      toast.success('Bannière créée');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Banner> }) => updateBanner(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      setDrawerOpen(false);
      resetForm();
      toast.success('Bannière mise à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleBanner(id, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      toast.success('Statut mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      setToDelete(null);
      toast.success('Bannière supprimée');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch('/api/banners/upload', { method: 'POST', body: fd, credentials: 'include' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Upload échoué');
      setImageUrl(j.url);
      toast.success('Image téléversée');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload échoué');
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = (): Partial<Banner> => {
    const order = Math.max(0, parseInt(displayOrder, 10) || 0);
    const payload: Partial<Banner> = {
      title: title.trim() || null,
      link_url: linkUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      display_order: order,
      starts_at: scheduleEnabled && startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: scheduleEnabled && endsAt ? new Date(endsAt).toISOString() : null,
    };
    return payload;
  };

  const saveBanner = () => {
    const payload = buildPayload();
    if (!payload.image_url?.trim()) {
      toast.error('Image requise (URL ou fichier)');
      return;
    }
    if (editId) {
      updateMut.mutate({ id: editId, patch: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const banners = query.data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bannières"
        subtitle={`${banners.length} bannière${banners.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['banners'] })}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Ajouter
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-8 w-8" />} title="Aucune bannière" description="Ajoutez des bannières pour les afficher dans l'app." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((b) => (
            <Card key={b.id} className={`overflow-hidden ${!b.is_active ? 'opacity-60' : ''}`}>
              <div className="aspect-[16/6] bg-muted relative overflow-hidden">
                {b.image_url ? (
                  canUseNextImage(b.image_url) ? (
                    <Image src={b.image_url} alt={b.title || 'Bannière'} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.image_url} alt={b.title || 'Bannière'} className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                {!b.is_active && (
                  <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                    <span className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-0.5 rounded">Inactive</span>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.title || 'Sans titre'}</p>
                  {b.link_url && <p className="text-xs text-muted-foreground truncate">{b.link_url}</p>}
                  {(b.starts_at || b.ends_at) && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {b.starts_at ? format(new Date(b.starts_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'} →{' '}
                      {b.ends_at ? format(new Date(b.ends_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setViewBanner(b)}>
                    <Eye className="h-3 w-3 mr-1" />
                    Voir
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(b)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleMut.mutate({ id: b.id, active: !b.is_active })}
                    disabled={toggleMut.isPending}
                  >
                    {b.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setToDelete(b)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AdminDrawer
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) resetForm();
        }}
        title={editId ? 'Modifier la bannière' : 'Nouvelle bannière'}
        description={`Étape ${step + 1} / ${STEPS.length} — ${STEPS[step]}`}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
            <div className="flex gap-2">
              {step < STEPS.length - 1 ? (
                <Button type="button" size="sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={saveBanner} disabled={createMut.isPending || updateMut.isPending}>
                  {editId ? 'Enregistrer' : 'Créer'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-1">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium ${step === i ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                onClick={() => setStep(i)}
              >
                {i + 1}. {label}
              </button>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Titre</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre affiché (accessibilité)" />
              </div>
              <div className="space-y-1">
                <Label>URL de destination (optionnel)</Label>
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label>Ordre d&apos;affichage</Label>
                <Input type="number" min={0} value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>URL de l&apos;image</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... ou téléversez ci-dessous" />
              </div>
              <div className="space-y-1">
                <Label>Téléverser depuis votre PC</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    className="cursor-pointer text-sm"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUploadFile(f);
                      e.target.value = '';
                    }}
                  />
                  {uploading ? <span className="text-xs text-muted-foreground">…</span> : null}
                </div>
              </div>
              {imageUrl ? (
                <div className="relative aspect-[16/6] w-full overflow-hidden rounded-lg border bg-muted">
                  {canUseNextImage(imageUrl) ? (
                    <Image src={imageUrl} alt="Aperçu" fill className="object-cover" unoptimized />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="Aperçu" className="h-full w-full object-cover" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p className="text-xs">Collez une URL ou choisissez un fichier</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label>Programmation</Label>
                  <p className="text-xs text-muted-foreground">Dates de début / fin (optionnel)</p>
                </div>
                <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
              </div>
              {scheduleEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Début</Label>
                    <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fin / expiration</Label>
                    <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">La bannière suit uniquement le statut actif / inactive.</p>
              )}
            </div>
          )}
        </div>
      </AdminDrawer>

      <AdminDrawer
        open={Boolean(viewBanner)}
        onOpenChange={(o) => !o && setViewBanner(null)}
        title="Aperçu bannière"
        footer={
          <Button type="button" variant="outline" onClick={() => setViewBanner(null)}>
            Fermer
          </Button>
        }
      >
        {viewBanner ? (
          <div className="space-y-3">
            <div className="relative aspect-[16/6] w-full overflow-hidden rounded-lg border bg-muted">
              {viewBanner.image_url ? (
                canUseNextImage(viewBanner.image_url) ? (
                  <Image src={viewBanner.image_url} alt="" fill className="object-cover" unoptimized />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewBanner.image_url} alt="" className="h-full w-full object-cover" />
                )
              ) : null}
            </div>
            <p className="font-medium">{viewBanner.title || 'Sans titre'}</p>
            {viewBanner.link_url ? (
              <a href={viewBanner.link_url} className="text-sm text-primary underline break-all" target="_blank" rel="noreferrer">
                {viewBanner.link_url}
              </a>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Actif : {viewBanner.is_active ? 'oui' : 'non'} · Ordre : {viewBanner.display_order ?? 0}
            </p>
            {(viewBanner.starts_at || viewBanner.ends_at) && (
              <p className="text-xs">
                {viewBanner.starts_at ? format(new Date(viewBanner.starts_at), 'PPp', { locale: fr }) : '—'} →{' '}
                {viewBanner.ends_at ? format(new Date(viewBanner.ends_at), 'PPp', { locale: fr }) : '—'}
              </p>
            )}
          </div>
        ) : null}
      </AdminDrawer>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette bannière?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </div>
  );
}
