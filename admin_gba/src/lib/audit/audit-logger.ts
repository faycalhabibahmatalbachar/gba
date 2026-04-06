/**
 * Audit Logger - Enterprise-grade audit trail system
 * 
 * This module provides comprehensive audit logging for all admin actions.
 * Every significant action should be logged for compliance, security, and debugging.
 * 
 * @module audit-logger
 */

import { supabase } from '@/lib/supabase/client';

// Type definitions matching Supabase enums
export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'bulk_create'
  | 'bulk_update'
  | 'bulk_delete'
  | 'bulk_export'
  | 'login'
  | 'logout'
  | 'permission_change'
  | 'status_change'
  | 'assign'
  | 'unassign'
  | 'approve'
  | 'reject'
  | 'send_notification'
  | 'refund'
  | 'cancel';

export type AuditEntityType =
  | 'product'
  | 'order'
  | 'user'
  | 'profile'
  | 'category'
  | 'banner'
  | 'delivery'
  | 'driver'
  | 'message'
  | 'conversation'
  | 'review'
  | 'payment'
  | 'notification'
  | 'report'
  | 'setting'
  | 'role'
  | 'permission';

export interface AuditLogEntry {
  id?: string;
  user_id?: string;
  user_email?: string;
  user_role?: string;
  action_type: AuditActionType;
  action_description?: string;
  entity_type: AuditEntityType;
  entity_id?: string;
  entity_name?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  bulk_operation_id?: string;
  status?: 'success' | 'failed' | 'partial';
  error_message?: string;
  created_at?: string;
}

export interface AuditLogOptions {
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  description?: string;
  bulkOperationId?: string;
  status?: 'success' | 'failed' | 'partial';
  errorMessage?: string;
}

/**
 * Logs an audit event to the database
 * 
 * @example
 * ```typescript
 * await logAuditEvent({
 *   actionType: 'update',
 *   entityType: 'product',
 *   entityId: '123',
 *   entityName: 'iPhone 15',
 *   changes: {
 *     before: { price: 1000 },
 *     after: { price: 900 }
 *   },
 *   description: 'Price updated from 1000 to 900'
 * });
 * ```
 */
export async function logAuditEvent(options: AuditLogOptions): Promise<string | null> {
  try {
    // Gather request metadata
    const metadata: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    // Call the Supabase function
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_action_type: options.actionType,
      p_entity_type: options.entityType,
      p_entity_id: options.entityId || null,
      p_entity_name: options.entityName || null,
      p_changes: options.changes || {},
      p_metadata: metadata,
      p_action_description: options.description || null,
      p_bulk_operation_id: options.bulkOperationId || null,
      p_status: options.status || 'success',
      p_error_message: options.errorMessage || null,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
      return null;
    }

    return data as string;
  } catch (error) {
    console.error('Exception logging audit event:', error);
    return null;
  }
}

/**
 * Generates a unique ID for bulk operations
 * Use this to group related audit logs together
 */
export function generateBulkOperationId(): string {
  return crypto.randomUUID();
}

/**
 * Logs multiple audit events as part of a bulk operation
 * 
 * @example
 * ```typescript
 * const bulkId = generateBulkOperationId();
 * await logBulkAuditEvents([
 *   { actionType: 'update', entityType: 'product', entityId: '1', ... },
 *   { actionType: 'update', entityType: 'product', entityId: '2', ... },
 * ], bulkId);
 * ```
 */
export async function logBulkAuditEvents(
  events: AuditLogOptions[],
  bulkOperationId?: string
): Promise<void> {
  const bulkId = bulkOperationId || generateBulkOperationId();
  
  await Promise.all(
    events.map(event => 
      logAuditEvent({
        ...event,
        bulkOperationId: bulkId,
      })
    )
  );
}

/**
 * Fetches audit logs with filtering and pagination
 */
export interface AuditLogFilters {
  userId?: string;
  actionType?: AuditActionType;
  entityType?: AuditEntityType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'success' | 'failed' | 'partial';
  ip?: string;
  limit?: number;
  offset?: number;
}

/** Filtres alignés sur `GET /api/audit?paginate=cursor` */
export type AuditStreamFilters = {
  entityType?: string;
  entityId?: string;
  actionType?: string;
  actorId?: string;
  status?: string;
  ip?: string;
  startDate?: Date;
  endDate?: Date;
};

export async function fetchAuditCursorPage(
  filters: AuditStreamFilters,
  cursor: string | null,
): Promise<{
  rows: AuditLogEntry[];
  nextCursor: string | null;
  meta: { total: number };
  kpis?: { actions_today: number; failures: number };
}> {
  if (typeof window === 'undefined') {
    return { rows: [], nextCursor: null, meta: { total: 0 } };
  }

  const params = new URLSearchParams();
  params.set('paginate', 'cursor');
  params.set('limit', '100');
  if (cursor) params.set('cursor', cursor);
  if (filters.entityType) params.set('entity_type', filters.entityType);
  if (filters.entityId) params.set('entity_id', filters.entityId);
  if (filters.actionType) params.set('action_type', filters.actionType);
  if (filters.actorId) params.set('actor_id', filters.actorId);
  if (filters.status) params.set('status', filters.status);
  if (filters.ip?.trim()) params.set('ip', filters.ip.trim());
  if (filters.startDate) params.set('from', filters.startDate.toISOString());
  if (filters.endDate) params.set('to', filters.endDate.toISOString());

  const res = await fetch(`/api/audit?${params.toString()}`, { credentials: 'include' });
  const j = (await res.json()) as {
    data?: AuditLogEntry[];
    logs?: AuditLogEntry[];
    nextCursor?: string | null;
    meta?: { total?: number };
    kpis?: { actions_today: number; failures: number };
    error?: string;
  };

  if (!res.ok) {
    console.error('fetchAuditCursorPage:', j.error || res.status);
    return { rows: [], nextCursor: null, meta: { total: 0 } };
  }

  const rows = j.data ?? j.logs ?? [];
  const mapped: AuditLogEntry[] = rows.map((r) => ({
    ...r,
    action_type: (r.action_type || 'view') as AuditActionType,
    entity_type: (r.entity_type || 'profile') as AuditEntityType,
    status: r.status || 'success',
  }));

  return {
    rows: mapped,
    nextCursor: j.nextCursor ?? null,
    meta: { total: j.meta?.total ?? mapped.length },
    kpis: j.kpis,
  };
}

