'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileText, Shield, Trash2, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { parseApiJson } from '@/lib/fetch-api-json';

type MediaRow = { path: string; name: string; size: number; created_at?: string; url: string | null };

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SecurityMediaSection() {
  const copyText = React.useCallback(async (value: string) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success('URL copiée');
    } catch {
      toast.error('Impossible de copier');
    }
  }, []);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [incident, setIncident] = React.useState({
    media_path: '',
    title: '',
    note: '',
    alert_id: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
  });

  const mediaQ = useQuery({
    queryKey: ['security-media'],
    queryFn: async () => {
      const r = await fetch('/api/security/media', { credentials: 'include' });
      const x = await parseApiJson<{ data?: MediaRow[]; error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Erreur');
      return (x.data || []) as MediaRow[];
    },
  });

  const incidentFeedQ = useQuery({
    queryKey: ['security-incident-links'],
    queryFn: async () => {
      const r = await fetch('/api/audit?limit=60', { credentials: 'include' });
      const x = await parseApiJson<{ logs?: Record<string, unknown>[]; error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Audit indisponible');
      const logs = x.logs ?? [];
      return logs.filter((row) => {
        const d = String(row.description || '');
        const meta = (row.metadata || {}) as Record<string, unknown>;
        return d.includes('Association media') || Boolean(meta.media_path);
      });
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const r = await fetch('/api/security/media', { method: 'POST', credentials: 'include', body: fd });
      const x = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Upload échoué');
      return x;
    },
    onSuccess: () => {
      toast.success('Médias uploadés');
      void mediaQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (path: string) => {
      const r = await fetch(`/api/security/media?path=${encodeURIComponent(path)}`, { method: 'DELETE', credentials: 'include' });
      const x = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Suppression échouée');
      return x;
    },
    onSuccess: () => {
      toast.success('Média supprimé');
      void mediaQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('mode', 'link_incident');
      fd.append('media_path', incident.media_path);
      fd.append('note', JSON.stringify({ title: incident.title, body: incident.note, severity: incident.severity }));
      fd.append('alert_id', incident.alert_id);
      const r = await fetch('/api/security/media', { method: 'POST', credentials: 'include', body: fd });
      const x = await parseApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(x.error || 'Liaison échouée');
      return x;
    },
    onSuccess: () => {
      toast.success('Incident lié au média');
      setIncident({ media_path: '', title: '', note: '', alert_id: '', severity: 'medium' });
      void incidentFeedQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Documents & Médias de sécurité</h3>
        <p className="text-xs text-muted-foreground">Stockez rapports d'incident, captures et documents sensibles.</p>
      </div>
      <div
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length) uploadMut.mutate(files);
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center transition hover:border-primary hover:bg-primary/5"
      >
        <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Déposer des fichiers de sécurité</p>
        <p className="mt-1 text-sm text-muted-foreground">Images (JPG, PNG), PDF · Max 25MB par fichier</p>
        <input ref={inputRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.pdf,.webp" onChange={(e) => uploadMut.mutate(Array.from(e.target.files || []))} />
      </div>
      {uploadMut.isPending ? <p className="text-xs text-muted-foreground">Upload en cours...</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        {(mediaQ.data || []).map((m) => {
          const isPdf = m.name.toLowerCase().endsWith('.pdf');
          return isPdf ? (
            <div key={m.path} className="rounded-lg border p-3 flex items-center gap-3">
              <FileText className="h-8 w-8 text-red-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{fmtBytes(m.size)}</p>
              </div>
              <div className="flex gap-1">
                {m.url ? (
                  <Button size="sm" variant="outline" onClick={() => window.open(m.url || '', '_blank')}>
                    Voir
                  </Button>
                ) : null}
                {m.url ? (
                  <Button size="sm" variant="outline" onClick={() => window.open(m.url || '', '_blank')}>
                    Télécharger
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(m.path)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ) : (
            <div key={m.path} className="rounded-lg border overflow-hidden">
              {m.url ? <img src={m.url} className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-muted" />}
              <div className="p-2">
                <p className="truncate text-xs">{m.name}</p>
                <div className="mt-1 flex gap-1">
                  {m.url ? <Button size="sm" variant="outline" onClick={() => window.open(m.url || '', '_blank')}>Voir</Button> : null}
                  {m.url ? (
                    <Button size="sm" variant="outline" onClick={() => window.open(m.url || '', '_blank')}>Télécharger</Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => void copyText(m.url || '')}>Copier URL</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(m.path)}>×</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Journal d'incidents (liaison média)</p>
          <span className="text-[10px] text-muted-foreground">Enregistré dans audit_logs + métadonnées structurées</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Média enregistré</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={incident.media_path}
              onChange={(e) => setIncident((p) => ({ ...p, media_path: e.target.value }))}
            >
              <option value="">Sélectionnez un fichier téléversé…</option>
              {(mediaQ.data || []).map((m) => (
                <option key={m.path} value={m.path}>
                  {m.name} · {m.path}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Gravité</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={incident.severity}
              onChange={(e) =>
                setIncident((p) => ({ ...p, severity: e.target.value as 'low' | 'medium' | 'high' }))
              }
            >
              <option value="low">Faible</option>
              <option value="medium">Modérée</option>
              <option value="high">Élevée</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Titre court (interne)</Label>
          <Input
            value={incident.title}
            onChange={(e) => setIncident((p) => ({ ...p, title: e.target.value }))}
            placeholder="Ex. accès suspect, fuite credentials…"
          />
        </div>
        <div>
          <Label>Référence alerte / ticket (optionnel)</Label>
          <Input value={incident.alert_id} onChange={(e) => setIncident((p) => ({ ...p, alert_id: e.target.value }))} />
        </div>
        <div>
          <Label>Compte rendu détaillé</Label>
          <Textarea rows={4} value={incident.note} onChange={(e) => setIncident((p) => ({ ...p, note: e.target.value }))} />
        </div>
        <Button
          type="button"
          onClick={() => linkMut.mutate()}
          disabled={!incident.media_path || !incident.note.trim() || linkMut.isPending}
        >
          Enregistrer la liaison incident
        </Button>

        <div className="pt-2 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Dernières liaisons (extrait audit)</p>
          <div className="max-h-48 overflow-auto rounded-md border text-xs">
            <table className="w-full">
              <thead className="bg-muted/40 text-[10px] text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1">Date</th>
                  <th className="text-left px-2 py-1">Média</th>
                  <th className="text-left px-2 py-1">Résumé</th>
                </tr>
              </thead>
              <tbody>
                {(incidentFeedQ.data || []).map((row) => {
                  const meta = (row.metadata || {}) as Record<string, unknown>;
                  const path = String(meta.media_path || '');
                  let summary = String(meta.note || row.description || '');
                  try {
                    const j = JSON.parse(summary) as { title?: string; body?: string; severity?: string };
                    if (j && typeof j === 'object' && (j.title || j.body)) {
                      summary = [j.title, j.body].filter(Boolean).join(' — ');
                    }
                  } catch {
                    /* plain text */
                  }
                  return (
                    <tr key={String(row.id)} className="border-t border-border/60">
                      <td className="px-2 py-1 whitespace-nowrap">{String(row.created_at || '').slice(0, 19)}</td>
                      <td className="px-2 py-1 font-mono text-[10px] max-w-[140px] truncate">{path || '—'}</td>
                      <td className="px-2 py-1 max-w-[280px] truncate">{summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!incidentFeedQ.data?.length && !incidentFeedQ.isLoading ? (
              <p className="p-3 text-muted-foreground text-[11px]">Aucune liaison enregistrée pour l&apos;instant.</p>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
