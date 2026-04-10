import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import {
  isSuperAdminProfile,
  loadAdminPermissionMatrix,
} from '@/app/api/_lib/admin-permission';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const superadmin = await isSuperAdminProfile(auth.userId);
    const permissions = superadmin ? null : await loadAdminPermissionMatrix(auth.userId);
    return NextResponse.json({
      user_id: auth.userId,
      superadmin,
      permissions,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
