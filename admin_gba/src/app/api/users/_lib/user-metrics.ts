import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileListRow = Record<string, unknown>;

export async function loadOrderAggregatesForUsers(
  sb: SupabaseClient,
  userIds: string[],
): Promise<{
  orderCount: Record<string, number>;
  spent: Record<string, number>;
}> {
  const orderCount: Record<string, number> = {};
  const spent: Record<string, number> = {};
  if (!userIds.length) return { orderCount, spent };

  const { data: ordRows } = await sb
    .from('orders')
    .select('user_id, total_amount')
    .in('user_id', userIds)
    .limit(25000);

  for (const o of ordRows || []) {
    const uid = (o as { user_id: string }).user_id;
    if (!uid) continue;
    orderCount[uid] = (orderCount[uid] || 0) + 1;
    spent[uid] = (spent[uid] || 0) + Number((o as { total_amount: number | null }).total_amount || 0);
  }
  return { orderCount, spent };
}

export async function loadTokenCounts(sb: SupabaseClient, userIds: string[]): Promise<Record<string, number>> {
  const tokenCount: Record<string, number> = {};
  if (!userIds.length) return tokenCount;
  const { data: tokRows } = await sb.from('device_tokens').select('user_id, is_valid').in('user_id', userIds);
  for (const t of tokRows || []) {
    const u = (t as { user_id: string }).user_id;
    tokenCount[u] = (tokenCount[u] || 0) + 1;
  }
  return tokenCount;
}

export async function loadNotificationCounts(sb: SupabaseClient, userIds: string[]): Promise<Record<string, number>> {
  const m: Record<string, number> = {};
  if (!userIds.length) return m;
  const { data: rows } = await sb.from('notification_logs').select('user_id').in('user_id', userIds).limit(25000);
  for (const r of rows || []) {
    const u = (r as { user_id: string | null }).user_id;
    if (!u) continue;
    m[u] = (m[u] || 0) + 1;
  }
  return m;
}
