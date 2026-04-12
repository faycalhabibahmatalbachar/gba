/** Microcopy FR — centre de commandement admin (fiche identité). */
export const adminProfileCopy = {
  drawerTitle: 'Administrateur',
  tabs: {
    presence: 'Présence',
    actions: 'Actions',
    permissions: 'Permissions',
    security: 'Sécurité',
    sessions: 'Sessions',
    profile: 'Profil',
  },
  header: {
    online: 'En ligne',
    offline: 'Hors ligne',
    chipMinutes: 'Temps connecté (mois)',
    chipLoginsOk: 'Connexions OK (30 j)',
    chipLoginsFail: 'Échecs (30 j)',
    chipScore: 'Score sécurité',
    quickMessage: 'Message interne',
    resetPassword: 'Réinitialiser le mot de passe',
    revokeSessions: 'Révoquer les sessions',
    suspend: 'Suspendre le compte',
    reactivate: 'Réactiver le compte',
    clonePerms: 'Cloner les permissions',
  },
  presence: {
    chartTitle: 'Activité (30 j)',
    heatmapTitle: 'Carte horaire (audit)',
    topPages: 'Pages les plus visitées (metadata)',
    emptyHeatmap: 'Pas assez de données pour la heatmap.',
  },
  actions: {
    empty: 'Aucune entrée d’audit pour cet utilisateur.',
    loadMore: 'Charger plus',
    detailTitle: 'Détail',
  },
  permissions: {
    matrixTitle: 'Matrice CRUD',
    pagesTitle: 'Accès aux pages',
    save: 'Enregistrer',
    superadminOnly: 'Réservé aux super administrateurs.',
    cloneTitle: 'Cloner depuis un autre admin',
    cloneHint: 'Copie la matrice et les accès pages.',
  },
  security: {
    loginHistory: 'Historique des connexions',
    sessionConfig: 'Durée de session (jours)',
    sessionConfigHint: 'Appliqué via paramètres de session (settings).',
  },
  sessions: {
    active: 'Sessions actives',
    history: 'Historique',
  },
  profile: {
    readOnly: 'Identifiant et métadonnées',
    internalNote: 'Note interne',
  },
  confirm: {
    suspendPhrase: 'SUSPENDRE',
    revokePhrase: 'RÉVOQUER',
    resetPhrase: 'RÉINITIALISER',
  },
  errors: {
    loadProfile: 'Impossible de charger le profil administrateur.',
  },
} as const;
