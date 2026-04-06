'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import {
  Dialog,
  DialogContent,
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
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { LayoutTemplate, Pencil, Trash2, Sparkles } from 'lucide-react';
import type { PushDraft } from './notif-types';

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  title_template: string;
  body_template: string;
  image_url?: string | null;
  variables?: string[] | null;
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

type Props = { onApplyTemplate: (d: PushDraft) => void };

export function NotifTemplatesTab({ onApplyTemplate }: Props) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<TemplateRow | null>(null);

  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<'promotional' | 'transactional' | 'alert' | 'system'>(
    'transactional',
  );
  const [titleT, setTitleT] = React.useState('');
  const [bodyT, setBodyT] = React.useState('');
  const [imageT, setImageT] = React.useState('');
  const [varsRaw, setVarsRaw] = React.useState('');

  const listQ = useQuery({
    queryKey: ['push-templates'],
    queryFn: () => jsonFetch<{ data: TemplateRow[] }>('/api/notifications/templates').then((r) => r.data),
  });

  const resetForm = () => {
    setName('');
    setCategory('transactional');
    setTitleT('');
    setBodyT('');
    setImageT('');
    setVarsRaw('');
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const variables = varsRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await jsonFetch('/api/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          title_template: titleT.trim(),
          body_template: bodyT.trim(),
          image_url: imageT.trim() || null,
          variables,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Template créé');
      setCreateOpen(false);
      resetForm();
      await logAuditEvent({
        actionType: 'create',
        entityType: 'notification',
        description: 'Template push créé',
      });
      qc.invalidateQueries({ queryKey: ['push-templates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!editRow) return;
      const variables = varsRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await jsonFetch(`/api/notifications/templates/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          title_template: titleT.trim(),
          body_template: bodyT.trim(),
          image_url: imageT.trim() || null,
          variables,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Template mis à jour');
      setEditRow(null);
      resetForm();
      await logAuditEvent({
        actionType: 'update',
        entityType: 'notification',
        description: 'Template push mis à jour',
      });
      qc.invalidateQueries({ queryKey: ['push-templates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await jsonFetch(`/api/notifications/templates/${id}`, { method: 'DELETE' });
    },
    onSuccess: async () => {
      toast.success('Supprimé');
      await logAuditEvent({
        actionType: 'delete',
        entityType: 'notification',
        description: 'Template push supprimé',
      });
      qc.invalidateQueries({ queryKey: ['push-templates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markUsedMut = useMutation({
    mutationFn: async (id: string) => {
      await jsonFetch(`/api/notifications/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-templates'] }),
  });

  const openEdit = (row: TemplateRow) => {
    setEditRow(row);
    setName(row.name);
    setCategory((row.category as typeof category) || 'transactional');
    setTitleT(row.title_template);
    setBodyT(row.body_template);
    setImageT(row.image_url?.trim() ?? '');
    setVarsRaw((row.variables || []).join(', '));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" onClick={() => { resetForm(); setCreateOpen(true); }}>
          Nouveau template
        </Button>
      </div>

      {listQ.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {listQ.isError && (
        <EmptyState
          icon={<LayoutTemplate className="size-8" />}
          title="Erreur"
          description={(listQ.error as Error).message}
          action={{ label: 'Réessayer', onClick: () => listQ.refetch() }}
        />
      )}

      {!listQ.isLoading && !listQ.isError && (listQ.data || []).length === 0 && (
        <EmptyState
          icon={<LayoutTemplate className="size-8" />}
          title="Aucun template"
          description="Créez des modèles réutilisables pour accélérer les campagnes."
          action={{
            label: 'Créer',
            onClick: () => {
              resetForm();
              setCreateOpen(true);
            },
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(listQ.data || []).map((row) => (
          <Card key={row.id} className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold leading-tight">{row.name}</CardTitle>
                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                  {row.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="font-medium text-foreground">{row.title_template}</p>
              <p className="line-clamp-3 text-muted-foreground">{row.body_template}</p>
              <div className="flex flex-wrap gap-1 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1"
                  onClick={() => {
                    onApplyTemplate({
                      title: row.title_template,
                      body: row.body_template,
                      imageUrl: row.image_url,
                    });
                    markUsedMut.mutate(row.id);
                    void logAuditEvent({
                      actionType: 'view',
                      entityType: 'notification',
                      entityId: row.id,
                      description: 'Template appliqué au composer',
                    });
                  }}
                >
                  <Sparkles className="size-3" /> Utiliser
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => openEdit(row)}>
                  <Pencil className="size-3" /> Modifier
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive"
                  onClick={() => deleteMut.mutate(row.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau template</DialogTitle>
          </DialogHeader>
          <TemplateFormFields
            name={name}
            setName={setName}
            category={category}
            setCategory={setCategory}
            titleT={titleT}
            setTitleT={setTitleT}
            bodyT={bodyT}
            setBodyT={setBodyT}
            imageT={imageT}
            setImageT={setImageT}
            varsRaw={varsRaw}
            setVarsRaw={setVarsRaw}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={createMut.isPending || !name.trim() || !titleT.trim() || !bodyT.trim()}
              onClick={() => createMut.mutate()}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le template</DialogTitle>
          </DialogHeader>
          <TemplateFormFields
            name={name}
            setName={setName}
            category={category}
            setCategory={setCategory}
            titleT={titleT}
            setTitleT={setTitleT}
            bodyT={bodyT}
            setBodyT={setBodyT}
            imageT={imageT}
            setImageT={setImageT}
            varsRaw={varsRaw}
            setVarsRaw={setVarsRaw}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Fermer
            </Button>
            <Button
              type="button"
              disabled={patchMut.isPending || !name.trim() || !titleT.trim() || !bodyT.trim()}
              onClick={() => patchMut.mutate()}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateFormFields({
  name,
  setName,
  category,
  setCategory,
  titleT,
  setTitleT,
  bodyT,
  setBodyT,
  imageT,
  setImageT,
  varsRaw,
  setVarsRaw,
}: {
  name: string;
  setName: (v: string) => void;
  category: 'promotional' | 'transactional' | 'alert' | 'system';
  setCategory: (v: 'promotional' | 'transactional' | 'alert' | 'system') => void;
  titleT: string;
  setTitleT: (v: string) => void;
  bodyT: string;
  setBodyT: (v: string) => void;
  imageT: string;
  setImageT: (v: string) => void;
  varsRaw: string;
  setVarsRaw: (v: string) => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1">
        <Label className="text-xs">Nom</Label>
        <Input className="h-9" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Catégorie</Label>
        <Select value={category} onValueChange={(v) => v && setCategory(v as typeof category)}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transactional">Transactionnel</SelectItem>
            <SelectItem value="promotional">Promotionnel</SelectItem>
            <SelectItem value="alert">Alerte</SelectItem>
            <SelectItem value="system">Système</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Titre</Label>
        <Input className="h-9" value={titleT} onChange={(e) => setTitleT(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Corps</Label>
        <Textarea rows={4} value={bodyT} onChange={(e) => setBodyT(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Image URL</Label>
        <Input className="h-9" value={imageT} onChange={(e) => setImageT(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Variables (optionnel, séparées par virgule)</Label>
        <Input className="h-9" value={varsRaw} onChange={(e) => setVarsRaw(e.target.value)} />
      </div>
    </div>
  );
}
