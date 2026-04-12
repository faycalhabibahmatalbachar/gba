/** Aligné sur GET/PATCH `/api/admin/[id]/permissions` — matrice + accès pages. */
export const ADMIN_PERM_SCOPES = [
  'users',
  'orders',
  'products',
  'categories',
  'drivers',
  'messages',
  'notifications',
  'security',
  'settings',
  'reports',
] as const;

export type AdminPermScope = (typeof ADMIN_PERM_SCOPES)[number];

export const ADMIN_PERM_ACTIONS = ['create', 'read', 'update', 'delete'] as const;

export type AdminPermAction = (typeof ADMIN_PERM_ACTIONS)[number];

export const ADMIN_PAGE_ACCESS_KEYS: { path: string; label: string }[] = [
  { path: '/orders', label: 'Commandes' },
  { path: '/products', label: 'Produits' },
  { path: '/products/categories', label: 'Catégories' },
  { path: '/drivers', label: 'Livreurs' },
  { path: '/users', label: 'Utilisateurs' },
  { path: '/messages', label: 'Messages' },
  { path: '/notifications', label: 'Notifications' },
  { path: '/security', label: 'Sécurité' },
  { path: '/settings', label: 'Paramètres' },
  { path: '/audit', label: 'Audit' },
];
