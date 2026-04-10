'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PageHeader } from '@/components/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ChevronRight, ChevronDown, GripVertical, Plus, Trash2, Pencil, Power, Package, Truck, ShoppingBag, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseApiJson } from '@/lib/fetch-api-json';

type Cat = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  link_url: string | null;
  accent_color: string | null;
  icon_key: string | null;
  image_url: string | null;
  product_count: number;
  revenue_total: number;
  conversion_rate: number;
};

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ICON_PRESETS = [
  { key: 'package', Icon: Package, label: 'Colis' },
  { key: 'truck', Icon: Truck, label: 'Livraison' },
  { key: 'shopping', Icon: ShoppingBag, label: 'Courses' },
  { key: 'home', Icon: Home, label: 'Maison' },
] as const;

function buildTree(flat: Cat[]): Cat[] {
  const map = new Map<string, Cat & { children?: Cat[] }>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: (Cat & { children?: Cat[] })[] = [];
  flat.forEach((c) => {
    const n = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(n as Cat);
    } else {
      roots.push(n as Cat);
    }
  });
  const sortCh = (nodes: (Cat & { children?: Cat[] })[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    nodes.forEach((n) => n.children && sortCh(n.children as (Cat & { children?: Cat[] })[]));
  };
  sortCh(roots);
  return roots as Cat[];
}

