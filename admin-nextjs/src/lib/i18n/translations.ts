/**
 * Système de traduction centralisé pour l'interface admin
 * Gère la traduction des statuts, méthodes de paiement, etc.
 */

// Statuts de commande
export const ORDER_STATUS_TRANSLATIONS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  out_for_delivery: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  failed: 'Échouée',
  refunded: 'Remboursée',
};

// Méthodes de paiement
export const PAYMENT_METHOD_TRANSLATIONS: Record<string, string> = {
  cash_on_delivery: 'Paiement à la livraison',
  cod: 'Paiement à la livraison',
  stripe_card: 'Carte bancaire (Stripe)',
  stripe: 'Carte bancaire (Stripe)',
  flutterwave_card: 'Carte bancaire (Flutterwave)',
  flutterwave: 'Carte bancaire (Flutterwave)',
  card: 'Carte bancaire',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
};

// Statuts de paiement
export const PAYMENT_STATUS_TRANSLATIONS: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Échoué',
  refunded: 'Remboursé',
  partially_refunded: 'Partiellement remboursé',
};

// Rôles utilisateur
export const ROLE_TRANSLATIONS: Record<string, string> = {
  admin: 'Administrateur',
  driver: 'Livreur',
  client: 'Client',
  user: 'Client',
  customer: 'Client',
};

/**
 * Traduit un statut de commande en français
 */
export function translateOrderStatus(status: string | null | undefined): string {
  if (!status) return '—';
  const normalized = String(status).toLowerCase().trim();
  return ORDER_STATUS_TRANSLATIONS[normalized] || status;
}

/**
 * Traduit une méthode de paiement en français
 */
export function translatePaymentMethod(method: string | null | undefined): string {
  if (!method) return '—';
  const normalized = String(method).toLowerCase().trim();
  return PAYMENT_METHOD_TRANSLATIONS[normalized] || method;
}

/**
 * Traduit un statut de paiement en français
 */
export function translatePaymentStatus(status: string | null | undefined): string {
  if (!status) return '—';
  const normalized = String(status).toLowerCase().trim();
  return PAYMENT_STATUS_TRANSLATIONS[normalized] || status;
}

/**
 * Traduit un rôle utilisateur en français
 */
export function translateRole(role: string | null | undefined): string {
  if (!role) return 'Client';
  const normalized = String(role).toLowerCase().trim();
  return ROLE_TRANSLATIONS[normalized] || role;
}

/**
 * Formate une durée en minutes en format lisible
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  } else {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
  }
}
