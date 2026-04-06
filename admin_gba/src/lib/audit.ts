/**
 * Audit BFF — insert service role dans `audit_logs` (schéma migrations).
 * Préférer `logAudit` depuis les routes API pour une trace homogène.
 */
import { writeAuditLog, type ServerAuditAction, type ServerAuditEntity } from '@/lib/audit/server-audit';

export interface AuditPayload {
  action: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  actorName?: string;
  platform?: 'web' | 'app-client' | 'app-driver' | 'api-cron' | 'edge-function';
  ipAddress?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
}

const ENTITY_VALUES: ServerAuditEntity[] = [
  'product',
  'category',
  'order',
  'user',
  'profile',
  'review',
  'driver',
  'delivery',
  'message',
  'conversation',
  'banner',
  'notification',
  'payment',
  'report',
  'setting',
  'role',
  'permission',
];

function mapEntityType(raw?: string): ServerAuditEntity {
  if (!raw) return 'setting';
  const t = raw.toLowerCase().replace(/-/g, '_');
  if (ENTITY_VALUES.includes(t as ServerAuditEntity)) return t as ServerAuditEntity;
  if (t === 'drivers') return 'driver';
  if (t === 'products') return 'product';
  if (t === 'orders') return 'order';
  return 'setting';
}

function mapActionType(action: string): ServerAuditAction {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.endsWith('.delete')) return 'delete';
  if (a.includes('create') || a.endsWith('.create')) return 'create';
  if (a.includes('login')) return 'login';
  if (a.includes('logout')) return 'logout';
  if (a.includes('export')) return 'export';
  if (a.includes('bulk') && a.includes('create')) return 'bulk_create';
  if (a.includes('bulk') && a.includes('update')) return 'bulk_update';
  if (a.includes('bulk') && a.includes('delete')) return 'bulk_delete';
  if (a.includes('bulk') && a.includes('export')) return 'bulk_export';
  if (a.includes('refund')) return 'refund';
  if (a.includes('unassign')) return 'unassign';
  if (a.includes('assign')) return 'assign';
  if (a.includes('approve')) return 'approve';
  if (a.includes('reject')) return 'reject';
  if (a.includes('permission') || a.includes('role_change') || a.includes('.role')) return 'permission_change';
  if (a.includes('suspend') || a.includes('revoke') || a.includes('status')) return 'status_change';
  if (a.includes('push') || a.includes('notification') || a.includes('send_notification')) return 'send_notification';
  if (a.includes('cancel')) return 'cancel';
  return 'update';
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  const changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {};
  if (payload.beforeData) changes.before = payload.beforeData;
  if (payload.afterData) changes.after = payload.afterData;

  const metadata: Record<string, unknown> = {
    ...(payload.metadata ?? {}),
    platform: payload.platform ?? 'web',
    ...(payload.ipAddress ? { ip_address: payload.ipAddress } : {}),
    ...(payload.actorName ? { actor_name: payload.actorName } : {}),
    ...(payload.durationMs != null ? { duration_ms: payload.durationMs } : {}),
    semantic_action: payload.action,
  };

  await writeAuditLog({
    actorUserId: payload.actorId ?? null,
    actorEmail: payload.actorEmail ?? null,
    actorRole: payload.actorRole ?? 'admin',
    actionType: mapActionType(payload.action),
    entityType: mapEntityType(payload.entityType),
    entityId: payload.entityId ? String(payload.entityId) : undefined,
    description: payload.action,
    changes: Object.keys(changes).length ? changes : undefined,
    metadata,
    status: payload.success === false ? 'failed' : 'success',
    errorMessage: payload.errorMessage ?? undefined,
  });
}
