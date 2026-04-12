'use client';

import * as React from 'react';
import { UserClientSheet } from './sheets/UserClientSheet';
import { UserDriverSheet } from './sheets/UserDriverSheet';
import { AdminProfileSheet } from './sheets/AdminProfileSheet';

type Row = Record<string, unknown> & { id: string };

export interface UserDetailDrawerProps {
  user: Row | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function normalizeRole(role: unknown): string {
  const r = String(role || '').toLowerCase();
  return r === 'super_admin' ? 'superadmin' : r;
}

/** Routage fiche utilisateur selon le rôle (liste / profil). */
export function UserDetailDrawer({ user, open, onOpenChange }: UserDetailDrawerProps) {
  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isDriver = role === 'driver';
  const isSuperTarget = role === 'superadmin';

  if (!user) return null;
  if (isAdmin) {
    return (
      <AdminProfileSheet
        user={user}
        open={open}
        onOpenChange={onOpenChange}
        isSuperAdminTarget={isSuperTarget}
      />
    );
  }
  if (isDriver) {
    return <UserDriverSheet user={user} open={open} onOpenChange={onOpenChange} />;
  }
  return <UserClientSheet user={user} open={open} onOpenChange={onOpenChange} />;
}
