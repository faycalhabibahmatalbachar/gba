/** Montants XOF lisibles (analytics / dashboards) — évite les chaînes à 10+ chiffres bruts. */
export function formatXofCompact(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mrd F CFA`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M F CFA`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs).toLocaleString('fr-FR')} F CFA`;
  }
  return `${sign}${Math.round(abs)} F CFA`;
}

export const ORDER_STATUS_FR: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En traitement',
  ready_to_ship: 'Prête à expédier',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  completed: 'Complétée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
  unknown: 'Autre',
};

export function orderStatusLabel(status: string): string {
  const k = String(status || '').toLowerCase();
  return ORDER_STATUS_FR[k] ?? status;
}
