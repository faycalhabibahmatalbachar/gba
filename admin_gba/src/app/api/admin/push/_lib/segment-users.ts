import type { SupabaseClient } from '@supabase/supabase-js';

export type PushFilters = {
  role?: string;
  country?: string;
  platform?: 'ios' | 'android' | 'all' | string;
  valid_only?: boolean;
};

/**
 * Utilisateurs distincts éligibles pour une campagne push selon filtres (profils + device_tokens).
 */
export async function listUserIdsForPush(
  sb: SupabaseClient,
  filters: PushFilters,
  maxUsers: number,
): Promise<string[]> {
  const validOnly = filters.valid_only === true;
  const platform = filters.platform && filters.platform !== 'all' ? String(filters.platform).toLowerCase() : '';

  let tq = sb.from('device_tokens').select('user_id, platform, is_valid').limit(80_000);
  if (validOnly) tq = tq.eq('is_valid', true);

  const { data: toks, error: te } = await tq;
  if (te) throw new Error(te.message);

  let rows = toks || [];
  if (platform === 'ios') {
    rows = rows.filter((r: { platform?: string }) => /ios|iphone|ipad/i.test(String(r.platform || '')));
  } else if (platform === 'android') {
    rows = rows.filter((r: { platform?: string }) => /android/i.test(String(r.platform || '')));
  }

  let uids = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
  if (uids.length === 0) return [];

  let pq = sb.from('profiles').select('id').in('id', uids);
  if (filters.role && filters.role !== 'all') pq = pq.eq('role', filters.role);
  if (filters.country?.trim()) pq = pq.eq('country', filters.country.trim());

  const { data: profs, error: pe } = await pq.limit(maxUsers);
  if (pe) throw new Error(pe.message);

  const out = (profs || []).map((p: { id: string }) => p.id);
  return [...new Set(out)].slice(0, maxUsers);
}

export async function countEligibleUsers(sb: SupabaseClient, filters: PushFilters): Promise<number> {
  const ids = await listUserIdsForPush(sb, filters, 100_000);
  return ids.length;
}
