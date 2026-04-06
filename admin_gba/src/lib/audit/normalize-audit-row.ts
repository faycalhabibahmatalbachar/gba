const ACTION_TYPES = new Set([
  'create',
  'update',
  'delete',
  'view',
  'export',
  'bulk_create',
  'bulk_update',
  'bulk_delete',
  'bulk_export',
  'login',
  'logout',
  'permission_change',
  'status_change',
  'assign',
  'unassign',
  'approve',
  'reject',
  'send_notification',
  'refund',
  'cancel',
]);

const ENTITY_TYPES = new Set([
  'product',
  'order',
  'user',
  'profile',
  'category',
  'banner',
  'delivery',
  'driver',
  'message',
  'conversation',
  'review',
  'payment',
  'notification',
  'report',
  'setting',
  'role',
  'permission',
]);

export function coerceActionType(raw: unknown): string {
  const s = String(raw || '').trim();
  if (ACTION_TYPES.has(s)) return s;
  const lower = s.toLowerCase();
  if (ACTION_TYPES.has(lower)) return lower;
  if (s.includes('create')) return 'create';
  if (s.includes('delete')) return 'delete';
  if (s.includes('update') || s.includes('change')) return 'update';
  return 'view';
}

export function coerceEntityType(raw: unknown): string {
  const s = String(raw || 'profile').trim().toLowerCase();
  if (ENTITY_TYPES.has(s)) return s;
  return 'profile';
}

export function normalizeAuditStatus(raw: unknown): 'success' | 'failed' | 'partial' {
  if (raw === false) return 'failed';
  const s = String(raw || 'success').toLowerCase();
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'partial') return 'partial';
  return 'success';
}

export function normalizeAuditRow(row: Record<string, unknown>): Record<string, unknown> {
  const actionRaw = row.action_type ?? row.action ?? row.activity_type;
  const entityRaw = row.entity_type ?? row.resource_type;
  const userId = (row.user_id ?? row.actor_id) as string | undefined;
  const userEmail = (row.user_email ?? row.actor_email) as string | undefined;
  const userRole = (row.user_role ?? row.actor_role) as string | undefined;
  const desc =
    (row.action_description as string | undefined) ||
    (typeof row.metadata === 'object' && row.metadata && 'description' in row.metadata
      ? String((row.metadata as Record<string, unknown>).description)
      : undefined) ||
    (typeof row.action === 'string' ? row.action : undefined);

  let changes = row.changes;
  if (changes == null && row.before_data != null) {
    changes = { before: row.before_data, after: row.after_data };
  }

  return {
    id: row.id,
    created_at: row.created_at,
    user_id: userId ?? null,
    user_email: userEmail ?? null,
    user_role: userRole ?? 'admin',
    action_type: coerceActionType(actionRaw),
    action_description: desc ?? null,
    entity_type: coerceEntityType(entityRaw),
    entity_id: row.entity_id != null ? String(row.entity_id) : null,
    entity_name: row.entity_name ?? null,
    changes: changes ?? {},
    metadata: row.metadata ?? {},
    status: normalizeAuditStatus(row.status ?? row.success),
    error_message: row.error_message ?? null,
  };
}
