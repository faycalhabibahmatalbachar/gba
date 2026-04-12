'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const FIELD_LABELS_FR: Record<string, string> = {
  name: 'Nom',
  slug: 'Identifiant URL',
  is_active: 'Statut actif',
  stock_quantity: 'Quantité en stock',
  price: 'Prix',
  status: 'Statut',
  role: 'Rôle',
  description: 'Description',
  email: 'E-mail',
  phone: 'Téléphone',
  first_name: 'Prénom',
  last_name: 'Nom',
  avatar_url: 'Photo',
  city: 'Ville',
  country: 'Pays',
  total_amount: 'Montant total',
  payment_status: 'Statut paiement',
  quantity: 'Quantité',
  unit_price: 'Prix unitaire',
  created_at: 'Créé le',
  updated_at: 'Mis à jour le',
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Aplatit un niveau : { a: { b: 1 } } → { 'a.b': 1 } */
function flattenOneLevel(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) && Object.keys(v).length > 0 && !Array.isArray(v)) {
      Object.assign(out, flattenOneLevel(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function formatCellValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof v === 'boolean') return <span>{v ? 'Oui' : 'Non'}</span>;
  if (typeof v === 'number') return <span className="font-mono tabular-nums">{String(v)}</span>;
  if (typeof v === 'string') {
    const s = v.length > 120 ? `${v.slice(0, 120)}…` : v;
    return <span className="font-mono text-[11px] break-all">{s}</span>;
  }
  try {
    return <span className="font-mono text-[11px] break-all">{JSON.stringify(v)}</span>;
  } catch {
    return String(v);
  }
}

type Row = { field: string; label: string; before: unknown; after: unknown };

function buildChangeRows(before: unknown, after: unknown): Row[] {
  const b = isPlainObject(before) ? flattenOneLevel(before) : {};
  const a = isPlainObject(after) ? flattenOneLevel(after) : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const rows: Row[] = [];
  for (const field of keys) {
    const bv = b[field];
    const av = a[field];
    const same = JSON.stringify(bv) === JSON.stringify(av);
    if (same) continue;
    rows.push({
      field,
      label: FIELD_LABELS_FR[field] ?? FIELD_LABELS_FR[field.split('.').pop() || ''] ?? field,
      before: bv,
      after: av,
    });
  }
  return rows;
}

export interface AuditFieldDiffTableProps {
  before: unknown;
  after: unknown;
  className?: string;
}

/**
 * Tableau de différences champ par champ (pas de JSON brut en vue principale).
 */
export function AuditFieldDiffTable({ before, after, className }: AuditFieldDiffTableProps) {
  const hasBefore = before != null && (typeof before !== 'object' || (isPlainObject(before) && Object.keys(before).length > 0));
  const hasAfter = after != null && (typeof after !== 'object' || (isPlainObject(after) && Object.keys(after).length > 0));

  if (!hasBefore && !hasAfter) {
    return <p className="text-xs italic text-muted-foreground">Aucune donnée de modification disponible</p>;
  }

  if (!hasBefore && hasAfter && isPlainObject(after)) {
    const flat = flattenOneLevel(after);
    return (
      <div className={cn('rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] dark:bg-emerald-950/40', className)}>
        <p className="border-b border-emerald-500/20 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Entrée créée
        </p>
        <table className="w-full text-xs">
          <tbody>
            {Object.entries(flat).map(([field, val]) => (
              <tr key={field} className="border-b border-border/50 last:border-0">
                <td className="w-[32%] px-3 py-2 align-top text-muted-foreground">{FIELD_LABELS_FR[field] ?? field}</td>
                <td className="px-3 py-2 text-emerald-900 dark:text-emerald-200">{formatCellValue(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (hasBefore && !hasAfter && isPlainObject(before)) {
    const flat = flattenOneLevel(before);
    return (
      <div className={cn('rounded-lg border border-red-500/25 bg-red-500/[0.06] dark:bg-red-950/40', className)}>
        <p className="border-b border-red-500/20 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Entrée supprimée
        </p>
        <table className="w-full text-xs">
          <tbody>
            {Object.entries(flat).map(([field, val]) => (
              <tr key={field} className="border-b border-border/50 last:border-0">
                <td className="w-[32%] px-3 py-2 align-top text-muted-foreground">{FIELD_LABELS_FR[field] ?? field}</td>
                <td className="px-3 py-2 text-red-900 dark:text-red-200">{formatCellValue(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const rows = buildChangeRows(before, after);
  if (rows.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Aucune donnée de modification disponible</p>;
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <p className="border-b border-border bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Modifications apportées
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/20 text-left text-[10px] uppercase text-muted-foreground">
            <th className="px-3 py-2 font-medium">Champ</th>
            <th className="px-3 py-2 font-medium">Avant</th>
            <th className="w-8 px-0 py-2 text-center font-medium" />
            <th className="px-3 py-2 font-medium">Après</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2 align-middle text-muted-foreground">{row.label}</td>
              <td className="max-w-[min(40vw,200px)] px-3 py-2 align-top bg-red-500/[0.08] text-red-900 dark:bg-[#3F0F0F] dark:text-red-200">
                {formatCellValue(row.before)}
              </td>
              <td className="px-0 py-2 text-center align-middle text-muted-foreground">
                <ArrowRight className="mx-auto h-3.5 w-3.5" aria-hidden />
              </td>
              <td className="max-w-[min(40vw,200px)] px-3 py-2 align-top bg-emerald-500/[0.08] text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                {formatCellValue(row.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
