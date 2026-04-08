'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { ConfirmDialog } from '@/components/ui/custom/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, Image as ImageIcon, Eye, EyeOff, RefreshCw } from 'lucide-react';
import Image from 'next/image';

type Banner = {
  id: string;
  title?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
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
  const { error } = await supabase.from('banners').insert({ ...b, is_active: true, display_order: b.display_order ?? 0 });
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

export default function BannersPage() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [form, setForm] = useState({ title: '', image_url: '', link_url: '' });
  const [adding, setAdding] = useState(false);

  const query = useQuery({ queryKey: ['banners'], queryFn: fetchBanners, staleTime: 30_000 });

  const createMut = useMutation({
    mutationFn: createBanner,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banners'] }); setForm({ title: '', image_url: '', link_url: '' }); setAdding(false); toast.success('Bannière créée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleBanner(id, active),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banners'] }); toast.success('Statut mis à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banners'] }); setToDelete(null); toast.success('Bannière supprimée'); },
    onError: (e: any) => toast.error(e.message),
  });

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
            <Button size="sm" onClick={() => setAdding(v => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Ajouter
            </Button>
          </div>
        }
      />

      {/* Add form */}
      {adding && (
        <Card className="p-4 space-y-3">
          <p className="text-sm font-medium">Nouvelle bannière</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Titre" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-sm" />
            <Input placeholder="URL image" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className="h-8 text-sm" />
            <Input placeholder="URL lien (optionnel)" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8" disabled={!form.image_url || createMut.isPending}
              onClick={() => createMut.mutate({ title: form.title || null, image_url: form.image_url, link_url: form.link_url || null })}>
              Créer
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {/* Grid */}
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : banners.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-8 w-8" />} title="Aucune bannière" description="Ajoutez des bannières pour les afficher dans l'app." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map(b => (
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
              <div className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.title || 'Sans titre'}</p>
                  {b.link_url && <p className="text-xs text-muted-foreground truncate">{b.link_url}</p>}
                </div>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => toggleMut.mutate({ id: b.id, active: !b.is_active })}
                  disabled={toggleMut.isPending}
                >
                  {b.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setToDelete(b)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Supprimer cette bannière?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </div>
  );
}
