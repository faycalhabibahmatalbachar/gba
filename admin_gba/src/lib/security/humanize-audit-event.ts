import type { AuditActionType, AuditEntityType } from '@/lib/audit/audit-logger';

export type AuditLike = {
  action_type?: string;
  entity_type?: string;
  entity_name?: string | null;
  entity_id?: string | null;
  user_email?: string | null;
  action_description?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const ENTITY_FR: Record<string, string> = {
  product: 'Produit',
  order: 'Commande',
  user: 'Utilisateur',
  profile: 'Profil',
  category: 'Catégorie',
  banner: 'Bannière',
  delivery: 'Livraison',
  driver: 'Livreur',
  message: 'Message',
  conversation: 'Conversation',
  review: 'Avis',
  payment: 'Paiement',
  notification: 'Notification',
  report: 'Rapport',
  setting: 'Paramètre',
  role: 'Rôle',
  permission: 'Permission',
};

/**
 * Phrase unique pour flux sécurité / temps réel (jamais "update ok ISO…").
 */
export function humanizeAuditEvent(row: AuditLike): string {
  const desc = row.action_description?.trim();
  if (desc) return desc;

  const act = String(row.action_type || 'view') as AuditActionType;
  const ent = String(row.entity_type || 'profile') as AuditEntityType;
  const entLabel = ENTITY_FR[ent] || ent;
  const who = row.user_email?.trim() || 'un compte';
  const name = row.entity_name?.trim() || row.entity_id?.trim();

  const failed = row.status === 'failed';

  switch (act) {
    case 'create':
      return failed
        ? `Échec de création (${entLabel})`
        : name
          ? `Nouvel élément créé : ${entLabel} « ${name} »`
          : `Nouvel élément créé (${entLabel})`;
    case 'update':
      return failed
        ? `Échec de modification (${entLabel})`
        : name
          ? `${entLabel} modifié : « ${name} » — par ${who}`
          : `${entLabel} modifié — par ${who}`;
    case 'delete':
      return failed ? `Échec de suppression (${entLabel})` : `Élément supprimé (${entLabel}) — par ${who}`;
    case 'export':
      return `Export de données (${entLabel}) — par ${who}`;
    case 'login':
      return failed ? `Échec de connexion — ${who}` : `Connexion réussie — ${who}`;
    case 'logout':
      return `Déconnexion — ${who}`;
    case 'send_notification':
      return failed ? `Échec d’envoi de notification — ${who}` : `Notification envoyée — ${who}`;
    case 'permission_change':
      return `Permissions modifiées — ${who}`;
    case 'status_change':
      return `Statut modifié (${entLabel}) — ${who}`;
    default:
      return `Action « ${act} » sur ${entLabel} — ${who}`;
  }
}
