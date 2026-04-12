'use client';

import { useAdminPermissions } from '@/components/providers/AdminPermissionsProvider';

const ACTION_MAP = {
  read: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
} as const;

export type PermissionToken = `${string}.${'read' | 'create' | 'update' | 'delete'}`;

/**
 * Parse `module.action` (ex. `orders.read`) et délègue à la matrice admin.
 */
export function useHasPermission(token: PermissionToken): boolean {
  const { can, superadmin } = useAdminPermissions();
  const i = token.indexOf('.');
  if (i <= 0) return superadmin;
  const scope = token.slice(0, i);
  const act = token.slice(i + 1) as keyof typeof ACTION_MAP;
  const mapped = ACTION_MAP[act];
  if (!mapped) return superadmin;
  if (superadmin) return true;
  return can(scope, mapped);
}
