'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type Matrix = Record<string, Record<string, boolean>> | null;

type Ctx = {
  superadmin: boolean;
  permissions: Matrix;
  loading: boolean;
  can: (scope: string, action: 'create' | 'read' | 'update' | 'delete') => boolean;
  refresh: () => Promise<void>;
};

const AdminPermissionsContext = React.createContext<Ctx | null>(null);

function allows(matrix: Matrix, scope: string, action: 'create' | 'read' | 'update' | 'delete'): boolean {
  if (!matrix) return true;
  return Boolean(matrix[scope]?.[action]);
}

export function AdminPermissionsProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me-admin-permissions'],
    queryFn: async () => {
      const r = await fetch('/api/me/admin-permissions', { credentials: 'include' });
      const j = (await r.json()) as {
        superadmin?: boolean;
        permissions?: Record<string, Record<string, boolean>> | null;
        error?: string;
      };
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Permissions');
      return {
        superadmin: Boolean(j.superadmin),
        permissions: (j.permissions ?? null) as Matrix,
      };
    },
    staleTime: 60_000,
    retry: 1,
  });

  const value = React.useMemo<Ctx>(
    () => ({
      superadmin: q.data?.superadmin ?? false,
      permissions: q.data?.permissions ?? null,
      loading: q.isLoading,
      can(scope, action) {
        if (q.data?.superadmin) return true;
        return allows(q.data?.permissions ?? null, scope, action);
      },
      refresh: async () => {
        await qc.invalidateQueries({ queryKey: ['me-admin-permissions'] });
      },
    }),
    [q.data, q.isLoading, qc],
  );

  return <AdminPermissionsContext.Provider value={value}>{children}</AdminPermissionsContext.Provider>;
}

export function useAdminPermissions(): Ctx {
  const ctx = React.useContext(AdminPermissionsContext);
  if (!ctx) {
    return {
      superadmin: true,
      permissions: null,
      loading: false,
      can: () => true,
      refresh: async () => {},
    };
  }
  return ctx;
}
