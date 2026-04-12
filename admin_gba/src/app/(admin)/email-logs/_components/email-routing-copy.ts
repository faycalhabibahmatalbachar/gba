/**
 * Source unique pour le routage email (onglet Politiques + info-bulles).
 * Pas de secrets — uniquement des faits sur les variables d’environnement.
 */
export const EMAIL_ROUTING_SUMMARY =
  'En mode auto, Resend est utilisé si RESEND_API_KEY est défini, sinon SMTP (EMAIL_PROVIDER=auto|resend|smtp).';

export const EMAIL_STATS_PERIOD_HINT =
  'Indicateurs : du 1er du mois civil à maintenant (UTC), comme le calcul serveur des statistiques.';

export const EMAIL_TRACEBILITY_SHORT =
  'Journal email_logs (statut, latence, identifiants). PJ manuelles : bucket email-attachments (URLs signées).';
