'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowRightLeft,
  Bell,
  ClipboardList,
  Eye,
  FileDown,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatAuditSentence } from '@/lib/audit/format-audit-sentence';
import type { AuditLogEntry } from '@/lib/audit/audit-logger';

const ROW_H = 72;

function categoryIcon(actionType: string) {
  switch (actionType) {
    case 'create':
    case 'bulk_create':
      return Plus;
    case 'update':
    case 'bulk_update':
    case 'status_change':
      return Pencil;
    case 'delete':
    case 'bulk_delete':
      return Trash2;
    case 'view':
      return Eye;
    case 'export':
    case 'bulk_export':
      return FileDown;
    case 'login':
      return LogIn;
    case 'logout':
      return LogOut;
    case 'permission_change':
      return Shield;
    case 'assign':
    case 'unassign':
      return ArrowRightLeft;
    case 'send_notification':
      return Bell;
    default:
      return ClipboardList;
  }
}

export function auditRowHeight(): number {
  return ROW_H;
}

export function AuditLogRow({
  log,
  actionLabel,
  entityLabel,
  onClick,
  className,
}: {
  log: AuditLogEntry;
  actionLabel: string;
  entityLabel: string;
  onClick: () => void;
  className?: string;
}) {
  const Icon = categoryIcon(log.action_type);
  const sentence = formatAuditSentence(log);
  const display =
    log.actor_display_name?.trim() ||
    log.user_email?.trim() ||
    (log.user_id ? 'Utilisateur' : 'Système');
  const subRole = String(log.actor_profile_role || log.user_role || '').trim();
  const initials = display
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'absolute left-0 w-full grid grid-cols-[40px_108px_44px_minmax(0,1fr)_96px_80px_28px] gap-x-2 gap-y-0 px-3 py-1.5 text-left text-sm border-b border-border/60 hover:bg-muted/50 items-center',
        className,
      )}
      style={{ minHeight: ROW_H }}
    >
      <span className="flex justify-center text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </span>
      <span className="text-[11px] whitespace-nowrap tabular-nums text-muted-foreground">
        {log.created_at ? format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr }) : '—'}
      </span>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={log.actor_avatar_url || undefined} alt="" />
        <AvatarFallback className="text-[10px]">
          {initials ? initials : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex flex-col justify-center gap-0.5">
        <span className="truncate font-medium leading-tight">{display}</span>
        <span className="truncate text-[11px] text-muted-foreground leading-snug">{sentence}</span>
        {subRole ? (
          <span className="truncate text-[10px] text-muted-foreground/80">{subRole}</span>
        ) : null}
      </span>
      <Badge variant="outline" className="text-[10px] justify-center px-1 py-0 h-6">
        {actionLabel}
      </Badge>
      <Badge variant="secondary" className="text-[10px] justify-center px-1 py-0 h-6">
        {entityLabel}
      </Badge>
      <span className="text-muted-foreground text-lg leading-none justify-self-end">›</span>
    </button>
  );
}
