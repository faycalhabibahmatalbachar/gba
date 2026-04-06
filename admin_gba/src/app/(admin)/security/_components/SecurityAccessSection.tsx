'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
type WlRow = {
  id: string;
  ip_cidr: string;
  description?: string | null;
  is_active?: boolean | null;
  expires_at?: string | null;
  created_at?: string;
};

type BlRow = {
  id: string;
  ip_cidr: string;
  reason?: string | null;
  expires_at?: string | null;
  created_at?: string;
};

async function j<T>(r: Response): Promise<T> {
  const x = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(typeof x.error === 'string' ? x.error : r.statusText);
  return x;
}

export function SecurityAccessSection() {
  const qc = useQueryClient();
  const [wlIp, setWlIp] = React.useState('');
  const [wlDesc, setWlDesc] = React.useState('');
  const [wlCsv, setWlCsv] = React.useState('');
  const [blIp, setBlIp] = React.useState('');
  const [blReason, setBlReason] = React.useState('');
  const [blDur, setBlDur] = React.useState<'1' | '24' | '168' | 'perm'>('24');
  const [blCsv, setBlCsv] = React.useState('');
  const [countries, setCountries] = React.useState('');
  const [maxConn, setMaxConn] = React.useState('2000');
  const [enforceBlock, setEnforceBlock] = React.useState(false);
  const [enforceAllowlist, setEnforceAllowlist] = React.useState(false);
  const [pingUrls, setPingUrls] = React.useState('https://www.google.com\nhttps://cloudflare.com');

  const wlQ = useQuery({
    queryKey: ['ip-whitelist'],
    queryFn: async () => {
      const r = await fetch('/api/security/ip-whitelist', { credentials: 'include' });
      const x = (await r.json()) as { data?: WlRow[] };
      if (!r.ok) throw new Error('Whitelist');
      return x.data ?? [];
    },
  });

  const blQ = useQuery({
    queryKey: ['ip-blacklist'],
    queryFn: async () => {
      const r = await fetch('/api/security/ip-blacklist', { credentials: 'include' });
      const x = (await r.json()) as { data?: BlRow[] };
      if (!r.ok) throw new Error('Blacklist');
      return x.data ?? [];
    },
  });

  const accessQ = useQuery({
    queryKey: ['security-access-settings'],
    queryFn: async () =>
      j<{
        data: {
          blocked_countries: string[];
          max_admin_connections_per_hour: number;
          enforce_country_block: boolean;
          enforce_ip_allowlist: boolean;
        };
      }>(await fetch('/api/settings/security-access', { credentials: 'include' })),
  });

  React.useEffect(() => {
    const d = accessQ.data?.data;
    if (!d) return;
    setCountries(d.blocked_countries.join(', '));
    setMaxConn(String(d.max_admin_connections_per_hour));
    setEnforceBlock(d.enforce_country_block);
    setEnforceAllowlist(d.enforce_ip_allowlist);
  }, [accessQ.data]);

  const addWl = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/security/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ip: wlIp.trim(), description: wlDesc.trim() || undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success('IP ajoutée à la whitelist');
      setWlIp('');
      setWlDesc('');
      void qc.invalidateQueries({ queryKey: ['ip-whitelist'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importWl = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/security/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ import_csv: true as const, csv: wlCsv }),
      });
      const x = (await r.json()) as { imported?: number; errors?: string[] };
      if (!r.ok) throw new Error(JSON.stringify(x));
      return x;
    },
    onSuccess: (x) => {
      toast.success(`Import : ${x.imported ?? 0} ligne(s)`);
      if (x.errors?.length) toast.message(String(x.errors.slice(0, 3).join('; ')));
      setWlCsv('');
      void qc.invalidateQueries({ queryKey: ['ip-whitelist'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBl = useMutation({
    mutationFn: async () => {
      const duration_hours =
        blDur === 'perm' ? null : blDur === '1' ? 1 : blDur === '24' ? 24 : 168;
      const r = await fetch('/api/security/ip-blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ip: blIp.trim(),
          reason: blReason.trim() || 'Blocage manuel',
          duration_hours,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success('IP ajoutée à la blacklist');
      setBlIp('');
      setBlReason('');
      void qc.invalidateQueries({ queryKey: ['ip-blacklist'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importBl = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/security/ip-blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          import_csv: true as const,
          csv: blCsv,
          default_reason: 'Import liste',
        }),
      });
      const x = (await r.json()) as { imported?: number; errors?: string[] };
      if (!r.ok) throw new Error(JSON.stringify(x));
      return x;
    },
    onSuccess: (x) => {
      toast.success(`Blacklist import : ${x.imported ?? 0}`);
      setBlCsv('');
      void qc.invalidateQueries({ queryKey: ['ip-blacklist'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAccess = useMutation({
    mutationFn: async () => {
      const blocked_countries = countries
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const r = await fetch('/api/settings/security-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          blocked_countries,
          max_admin_connections_per_hour: parseInt(maxConn, 10) || 2000,
          enforce_country_block: enforceBlock,
          enforce_ip_allowlist: enforceAllowlist,
        }),
      });
      return j<{ ok?: boolean }>(r);
    },
    onSuccess: () => {
      toast.success('Règles d’accès enregistrées — appliquées par le middleware (TTL ~20s)');
      void qc.invalidateQueries({ queryKey: ['security-access-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pingMut = useMutation({
    mutationFn: async () => {
      const targets = pingUrls
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      const r = await fetch('/api/security/connectivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targets }),
      });
      return j<{ data: { url: string; ok: boolean; status?: number; ms: number; error?: string }[] }>(r);
    },
    onSuccess: (d) => {
      const bad = d.data.filter((x) => !x.ok);
      if (bad.length === 0) toast.success('Toutes les URLs ont répondu');
      else {
        const lines = bad.map((x) => `${x.url} → ${x.error || x.status || 'erreur'}`).slice(0, 5);
        toast.error(`${bad.length} échec(s) sur ${d.data.length}`, {
          description: lines.join('\n'),
          duration: 12_000,
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delWl = async (id: string) => {
    const r = await fetch(`/api/security/ip-whitelist/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) return toast.error(await r.text());
    toast.success('Entrée supprimée');
    void qc.invalidateQueries({ queryKey: ['ip-whitelist'] });
  };

  const delBl = async (id: string) => {
    const r = await fetch(`/api/security/ip-blacklist/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) return toast.error(await r.text());
    toast.success('Entrée supprimée');
    void qc.invalidateQueries({ queryKey: ['ip-blacklist'] });
  };

  const toggleWl = async (row: WlRow) => {
    if (row.is_active === undefined) return;
    const r = await fetch(`/api/security/ip-whitelist/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_active: !row.is_active }),
    });
    if (!r.ok) return toast.error(await r.text());
    void qc.invalidateQueries({ queryKey: ['ip-whitelist'] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Whitelist IP</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>IP ou CIDR</Label>
            <Input value={wlIp} onChange={(e) => setWlIp(e.target.value)} placeholder="203.0.113.10" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={wlDesc} onChange={(e) => setWlDesc(e.target.value)} />
          </div>
        </div>
        <Button size="sm" type="button" onClick={() => addWl.mutate()} disabled={!wlIp.trim() || addWl.isPending}>
          Ajouter
        </Button>
        <div>
          <Label>Import CSV (ip[,description] par ligne)</Label>
          <Textarea value={wlCsv} onChange={(e) => setWlCsv(e.target.value)} rows={3} className="font-mono text-xs" />
          <Button size="sm" variant="outline" className="mt-2" type="button" onClick={() => importWl.mutate()} disabled={!wlCsv.trim()}>
            Importer CSV
          </Button>
        </div>
        <div className="max-h-48 overflow-auto text-xs border rounded-md">
          {wlQ.isLoading ? (
            <Skeleton className="h-20 m-2" />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">CIDR</th>
                  <th className="p-2">Actif</th>
                  <th className="p-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {(wlQ.data || []).map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="p-2 font-mono">{String(r.ip_cidr)}</td>
                    <td className="p-2">
                      {typeof r.is_active === 'boolean' ? (
                        <Switch checked={r.is_active} onCheckedChange={() => void toggleWl(r)} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-2">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" type="button" onClick={() => void delWl(r.id)}>
                        Suppr.
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Blacklist IP</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>IP ou CIDR</Label>
            <Input value={blIp} onChange={(e) => setBlIp(e.target.value)} />
          </div>
          <div>
            <Label>Durée</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={blDur}
              onChange={(e) => setBlDur(e.target.value as typeof blDur)}
            >
              <option value="1">1 h</option>
              <option value="24">24 h</option>
              <option value="168">7 j</option>
              <option value="perm">Permanent</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Motif</Label>
          <Input value={blReason} onChange={(e) => setBlReason(e.target.value)} />
        </div>
        <Button size="sm" type="button" onClick={() => addBl.mutate()} disabled={!blIp.trim() || addBl.isPending}>
          Bloquer
        </Button>
        <div>
          <Label>Import CSV (une IP par ligne)</Label>
          <Textarea value={blCsv} onChange={(e) => setBlCsv(e.target.value)} rows={3} className="font-mono text-xs" />
          <Button size="sm" variant="outline" className="mt-2" type="button" onClick={() => importBl.mutate()} disabled={!blCsv.trim()}>
            Importer
          </Button>
        </div>
        <div className="max-h-48 overflow-auto text-xs border rounded-md">
          {blQ.isLoading ? (
            <Skeleton className="h-20 m-2" />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">CIDR</th>
                  <th className="p-2">Motif</th>
                  <th className="p-2">Expire</th>
                  <th className="p-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {(blQ.data || []).map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="p-2 font-mono">{String(r.ip_cidr)}</td>
                    <td className="p-2 max-w-[120px] truncate">{r.reason || '—'}</td>
                    <td className="p-2 whitespace-nowrap">{r.expires_at ? String(r.expires_at).slice(0, 16) : '—'}</td>
                    <td className="p-2">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" type="button" onClick={() => void delBl(r.id)}>
                        Suppr.
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3 lg:col-span-2">
        <h3 className="text-sm font-semibold">Pays, liste blanche IP & plafond API (middleware)</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Pays bloqués (codes ISO2, virgules)</Label>
            <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="RU, CN, KP" />
          </div>
          <div>
            <Label>Max connexions admin / heure</Label>
            <Input value={maxConn} onChange={(e) => setMaxConn(e.target.value)} type="number" min={1} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={enforceBlock} onCheckedChange={setEnforceBlock} id="enc" />
            <Label htmlFor="enc">Bloquer pays (CF-IPCountry / Vercel) si listé</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enforceAllowlist} onCheckedChange={setEnforceAllowlist} id="eal" />
            <Label htmlFor="eal">Exiger IP dans la whitelist (si au moins une entrée active)</Label>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Plafond : compté sur les requêtes <span className="font-mono">/api/*</span> par utilisateur authentifié (fenêtre 1 h).
        </p>
        <Button size="sm" type="button" onClick={() => saveAccess.mutate()} disabled={saveAccess.isPending}>
          Enregistrer
        </Button>

        <div className="border-t pt-3 mt-2">
          <Label>Test connectivité (une URL par ligne, max 8)</Label>
          <Textarea value={pingUrls} onChange={(e) => setPingUrls(e.target.value)} rows={3} className="font-mono text-xs" />
          <Button size="sm" variant="outline" className="mt-2" type="button" onClick={() => pingMut.mutate()} disabled={pingMut.isPending}>
            Lancer test HEAD
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">Les échecs s’affichent en toast avec détail.</p>
        </div>
      </Card>
    </div>
  );
}
