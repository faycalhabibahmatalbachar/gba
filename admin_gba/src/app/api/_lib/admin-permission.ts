import { NextResponse } from 'next/server';
import { requireAdmin, type AdminAuthResult } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export type AdminPermissionAction = 'create' | 'read' | 'update' | 'delete';

/** Superadmin : ignore la matrice stockée */
export async function isSuperAdminProfile(userId: string): Promise<boolean> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb.from('profiles').select('role').eq('id', userId).maybeSingle();
    const r = data?.role;
    return r === 'superadmin' || r === 'super_admin';
  } catch {
    return false;
  }
}

export async function loadAdminPermissionMatrix(
  userId: string,
): Promise<Record<string, Record<string, boolean>> | null> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb.from('settings').select('value').eq('key', `admin_permissions_${userId}`).maybeSingle();
    const v = data?.value;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, Record<string, boolean>>;
  } catch {
    return null;
  }
}

export function matrixAllows(
  matrix: Record<string, Record<string, boolean>> | null,
  scope: string,
  action: AdminPermissionAction,
): boolean {
  if (!matrix) return true;
  return Boolean(matrix[scope]?.[action]);
}

/**
 * Après requireAdmin : vérifie la matrice `settings.admin_permissions_<userId>`.
 * Absence de ligne settings = accès complet (rétrocompatibilité).
 */
export async function requireAdminPermission(
  scope: string,
  action: AdminPermissionAction,
): Promise<AdminAuthResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  try {
    if (await isSuperAdminProfile(auth.userId)) return auth;
    const matrix = await loadAdminPermissionMatrix(auth.userId);
    if (matrixAllows(matrix, scope, action)) return auth;
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès refusé pour cette action' }, { status: 403 }),
    };
  } catch {
    return auth;
  }
}
