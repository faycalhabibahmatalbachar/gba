/** Échappe les caractères spéciaux pour un motif ilike côté client PostgREST */
export function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Filtres communs GET /api/audit et POST /api/audit/export */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAuditLogFilters(q: any, p: {
  entityType?: string | null;
  entityId?: string | null;
  actionType?: string | null;
  /** Connexions : login + logout (prioritaire sur actionType) */
  connections?: boolean | null;
  actorId?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  ip?: string | null;
  /** Recherche plein texte sur colonnes principales (serveur) */
  search?: string | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  let x = q;
  if (p.entityType && p.entityType !== 'all') x = x.eq('entity_type', p.entityType);
  if (p.entityId) x = x.eq('entity_id', p.entityId);
  if (p.connections) {
    x = x.in('action_type', ['login', 'logout']);
  } else if (p.actionType && p.actionType !== 'all') {
    x = x.eq('action_type', p.actionType);
  }
  if (p.actorId) x = x.eq('user_id', p.actorId);
  if (p.status && p.status !== 'all') x = x.eq('status', p.status);
  if (p.from) x = x.gte('created_at', p.from);
  if (p.to) x = x.lte('created_at', p.to);
  if (p.ip?.trim()) {
    const esc = escapeIlikePattern(p.ip.trim());
    x = x.or(`metadata->>ip.ilike.%${esc}%,metadata->>ip_address.ilike.%${esc}%`);
  }
  const raw = p.search?.trim();
  if (raw) {
    const esc = escapeIlikePattern(raw);
    const pat = `%${esc}%`;
    x = x.or(
      [
        `user_email.ilike.${pat}`,
        `action_description.ilike.${pat}`,
        `entity_name.ilike.${pat}`,
        `entity_id.ilike.${pat}`,
        `user_role.ilike.${pat}`,
        `error_message.ilike.${pat}`,
      ].join(','),
    );
  }
  return x;
}
