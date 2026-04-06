'use client';

import * as React from 'react';
import imageCompression from 'browser-image-compression';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TiptapRichText } from './TiptapRichText';
import { Star, GripVertical, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseApiJson } from '@/lib/fetch-api-json';

export interface CategoryOption {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface ProductWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: CategoryOption[];
  editingId?: string | null;
  onComplete: () => void;
}

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

function SortableImg({
  id,
  url,
  isMain,
  onStar,
  onRemove,
}: {
  id: string;
  url: string;
  isMain: boolean;
  onStar: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative aspect-square rounded-lg border border-border overflow-hidden group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-full object-cover" />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
        <button type="button" className="p-1.5 rounded-md bg-background/90" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" className="p-1.5 rounded-md bg-background/90" onClick={onStar}>
          <Star className={cn('h-4 w-4', isMain && 'fill-amber-400 text-amber-400')} />
        </button>
        <button type="button" className="p-1.5 rounded-md bg-destructive/90 text-destructive-foreground" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ProductWizard({ open, onOpenChange, categories, editingId, onComplete }: ProductWizardProps) {
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugOk, setSlugOk] = React.useState<boolean | null>(null);
  const [description, setDescription] = React.useState('<p></p>');
  const [categoryId, setCategoryId] = React.useState<string>('');
  const [tags, setTags] = React.useState('');
  const [customK, setCustomK] = React.useState('');
  const [customV, setCustomV] = React.useState('');
  const [listingStatus, setListingStatus] = React.useState<'draft' | 'active' | 'archived'>('draft');
  const [price, setPrice] = React.useState('0');
  const [compare, setCompare] = React.useState('');
  const [currency, setCurrency] = React.useState('XOF');
  const [qty, setQty] = React.useState('0');
  const [lowTh, setLowTh] = React.useState('5');
  const [sku, setSku] = React.useState('');
  const [promoStart, setPromoStart] = React.useState('');
  const [promoEnd, setPromoEnd] = React.useState('');
  const [tierText, setTierText] = React.useState('[]');
  const [variantsText, setVariantsText] = React.useState('[]');
  const [gallery, setGallery] = React.useState<{ id: string; url: string }[]>([]);
  const [mainId, setMainId] = React.useState<string | null>(null);
  const [seoTitle, setSeoTitle] = React.useState('');
  const [seoDesc, setSeoDesc] = React.useState('');
  const [ogUrl, setOgUrl] = React.useState('');
  const [linked, setLinked] = React.useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  React.useEffect(() => {
    if (!open) return;
    setStep(0);
    if (!editingId) {
      setName('');
      setSlug('');
      setDescription('<p></p>');
      setCategoryId('');
      setTags('');
      setListingStatus('draft');
      setPrice('0');
      setCompare('');
      setQty('0');
      setSku('');
      setGallery([]);
      setMainId(null);
      setSeoTitle('');
      setSeoDesc('');
      setOgUrl('');
      setLinked('');
      setSlugOk(null);
    }
  }, [open, editingId]);

  React.useEffect(() => {
    if (editingId) return;
    setSlug((s) => (!s.trim() && name.trim() ? slugify(name) : s));
  }, [name, editingId]);

  React.useEffect(() => {
    if (!editingId || !open) return;
    void (async () => {
      try {
        const r = await fetch(`/api/products/${editingId}`, { credentials: 'include' });
        const j = await parseApiJson<{ data?: Record<string, unknown>; error?: string }>(r);
        if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
        const raw = j.data;
        if (!raw || typeof raw !== 'object') throw new Error('Données produit manquantes');
        const p = raw as Record<string, unknown>;
        setName(typeof p.name === 'string' ? p.name : '');
        setSlug(typeof p.slug === 'string' ? p.slug : '');
        setDescription(typeof p.description === 'string' ? p.description : '<p></p>');
        setCategoryId(typeof p.category_id === 'string' ? p.category_id : '');
        setListingStatus(
          p.listing_status === 'draft' || p.listing_status === 'active' || p.listing_status === 'archived'
            ? p.listing_status
            : 'draft',
        );
        setPrice(String(p.price ?? 0));
        setCompare(p.compare_at_price != null ? String(p.compare_at_price) : '');
        setQty(String(p.quantity ?? 0));
        setLowTh(String(p.low_stock_threshold ?? 5));
        setSku(typeof p.sku === 'string' ? p.sku : '');
        setCurrency(typeof p.currency === 'string' ? p.currency : 'XOF');
        const meta =
          p.admin_metadata && typeof p.admin_metadata === 'object' && !Array.isArray(p.admin_metadata)
            ? (p.admin_metadata as Record<string, unknown>)
            : {};
        setTags(Array.isArray(meta.tags) ? (meta.tags as string[]).join(', ') : '');
        setPromoStart(typeof meta.promo_start === 'string' ? meta.promo_start : '');
        setPromoEnd(typeof meta.promo_end === 'string' ? meta.promo_end : '');
        setTierText(JSON.stringify(meta.tier_prices ?? [], null, 2));
        setVariantsText(JSON.stringify(meta.variants ?? [], null, 2));
        setSeoTitle(typeof meta.seo_title === 'string' ? meta.seo_title : '');
        setSeoDesc(typeof meta.seo_description === 'string' ? meta.seo_description : '');
        setOgUrl(typeof meta.og_image_url === 'string' ? meta.og_image_url : '');
        setLinked(Array.isArray(meta.linked_product_ids) ? (meta.linked_product_ids as string[]).join(',') : '');
        const g = Array.isArray(p.gallery_urls)
          ? p.gallery_urls.filter((u): u is string => typeof u === 'string')
          : [];
        const imgs = g.map((url, i) => ({ id: `g-${i}`, url }));
        setGallery(imgs);
        setMainId(imgs[0]?.id ?? null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Chargement échoué');
      }
    })();
  }, [editingId, open]);

  React.useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugOk(null);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const q = new URLSearchParams({ slug });
        if (editingId) q.set('exclude_id', editingId);
        const r = await fetch(`/api/products/check-slug?${q}`, { credentials: 'include' });
        const j = await parseApiJson<{ available?: boolean }>(r);
        setSlugOk(Boolean(j.available));
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [slug, editingId]);

  const buildMetadata = (): Record<string, unknown> => {
    let tier_prices: unknown[] = [];
    let variants: unknown[] = [];
    try {
      tier_prices = JSON.parse(tierText) as unknown[];
    } catch {
      tier_prices = [];
    }
    try {
      variants = JSON.parse(variantsText) as unknown[];
    } catch {
      variants = [];
    }
    const tagList = tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const linkedIds = linked
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const meta: Record<string, unknown> = {
      tags: tagList,
      tier_prices,
      variants,
      promo_start: promoStart || null,
      promo_end: promoEnd || null,
      seo_title: seoTitle || null,
      seo_description: seoDesc || null,
      og_image_url: ogUrl || null,
      linked_product_ids: linkedIds,
    };
    if (customK.trim()) meta[customK.trim()] = customV;
    return meta;
  };

  const persistDraft = async () => {
    setSaving(true);
    try {
      const main = gallery.find((g) => g.id === mainId) || gallery[0];
      const body = {
        name: name || 'Sans titre',
        slug: slug || slugify(name || 'produit'),
        description,
        price: Number(price) || 0,
        compare_at_price: compare ? Number(compare) : null,
        quantity: Number(qty) || 0,
        category_id: categoryId || null,
        sku: sku || null,
        main_image: main?.url ?? null,
        gallery_urls: gallery.map((g) => g.url),
        listing_status: 'draft',
        is_featured: false,
        brand: null,
        admin_metadata: buildMetadata(),
        low_stock_threshold: Number(lowTh) || 5,
        currency,
      };
      const url = editingId ? `/api/products/${editingId}` : '/api/products';
      const r = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...body, listing_status: 'draft' } : body),
      });
      const j = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success('Brouillon enregistré');
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      const main = gallery.find((g) => g.id === mainId) || gallery[0];
      const body = {
        name,
        slug,
        description,
        price: Number(price) || 0,
        compare_at_price: compare ? Number(compare) : null,
        quantity: Number(qty) || 0,
        category_id: categoryId || null,
        sku: sku || null,
        main_image: main?.url ?? null,
        gallery_urls: gallery.map((g) => g.url),
        listing_status: 'active' as const,
        is_featured: false,
        brand: null,
        admin_metadata: buildMetadata(),
        low_stock_threshold: Number(lowTh) || 5,
        currency,
      };
      const url = editingId ? `/api/products/${editingId}` : '/api/products';
      const r = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...body, listing_status: 'active', is_active: true } : { ...body, listing_status: 'active', is_active: true }),
      });
      const j = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success('Produit publié');
      onOpenChange(false);
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const compressed = await imageCompression(file, { maxWidthOrHeight: 1600, maxSizeMB: 1, useWebWorker: true });
        const path = `admin/${Date.now()}-${compressed.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const fd = new FormData();
        fd.append('file', compressed);
        fd.append('path', path);
        const r = await fetch('/api/products/upload', { method: 'POST', body: fd, credentials: 'include' });
        const j = await parseApiJson<{ error?: string; publicUrl?: string }>(r);
        if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Upload');
        const publicUrl = j.publicUrl;
        if (typeof publicUrl !== 'string' || !publicUrl) throw new Error('URL publique manquante');
        const id = `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setGallery((g) => [...g, { id, url: publicUrl }]);
        setMainId((m) => m ?? id);
        toast.success('Image ajoutée');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload échoué');
      }
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setGallery((items) => {
      const oldI = items.findIndex((i) => i.id === active.id);
      const newI = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldI, newI);
    });
  };

  const steps = ['Infos', 'Prix & stock', 'Variantes', 'Images', 'SEO'];

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editingId ? 'Modifier le produit' : 'Nouveau produit'}
      description={`Étape ${step + 1} / ${steps.length} — ${steps[step]}`}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Précédent
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => void persistDraft()}>
              Brouillon
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}>
                Suivant
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={saving || slugOk === false} onClick={() => void publish()}>
                Publier
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              i === step ? 'bg-[var(--brand)] text-white' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4 max-w-3xl">
          <div className="grid gap-2">
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du produit" />
          </div>
          <div className="grid gap-2">
            <Label>Slug {slugOk === false && <span className="text-destructive text-xs">(non disponible)</span>}</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <TiptapRichText value={description} onChange={setDescription} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Select
                value={categoryId || '__none'}
                onValueChange={(v) => setCategoryId(!v || v === '__none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Statut liste</Label>
              <Select value={listingStatus} onValueChange={(v) => setListingStatus(v as typeof listingStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Tags (virgules)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="promo, nouveau, …" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={customK} onChange={(e) => setCustomK(e.target.value)} placeholder="Clé custom" />
            <Input value={customV} onChange={(e) => setCustomV(e.target.value)} placeholder="Valeur" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 max-w-xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Prix</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Devise</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Prix barré (promo)</Label>
            <Input type="number" value={compare} onChange={(e) => setCompare(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Promo début</Label>
              <Input type="date" value={promoStart} onChange={(e) => setPromoStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Promo fin</Label>
              <Input type="date" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Prix par palier (JSON)</Label>
            <Textarea value={tierText} onChange={(e) => setTierText(e.target.value)} rows={4} className="font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Stock</Label>
              <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Seuil alerte stock</Label>
              <Input type="number" value={lowTh} onChange={(e) => setLowTh(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 max-w-3xl">
          <p className="text-sm text-muted-foreground">
            Définissez un tableau JSON de variantes :{' '}
            <code className="text-xs bg-muted px-1 rounded">[&#123;&quot;name&quot;:&quot;XL&quot;,&quot;sku&quot;:&quot;…&quot;,&quot;price&quot;:0,&quot;qty&quot;:0&#125;]</code>
          </p>
          <Textarea value={variantsText} onChange={(e) => setVariantsText(e.target.value)} rows={14} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob(['name,sku,price,qty\n'], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'variantes-modele.csv';
              a.click();
            }}
          >
            Modèle CSV
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer border border-dashed rounded-lg p-4 hover:bg-muted/40">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span>Déposer des images (compression automatique)</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
          </label>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={gallery.map((g) => g.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {gallery.map((g) => (
                  <SortableImg
                    key={g.id}
                    id={g.id}
                    url={g.url}
                    isMain={mainId === g.id}
                    onStar={() => setMainId(g.id)}
                    onRemove={() => {
                      setGallery((x) => x.filter((i) => i.id !== g.id));
                      setMainId((m) => (m === g.id ? null : m));
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 max-w-xl">
          <div className="grid gap-2">
            <Label>Titre SEO ({seoTitle.length}/60)</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={80} />
          </div>
          <div className="grid gap-2">
            <Label>Meta description ({seoDesc.length}/160)</Label>
            <Textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={200} rows={3} />
          </div>
          <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground bg-muted/20">
            <p className="font-medium text-foreground">{seoTitle || name || 'Titre'}</p>
            <p className="mt-1 line-clamp-2">{seoDesc || description.replace(/<[^>]+>/g, '').slice(0, 160)}</p>
          </div>
          <div className="grid gap-2">
            <Label>Image Open Graph (URL)</Label>
            <Input value={ogUrl} onChange={(e) => setOgUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="grid gap-2">
            <Label>Produits liés (UUID séparés par virgule)</Label>
            <Input value={linked} onChange={(e) => setLinked(e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
      )}
    </Drawer>
  );
}
