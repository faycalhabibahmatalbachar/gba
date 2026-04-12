import type { AuditLogEntry } from '@/lib/audit/audit-logger';

const ACTION_FR: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  view: 'Consultation',
  export: 'Export',
  bulk_create: 'Création en masse',
  bulk_update: 'Modification en masse',
  bulk_delete: 'Suppression en masse',
  bulk_export: 'Export en masse',
  login: 'Connexion',
  logout: 'Déconnexion',
  permission_change: 'Changement de permission',
  status_change: 'Changement de statut',
  assign: 'Attribution',
  unassign: 'Retrait',
  approve: 'Approbation',
  reject: 'Rejet',
  send_notification: 'Notification',
  refund: 'Remboursement',
  cancel: 'Annulation',
};

const ENTITY_FR: Record<string, string> = {
  product: 'produit',
  order: 'commande',
  user: 'utilisateur',
  profile: 'profil',
  category: 'catégorie',
  banner: 'bannière',
  delivery: 'livraison',
  driver: 'livreur',
  message: 'message',
  conversation: 'conversation',
  review: 'avis',
  payment: 'paiement',
  notification: 'notification',
  report: 'rapport',
  setting: 'paramètre',
  role: 'rôle',
  permission: 'permission',
};

/**
 * Phrase lisible (FR) pour une ligne d’audit — privilégie la description métier si présente.
 */
export function formatAuditSentence(entry: AuditLogEntry): string {
  const desc = entry.action_description?.trim();
  if (desc) return desc;

  const act = ACTION_FR[entry.action_type] || entry.action_type;
  const ent = ENTITY_FR[entry.entity_type] || entry.entity_type;
  const label = entry.entity_name?.trim() || entry.entity_id?.trim();

  if (label) {
    return `${act} — ${ent} « ${label} »`;
  }
  return `${act} — ${ent}`;
}
