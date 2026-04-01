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
import { Plus, Pencil, Trash2, Check, X, Tag } from 'lucide-react';

type Category = { id: string; name: string; slug?: string | null; product_count?: number };

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name');
  if (error) throw error;
  return (data || []) as Category[];
}

async function createCategory(name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const { error } = await supabase.from('categories').insert({ name, slug });
  if (error) throw error;
}

async function updateCategory(id: string, name: string) {
  const { error } = await supabase.from('categories').update({ name }).eq('id', id);
  if (error) throw error;
}

async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const query = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 30_000 });

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setNewName(''); toast.success('Catégorie créée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null); toast.success('Catégorie mise à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setToDelete(null); toast.success('Catégorie supprimée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const cats = query.data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catégories"
        subtitle={`${cats.length} catégorie${cats.length !== 1 ? 's' : ''}`}
      />

      {/* Add form */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Ajouter une catégorie</p>
        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); if (newName.trim()) createMut.mutate(newName.trim()); }}
        >
          <Input
            placeholder="Nom de la catégorie..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-8 text-sm max-w-xs"
          />
          <Button type="submit" size="sm" className="h-8" disabled={!newName.trim() || createMut.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Ajouter
          </Button>
        </form>
      </Card>

      {/* List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Slug</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.isLoading && [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={3} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
              ))}
              {!query.isLoading && cats.map(cat => (
                <tr key={cat.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    {editId === cat.id ? (
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-7 text-sm max-w-xs"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') updateMut.mutate({ id: cat.id, name: editName });
                          if (e.key === 'Escape') setEditId(null);
                        }}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{cat.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                    {cat.slug || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editId === cat.id ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600"
                            onClick={() => updateMut.mutate({ id: cat.id, name: editName })}
                            disabled={!editName.trim() || updateMut.isPending}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => { setEditId(cat.id); setEditName(cat.name); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setToDelete(cat)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!query.isLoading && cats.length === 0 && (
                <tr><td colSpan={3}>
                  <EmptyState icon={<Tag className="h-8 w-8" />} title="Aucune catégorie" />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title={`Supprimer "${toDelete?.name}"?`}
        description="Les produits de cette catégorie ne seront pas supprimés."
        confirmLabel="Supprimer"
        loading={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </div>
  );
}
