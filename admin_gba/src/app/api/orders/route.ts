import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import {
  applyListFilters,
  parseListFilterParams,
  type ListFilterParams,
} from '@/app/api/orders/_lib/order-list-filters';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  status: string | null;
  total_amount: number | null;
  user_id?: string | null;
  driver_id?: string | null;
  notes?: string | null;
  payment_method?: string | null;
};

function parseSpecialPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t) as unknown;
    return typeof j === 'object' && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function detectSpecialMobile(order: Pick<OrderRow, 'notes' | 'order_number'>, payload: Record<string, unknown> | null): boolean {
  const notes = String(order.notes || '').toLowerCase();
  const num = String(order.order_number || '').toLowerCase();
  if (notes.includes('special') || notes.includes('devis') || notes.includes('quotation')) return true;
  if (num.startsWith('sp-')) return true;
  if (!payload) return false;
  const keys = Object.keys(payload).map((k) => k.toLowerCase());
  return keys.some((k) => k.includes('special') || k.includes('quote') || k.includes('devis') || k.includes('custom'));
}

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

const SELECT_CANDIDATES = [
  `
  id,
  order_number,
  created_at,
  status,
  total_amount,
  user_id,
  driver_id,
  notes,
  payment_method
`,
  `
  id,
  order_number,
  created_at,
  status,
  total_amount,
  user_id,
  driver_id,
  notes
`,
  `
  id,
  created_at,
  status,
  total_amount,
  user_id,
  driver_id
`,
] as const;

const SORT_WHITELIST = new Set(['created_at', 'total_amount', 'status', 'order_number']);

export async function GET(req: Request) {
  const auth = await requireAdminPermission('orders', 'read');
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const url = new URL(req.url);
  const orderById = url.searchParams.get('id')?.trim();
  if (orderById && /^[0-9a-f-]{36}$/i.test(orderById)) {
    const { data, error } = await sb
      .from('orders')
      .select('id, created_at, status, order_number')
      .eq('id', orderById)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ order: data });
  }

  const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '20') || 20));
  const offset = (page - 1) * pageSize;
  const sortByRaw = url.searchParams.get('sortBy') || 'created_at';
  const sortBy = SORT_WHITELIST.has(sortByRaw) ? sortByRaw : 'created_at';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const ascending = sortOrder === 'asc';

  const filterParams: ListFilterParams = parseListFilterParams(url);

  const runSelect = async (selectStr: string, useMetadataFilter: boolean) => {
    const base = sb.from('orders').select(selectStr, { count: 'exact' });
    const filtered = applyListFilters(base, filterParams, useMetadataFilter);
    return filtered.order(sortBy, { ascending }).range(offset, offset + pageSize - 1);
  };

  let res:
    | { data: unknown[] | null; error: { message: string } | null; count: number | null }
    | null = null;

  for (const selectStr of SELECT_CANDIDATES) {
    const withMetadata = await runSelect(selectStr, true);
    if (!withMetadata.error) {
      res = withMetadata;
      break;
    }
    const msg = String(withMetadata.error.message || '');
    if (!/metadata|column orders\.metadata/i.test(msg)) continue;

    const withoutMetadata = await runSelect(selectStr, false);
    if (!withoutMetadata.error) {
      res = withoutMetadata;
      break;
    }
  }

  if (!res || res.error) {
    const errorMsg = res?.error?.message || 'Erreur inconnue lors de la lecture des commandes';
    console.error('[/api/orders] Supabase error:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }

  const rows = (res.data ?? []) as OrderRow[];
  const customerIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const driverIds = Array.from(new Set(rows.map((r) => r.driver_id).filter(Boolean))) as string[];

  const idsToLoad = Array.from(new Set([...customerIds, ...driverIds]));
  let profilesById = new Map<string, ProfileRow>();
  if (idsToLoad.length > 0) {
    const { data: profiles, error: profilesError } = await sb
      .from('profiles')
      .select('id, first_name, last_name, phone, email')
      .in('id', idsToLoad);

    if (profilesError) {
      console.error('[/api/orders] profiles enrichment error:', profilesError.message);
    } else {
      profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
    }
  }

  const mapped = rows.map((order) => {
    const customerProfile = order.user_id ? profilesById.get(order.user_id) : null;
    const driverProfile = order.driver_id ? profilesById.get(order.driver_id) : null;

    const customerName =
      [customerProfile?.first_name, customerProfile?.last_name].filter(Boolean).join(' ').trim() ||
      null;
    const driverName =
      [driverProfile?.first_name, driverProfile?.last_name].filter(Boolean).join(' ').trim() ||
      null;

    const specialPayload = parseSpecialPayload(order.notes ?? null);
    const isSpecialMobile = detectSpecialMobile(order, specialPayload);

    return {
      id: order.id,
      order_number: order.order_number ?? null,
      created_at: order.created_at,
      status: order.status ?? null,
      total_amount: order.total_amount ?? null,
      customer_name: customerName || null,
      customer_phone: customerProfile?.phone ?? null,
      customer_phone_profile: customerProfile?.phone ?? null,
      driver_id: order.driver_id ?? null,
      driver_name: driverName || null,
      notes: order.notes ?? null,
      payment_method: order.payment_method ?? null,
      items: [],
      item_count: 0,
      total_items: 0,
      is_special_mobile: isSpecialMobile,
      special_payload: specialPayload,
      quote_status: null,
    };
  });

  const total = res.count ?? mapped.length;
  return NextResponse.json({
    data: mapped,
    count: total,
    page,
    pageSize,
    meta: {
      total,
      page,
      limit: pageSize,
    },
  });
}
