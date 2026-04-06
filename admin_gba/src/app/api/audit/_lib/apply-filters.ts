/** Filtres communs GET /api/audit et POST /api/audit/export */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAuditLogFilters(q: any, p: {
  entityType?: string | null;
  entityId?: string | null;
  actionType?: string | null;
  actorId?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  ip?: string | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  let x = q;
  if (p.entityType && p.entityType !== 'all') x = x.eq('entity_type', p.entityType);
  if (p.entityId) x = x.eq('entity_id', p.entityId);
  if (p.actionType && p.actionType !== 'all') x = x.eq('action_type', p.actionType);
  if (p.actorId) x = x.eq('user_id', p.actorId);
  if (p.status && p.status !== 'all') x = x.eq('status', p.status);
  if (p.from) x = x.gte('created_at', p.from);
  if (p.to) x = x.lte('created_at', p.to);
  if (p.ip?.trim()) {
    const esc = p.ip.trim().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    x = x.or(`metadata->>ip.ilike.%${esc}%,metadata->>ip_address.ilike.%${esc}%`);
  }
  return x;
}