function SortableRow({
  cat,
  depth,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  editingId,
  editName,
  setEditName,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
}: {
  cat: Cat & { children?: Cat[] };
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (id: string, name: string) => void;
  onDelete: (c: Cat) => void;
  onToggleActive: (c: Cat) => void;
  editingId: string | null;
  editName: string;
  setEditName: (s: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const hasChildren = (cat.children?.length ?? 0) > 0;
  const open = expanded.has(cat.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div>
      <div
        ref={setNodeRef}
        style={{ ...style, marginLeft: depth * 16 }}
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group"
      >
        <button type="button" className="p-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        {hasChildren ? (
          <button type="button" className="p-0.5" onClick={() => onToggle(cat.id)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        {editingId === cat.id ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
            />
            <Button type="button" size="sm" className="h-8" onClick={onSaveEdit}>
              OK
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="flex-1 text-left text-sm font-medium truncate"
            onDoubleClick={() => onEdit(cat.id, cat.name)}
          >
            {cat.name}
          </button>
        )}
        <span
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium',
            cat.is_active ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
          )}
        >
          {cat.is_active ? 'Active' : 'Inactive'}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0"
          style={{ background: cat.accent_color ? `${cat.accent_color}22` : undefined, color: cat.accent_color || undefined }}
        >
          {cat.product_count} pdts
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
          {Math.round(cat.revenue_total).toLocaleString('fr-FR')} XOF
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0 hidden md:inline">{cat.conversion_rate}% conv.</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 opacity-0 group-hover:opacity-100"
          title={cat.is_active ? 'Désactiver' : 'Activer'}
          onClick={() => onToggleActive(cat)}
        >
          <Power className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => onEdit(cat.id, cat.name)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => onDelete(cat)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {hasChildren && open && (
        <SortableContext items={cat.children!.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cat.children!.map((ch) => (
            <SortableRow
              key={ch.id}
              cat={ch as Cat & { children?: Cat[] }}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              editingId={editingId}
              editName={editName}
              setEditName={setEditName}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export default function CategoriesAdminPage() {
  const [flat, setFlat] = React.useState<Cat[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [delCat, setDelCat] = React.useState<Cat | null>(null);
  const [migrateTo, setMigrateTo] = React.useState('');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    slug: '',
    parent_id: '',
    description: '',
    accent_color: '',
    icon_key: '',
    image_url: '',
    link_url: '',
    is_active: true,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch('/api/categories', { credentials: 'include' });
      const j = await parseApiJson<{ data?: Cat[]; error?: string }>(r);
      if (!r.ok) throw new Error(j.error || 'Erreur');
      setFlat(j.data || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const tree = React.useMemo(() => buildTree(flat), [flat]);
  const rootIds = tree.map((c) => c.id);

  const persistOrder = async (orderedIds: string[]) => {
    try {
      await Promise.all(
        orderedIds.map((id, i) =>
          fetch(`/api/categories/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: i }),
          }),
        ),
      );
      toast.success('Ordre enregistré');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const siblingsOf = React.useCallback(
    (id: string) => {
      const self = flat.find((c) => c.id === id);
      if (!self) return [];
      const pid = self.parent_id ?? null;
      return flat
        .filter((c) => (c.parent_id ?? null) === pid)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((c) => c.id);
    },
    [flat],
  );

  const onTreeDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const aid = String(active.id);
    const oid = String(over.id);
    const sa = siblingsOf(aid);
    if (!sa.includes(oid)) return;
    const oldI = sa.indexOf(aid);
    const newI = sa.indexOf(oid);
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(sa, oldI, newI);
    void persistOrder(next);
  };

  const toggleCategoryActive = async (c: Cat) => {
    try {
      const r = await fetch(`/api/categories/${c.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success(c.is_active ? 'Catégorie désactivée' : 'Catégorie activée');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const r = await fetch(`/api/categories/${editingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      toast.success('Mis à jour');
      setEditingId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const createCat = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Nom et slug requis');
      return;
    }
    try {
      const r = await fetch('/api/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description || null,
          parent_id: form.parent_id || null,
          accent_color: form.accent_color || null,
          icon_key: form.icon_key || null,
          image_url: form.image_url || null,
          link_url: form.link_url.trim() || null,
          is_active: form.is_active,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      toast.success('Catégorie créée');
      setCreateOpen(false);
      setSlugTouched(false);
      setForm({
        name: '',
        slug: '',
        parent_id: '',
        description: '',
        accent_color: '',
        icon_key: '',
        image_url: '',
        link_url: '',
        is_active: true,
      });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const confirmDelete = async () => {
    if (!delCat || !migrateTo) return;
    try {
      const r = await fetch(`/api/categories/${delCat.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ migrate_to_category_id: migrateTo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      toast.success(`Supprimée — ${j.migrated_products ?? 0} produit(s) migré(s)`);
      setDelCat(null);
      setMigrateTo('');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title="Catégories"
        subtitle="Arbre hiérarchique, réorganisation et statistiques"
        actions={
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle catégorie
          </Button>
        }
      />

      {createOpen && (
        <Card className="p-4 space-y-4 max-w-3xl">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Nom de la catégorie *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: slugTouched ? f.slug : slugify(name),
                    }));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug (URL) *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({ ...f, slug: e.target.value }));
                  }}
                  className="font-mono text-sm"
                />
              </div>
          <div className="grid gap-2">
            <Label>Parent</Label>
            <Select
              value={form.parent_id || '__root'}
              onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v === '__root' || !v ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Racine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root">Racine</SelectItem>
                {flat.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
              <div className="grid gap-2">
                <Label>Couleur d’accent</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="color"
                    className="h-10 w-14 cursor-pointer rounded border p-1"
                    value={form.accent_color?.startsWith('#') ? form.accent_color : '#6C47FF'}
                    onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
                  />
                  <Input
                    value={form.accent_color}
                    onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
                    placeholder="#6C47FF"
                    className="max-w-[140px] font-mono text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Image de couverture (URL)</Label>
                <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Lien associé (optionnel)</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="https://"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <Label className="text-sm">Catégorie active</Label>
                  <p className="text-xs text-muted-foreground">Visible dans les listes lorsque activée</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Icône</Label>
                <div className="flex flex-wrap gap-2">
                  {ICON_PRESETS.map(({ key, Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon_key: key }))}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-[10px] transition-colors',
                        form.icon_key === key ? 'border-violet-600 bg-violet-500/10' : 'border-border hover:bg-muted',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  ))}
                </div>
                <Input
                  value={form.icon_key}
                  onChange={(e) => setForm((f) => ({ ...f, icon_key: e.target.value }))}
                  placeholder="Clé personnalisée"
                  className="text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">Aperçu (app client)</Label>
              <div
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                style={{
                  maxWidth: 280,
                  borderColor: form.accent_color || undefined,
                }}
              >
                <div className="relative h-28 w-full bg-muted">
                  {form.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-muted-foreground"
                      style={{ background: form.accent_color ? `${form.accent_color}33` : undefined }}
                    >
                      <Package className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold leading-tight">{form.name.trim() || 'Nom de la catégorie'}</p>
                  {form.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{form.description}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void createCat()}>
              Créer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setSlugTouched(false);
              }}
            >
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        {loadError ? (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            Chargement incomplet des catégories : {loadError}
          </div>
        ) : null}
        {!loading && flat.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Total catégories : {flat.length}</span>
            <span>
              Produits liés : {flat.reduce((s, c) => s + Number(c.product_count || 0), 0).toLocaleString('fr-FR')}
            </span>
            <span>
              CA cumulé : {Math.round(flat.reduce((s, c) => s + Number(c.revenue_total || 0), 0)).toLocaleString('fr-FR')} XOF
            </span>
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : flat.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Aucune catégorie — créez-en une.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
              {tree.map((c) => (
                <SortableRow
                  key={c.id}
                  cat={c as Cat & { children?: Cat[] }}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  onEdit={startEdit}
                  onDelete={setDelCat}
                  onToggleActive={(x) => void toggleCategoryActive(x)}
                  editingId={editingId}
                  editName={editName}
                  setEditName={setEditName}
                  onSaveEdit={() => void saveEdit()}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <Dialog
        open={!!delCat}
        onOpenChange={(o) => {
          if (!o) {
            setDelCat(null);
            setMigrateTo('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la catégorie</DialogTitle>
            <DialogDescription>
              {delCat
                ? `« ${delCat.name} » : ${delCat.product_count} produit(s) à migrer avant suppression.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Catégorie de destination</Label>
            <Select value={migrateTo || undefined} onValueChange={(v) => setMigrateTo(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {delCat
                  ? flat
                      .filter((c) => c.id !== delCat.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                  : null}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDelCat(null)}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" disabled={!migrateTo} onClick={() => void confirmDelete()}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