function streamFiltersToExportBody(filters: AuditStreamFilters, format: 'csv' | 'json') {
  return {
    format,
    entity_type: filters.entityType,
    entity_id: filters.entityId,
    action_type: filters.actionType,
    actor_id: filters.actorId,
    status: filters.status,
    from: filters.startDate?.toISOString(),
    to: filters.endDate?.toISOString(),
    ip: filters.ip?.trim() || undefined,
    limit: 8000,
  };
}

export async function downloadAuditExport(filters: AuditStreamFilters, format: 'csv' | 'json'): Promise<void> {
  if (typeof window === 'undefined') return;
  const res = await fetch('/api/audit/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(streamFiltersToExportBody(filters, format)),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || 'Export échoué');
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition');
  const m = cd?.match(/filename="([^"]+)"/);
  const name = m?.[1] || `audit-export.${format === 'json' ? 'json' : 'csv'}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchAuditLogs(
  filters: AuditLogFilters = {}
): Promise<{ data: AuditLogEntry[]; count: number }> {
  if (typeof window === 'undefined') {
    return { data: [], count: 0 };
  }

  try {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (filters.userId) params.set('actor_id', filters.userId);
    if (filters.actionType) params.set('action_type', filters.actionType);
    if (filters.entityType) params.set('entity_type', filters.entityType);
    if (filters.status) params.set('status', filters.status);
    if (filters.startDate) params.set('from', filters.startDate.toISOString());
    if (filters.endDate) params.set('to', filters.endDate.toISOString());
    if (filters.ip?.trim()) params.set('ip', filters.ip.trim());

    const res = await fetch(`/api/audit?${params.toString()}`, { credentials: 'include' });
    const j = (await res.json()) as {
      data?: AuditLogEntry[];
      logs?: AuditLogEntry[];
      meta?: { total?: number };
      error?: string;
    };

    if (!res.ok) {
      console.error('fetchAuditLogs API:', j.error || res.status);
      return { data: [], count: 0 };
    }

    const rows = j.data ?? j.logs ?? [];
    const mapped: AuditLogEntry[] = rows.map((r) => ({
      ...r,
      action_type: (r.action_type || 'view') as AuditActionType,
      entity_type: (r.entity_type || 'profile') as AuditEntityType,
      status: r.status || 'success',
    }));

    return { data: mapped, count: j.meta?.total ?? mapped.length };
  } catch (error) {
    console.error('Exception fetching audit logs:', error);
    return { data: [], count: 0 };
  }
}

/**
 * Fetches audit statistics
 */
export interface AuditStatistics {
  date: string;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  user_role: string;
  event_count: number;
  unique_users: number;
  failed_count: number;
  success_count: number;
}

export async function fetchAuditStatistics(): Promise<AuditStatistics[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const res = await fetch('/api/audit/stats', { credentials: 'include' });
    const j = (await res.json()) as { statistics?: AuditStatistics[]; error?: string };
    if (!res.ok || !j.statistics?.length) {
      const { data } = await fetchAuditLogs({ limit: 500, offset: 0 });
      const now = new Date().toISOString().slice(0, 10);
      const bucket = new Map<string, AuditStatistics>();
      for (const row of data) {
        const key = [
          now,
          row.action_type || 'view',
          row.entity_type || 'profile',
          row.user_role || 'unknown',
        ].join('|');
        const prev = bucket.get(key) || {
          date: now,
          action_type: (row.action_type || 'view') as AuditActionType,
          entity_type: (row.entity_type || 'profile') as AuditEntityType,
          user_role: row.user_role || 'unknown',
          event_count: 0,
          unique_users: 0,
          failed_count: 0,
          success_count: 0,
        };
        prev.event_count += 1;
        if (row.status === 'failed') prev.failed_count += 1;
        else prev.success_count += 1;
        bucket.set(key, prev);
      }
      return Array.from(bucket.values());
    }
    return j.statistics;
  } catch (error) {
    console.error('Exception fetching audit statistics:', error);
    return [];
  }
}

/**
 * Exports audit logs to CSV
 */
export async function exportAuditLogsToCSV(filters: AuditLogFilters = {}): Promise<string> {
  const { data } = await fetchAuditLogs({ ...filters, limit: 10000 });
  
  // CSV headers
  const headers = [
    'Date/Time',
    'User Email',
    'User Role',
    'Action',
    'Entity Type',
    'Entity ID',
    'Entity Name',
    'Description',
    'Status',
    'Error Message',
  ];

  // CSV rows
  const rows = data.map(log => [
    log.created_at || '',
    log.user_email || '',
    log.user_role || '',
    log.action_type || '',
    log.entity_type || '',
    log.entity_id || '',
    log.entity_name || '',
    log.action_description || '',
    log.status || '',
    log.error_message || '',
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Downloads audit logs as CSV file
 */
export function downloadAuditLogsCSV(csvContent: string, filename = 'audit-logs.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
