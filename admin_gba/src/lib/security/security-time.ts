import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function parseIso(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Listes / tableaux : "11 avr. à 15:21" */
export function formatSecurityShortFr(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '—';
  return format(d, "d MMM. 'à' HH:mm", { locale: fr });
}

/** Détails : "samedi 11 avril 2026 à 15:21:27" */
export function formatSecurityLongFr(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '—';
  return format(d, "EEEE d MMMM yyyy 'à' HH:mm:ss", { locale: fr });
}

export function formatSecurityRelativeFr(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '—';
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}
