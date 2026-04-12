import { getServiceSupabase } from '@/lib/supabase/service-role';

export type ServerAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'bulk_create'
  | 'bulk_update'
  | 'bulk_delete'
  | 'bulk_export'
  | 'status_change'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'unassign'
  | 'login'
  | 'logout'
  | 'send_notification'
  | 'refund'
  | 'cancel'
  | 'permission_change';

export type ServerAuditEntity =
  | 'product'
  | 'category'
  | 'order'
  | 'user'
  | 'profile'
  | 'review'
  | 'driver'
  | 'delivery'
  | 'message'
  | 'conversation'
  | 'banner'
  | 'notification'
  | 'payment'
  | 'report'
  | 'setting'
  | 'role'
  | 'permission';

export interface WriteAuditLogInput {
  /** Null si action système / cron sans utilisateur authentifié */
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string;
  actionType: ServerAuditAction;
  entityType: ServerAuditEntity;
  entityId?: string;
  entityName?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  description?: string;
  metadata?: Record<string, unknown>;
  status?: 'success' | 'failed' | 'partial';
  errorMessage?: string;
}

/** Insert direct dans `audit_logs` (service role — contourne auth.uid() de la RPC). */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    const sb = getServiceSupabase();
    const platformDefault = input.actorUserId ? 'web-admin' : 'system';
    const metadata = {
      ...(input.metadata ?? {}),
      platform: (input.metadata?.platform as string | undefined) ?? platformDefault,
    };
    const { error } = await sb.from('audit_logs').insert({
      user_id: input.actorUserId ?? null,
      user_email: input.actorEmail ?? null,
      user_role: input.actorRole ?? 'admin',
      action_type: input.actionType,
      action_description: input.description ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_name: input.entityName ?? null,
      changes: input.changes ?? {},
      metadata,
      status: input.status ?? 'success',
      error_message: input.errorMessage ?? null,
    });
    if (error) {
      console.error('[audit] insert failed', error.message, error.code);
    }
  } catch (e) {
    console.error('[audit] exception', e);
  }
}

export async function fetchActorRole(userId: string): Promise<string> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb.from('profiles').select('role').eq('id', userId).maybeSingle();
    const r = data?.role;
    return typeof r === 'string' ? r : 'admin';
  } catch {
    return 'admin';
  }
}
