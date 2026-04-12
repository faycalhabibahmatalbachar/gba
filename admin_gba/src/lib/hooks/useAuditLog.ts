/**
 * React Hook for Audit Logging
 * 
 * Provides easy-to-use hooks for logging audit events in React components
 * 
 * @module useAuditLog
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  logAuditEvent,
  fetchAuditLogs,
  fetchAuditStatistics,
  exportAuditLogsToCSV,
  downloadAuditLogsCSV,
  type AuditLogOptions,
  type AuditLogFilters,
  type AuditLogEntry,
  type AuditStatistics,
  type AuditPageKpisResponse,
} from '@/lib/audit/audit-logger';

/**
 * Hook for logging audit events
 * 
 * @example
 * ```typescript
 * const { logEvent, isLogging } = useAuditLog();
 * 
 * const handleUpdate = async () => {
 *   await updateProduct(id, data);
 *   await logEvent({
 *     actionType: 'update',
 *     entityType: 'product',
 *     entityId: id,
 *     changes: { before: oldData, after: data }
 *   });
 * };
 * ```
 */
export function useAuditLog() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (options: AuditLogOptions) => logAuditEvent(options),
    onSuccess: () => {
      // Invalidate audit logs queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['audit-page-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['audit-cursor'] });
    },
  });

  const logEvent = useCallback(
    async (options: AuditLogOptions) => {
      try {
        await mutation.mutateAsync(options);
      } catch (error) {
        console.error('Failed to log audit event:', error);
      }
    },
    [mutation]
  );

  return {
    logEvent,
    isLogging: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook for fetching audit logs with filters
 * 
 * @example
 * ```typescript
 * const { logs, isLoading, totalCount, refetch } = useAuditLogs({
 *   entityType: 'product',
 *   startDate: new Date('2026-01-01'),
 *   limit: 50
 * });
 * ```
 */
export function useAuditLogs(filters: AuditLogFilters = {}) {
  const query = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => fetchAuditLogs(filters),
    staleTime: 30000, // 30 seconds
  });

  return {
    logs: query.data?.data || [],
    totalCount: query.data?.count || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching audit statistics
 * 
 * @example
 * ```typescript
 * const { statistics, isLoading } = useAuditStatistics();
 * ```
 */
export function useAuditStatistics() {
  const query = useQuery({
    queryKey: ['audit-statistics'],
    queryFn: fetchAuditStatistics,
    staleTime: 60000, // 1 minute
  });

  return {
    statistics: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * KPI agrégés (fenêtre 90 j par défaut, /api/audit/stats).
 */
export function useAuditPageKpis() {
  return useQuery({
    queryKey: ['audit-page-kpis'],
    queryFn: async (): Promise<AuditPageKpisResponse> => {
      const res = await fetch('/api/audit/stats', { credentials: 'include' });
      const j = (await res.json()) as AuditPageKpisResponse & { error?: string };
      if (!res.ok || !j.kpis) {
        throw new Error(typeof j.error === 'string' ? j.error : 'Indicateurs indisponibles');
      }
      return j;
    },
    staleTime: 60_000,
  });
}

/**
 * Hook for exporting audit logs
 * 
 * @example
 * ```typescript
 * const { exportLogs, isExporting } = useAuditExport();
 * 
 * const handleExport = async () => {
 *   await exportLogs({ entityType: 'product' });
 * };
 * ```
 */
export function useAuditExport() {
  const mutation = useMutation({
    mutationFn: async (filters: AuditLogFilters) => {
      const csv = await exportAuditLogsToCSV(filters);
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      downloadAuditLogsCSV(csv, filename);
    },
  });

  return {
    exportLogs: mutation.mutateAsync,
    isExporting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook for automatic audit logging of component actions
 * Wraps a function to automatically log when it's called
 * 
 * @example
 * ```typescript
 * const deleteProduct = useAuditedAction(
 *   async (id: string) => {
 *     await api.deleteProduct(id);
 *   },
 *   {
 *     actionType: 'delete',
 *     entityType: 'product',
 *     getEntityId: (id) => id,
 *     getDescription: (id) => `Deleted product ${id}`
 *   }
 * );
 * ```
 */
export function useAuditedAction<TArgs extends unknown[], TReturn>(
  action: (...args: TArgs) => Promise<TReturn>,
  auditConfig: {
    actionType: AuditLogOptions['actionType'];
    entityType: AuditLogOptions['entityType'];
    getEntityId?: (...args: TArgs) => string;
    getEntityName?: (...args: TArgs) => string;
    getDescription?: (...args: TArgs) => string;
    getChanges?: (...args: TArgs) => AuditLogOptions['changes'];
  }
) {
  const { logEvent } = useAuditLog();

  return useCallback(
    async (...args: TArgs): Promise<TReturn> => {
      let result: TReturn;
      let error: Error | null = null;

      try {
        result = await action(...args);
      } catch (e) {
        error = e as Error;
        throw e;
      } finally {
        // Log the action regardless of success/failure
        await logEvent({
          actionType: auditConfig.actionType,
          entityType: auditConfig.entityType,
          entityId: auditConfig.getEntityId?.(...args),
          entityName: auditConfig.getEntityName?.(...args),
          description: auditConfig.getDescription?.(...args),
          changes: auditConfig.getChanges?.(...args),
          status: error ? 'failed' : 'success',
          errorMessage: error?.message,
        });
      }

      return result!;
    },
    [action, auditConfig, logEvent]
  );
}
