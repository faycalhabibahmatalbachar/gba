'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Copy, Eye, FileText, ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type CmsRow = {
  slug: string;
  title: string;
  body_html?: string | null;
  is_published?: boolean;
  meta_description?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

async function fetchPages() {
  const { data, error } = await supabase.from('cms_pages').select('*').order('slug');
  if (error) throw error;
  return (data || []) as CmsRow[];
}

export default function CmsPage() {
  const qc = useQueryClient();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState({ body_html: '', is_published: false, meta_description: '' });

  const pagesQ = useQuery({ queryKey: ['cms-pages'], queryFn: fetchPages });

  const pages = pagesQ.data || [];
  const selected = pages.find((p) => p.slug === activeSlug) ?? pages[0] ?? null;

  useEffect(() => {
    if (!pages.length) return;
    if (!activeSlug) setActiveSlug(pages[0].slug);
  }, [pages, activeSlug]);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      body_html: selected.body_html || '',
      is_published: !!selected.is_published,
      meta_description: String(selected.meta_description || ''),
    });
  }, [selected?.slug, selected?.updated_at]);

  const saveMut = useMutation({
    mutationFn: async (payload: { slug: string; body_html: string; is_published: boolean; meta_description: string }) => {
      const { error } = await supabase
        .from('cms_pages')
        .update({
          body_html: payload.body_html,
          is_published: payload.is_published,
          meta_description: payload.meta_description || null,
        })
        .eq('slug', payload.slug);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cms-pages'] });
      toast.success('Page enregistrée');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateBody = () => {
    void navigator.clipboard.writeText(draft.body_html);
    toast.success('HTML copié — collez dans une nouvelle page ou éditeur externe');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CMS & contenu"
        subtitle="Pages statiques (cms_pages) · méta SEO · aperçu · bannières à part"
        actions={
          <Link href="/banners" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ImageIcon className="h-3.5 w-3.5 mr-1 inline" /> Bannières
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {pagesQ.isLoading && <Skeleton className="h-24 w-full" />}
            {pages.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => setActiveSlug(p.slug)}
                className={`w-full text-left rounded-md px-2 py-2 text-sm border ${
                  (activeSlug || pages[0]?.slug) === p.slug ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground font-mono">{p.slug}</div>
                <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                  <span
                    className={cn(
                      'rounded px-1',
                      p.is_published ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {p.is_published ? 'Publié' : 'Brouillon'}
                  </span>
                  {p.published_at ? (
                    <span className="text-muted-foreground">
                      pub. {format(new Date(p.published_at), 'dd MMM yyyy', { locale: fr })}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
            {!pagesQ.isLoading && pages.length === 0 && (
              <p className="text-xs text-muted-foreground">Table vide — exécutez la migration cms_static_pages.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">Édition</CardTitle>
            {selected ? (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={duplicateBody}>
                <Copy className="h-3.5 w-3.5" /> Dupliquer HTML
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
                  <div>
                    Dernière mise à jour :{' '}
                    {selected.updated_at
                      ? format(new Date(selected.updated_at), 'dd MMM yyyy HH:mm', { locale: fr })
                      : '—'}
                  </div>
                  <div>
                    Publié le :{' '}
                    {selected.published_at
                      ? format(new Date(selected.published_at), 'dd MMM yyyy HH:mm', { locale: fr })
                      : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={draft.is_published} onCheckedChange={(c) => setDraft((d) => ({ ...d, is_published: c }))} />
                  <Label className="text-xs">Publié sur le site</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Méta description (SEO)</Label>
                  <Input
                    value={draft.meta_description}
                    onChange={(e) => setDraft((d) => ({ ...d, meta_description: e.target.value }))}
                    placeholder="Résumé pour moteurs de recherche"
                    className="text-sm"
                  />
                </div>
                <Tabs defaultValue="edit">
                  <TabsList>
                    <TabsTrigger value="edit">Source HTML</TabsTrigger>
                    <TabsTrigger value="preview" className="gap-1">
                      <Eye className="h-3.5 w-3.5" /> Aperçu
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="pt-3">
                    <Textarea
                      rows={16}
                      className="font-mono text-xs min-h-[280px]"
                      value={draft.body_html}
                      onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="pt-3">
                    <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground mb-2">
                      Aperçu approximatif (styles app non injectés). Contenu utilisateur — ne collez que du HTML de confiance.
                    </div>
                    <iframe
                      title="preview"
                      sandbox="allow-same-origin"
                      className="w-full min-h-[320px] rounded-md border border-border bg-background"
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:system-ui,sans-serif;padding:16px;max-width:720px;margin:0 auto;}</style></head><body>${draft.body_html || '<p>(vide)</p>'}</body></html>`}
                    />
                  </TabsContent>
                </Tabs>
                <Button
                  onClick={() =>
                    saveMut.mutate({
                      slug: selected.slug,
                      body_html: draft.body_html,
                      is_published: draft.is_published,
                      meta_description: draft.meta_description,
                    })
                  }
                  disabled={saveMut.isPending}
                >
                  Enregistrer
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune page CMS.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
