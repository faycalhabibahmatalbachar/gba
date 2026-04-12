import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import {
  applyListFilters,
  parseListFilterParams,
  type ListFilterParams,
} from '@/app/api/orders/_lib/order-list-filters';

export const dynamic = 'force-dynamic';

type ProductEmbed = {
  id: string;
  name: string | null;
  main_image: string | null;
  sku: string | null;
} | null;

type OrderItemEmbed = {
  id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  product_id: string | null;
  product_name?: string | null;
  product_image?: string | null;
  products?: ProductEmbed | ProductEmbed[];
};

type DriverEmbed = {
  first_name: string | null;
  last_name: string | null;
} | null;

type OrderEmbedRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  updated_at?: string | null;
  status: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  total_amount: number | null;
  shipping_address?: unknown;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  driver_id?: string | null;
  /** Dénormalisé sur `orders` (préféré — l’embed profiles!orders_driver_id est souvent invalide si driver_id pointe vers auth.users). */
  driver_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  order_items?: OrderItemEmbed[] | null;
  driver_profile?: DriverEmbed | DriverEmbed[];
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

function detectSpecialMobile(order: OrderEmbedRow, payload: Record<string, unknown> | null): boolean {
  const notes = String(order.notes || '').toLowerCase();
  const num = String(order.order_number || '').toLowerCase();
  if (notes.includes('special') || notes.includes('devis') || notes.includes('quotation')) return true;
  if (num.startsWith('sp-')) return true;
  if (!payload) return false;
  const keys = Object.keys(payload).map((k) => k.toLowerCase());
  return keys.some((k) => k.includes('special') || k.includes('quote') || k.includes('devis') || k.includes('custom'));
}

function deriveQuoteStatus(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const candidates = [payload.quote_status, payload.devis_status, payload.quotation_status, payload.status_devis];
  const raw = candidates.find((v) => typeof v === 'string' && String(v).trim()) as string | undefined;
  if (!raw) return null;
  const k = raw.toLowerCase();
  if (k.includes('wait') || k.includes('pending') || k.includes('attente')) return 'en_attente';
  if (k.includes('answered') || k.includes('sent') || k.includes('repon')) return 'repondu';
  if (k.includes('expire')) return 'expire';
  return raw;
}

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function unwrapProduct(p: ProductEmbed | ProductEmbed[] | null | undefined): ProductEmbed {
  return unwrapOne(p);
}

function mapOrderRow(order: OrderEmbedRow) {
  const rawItems = order.order_items ?? [];
  const items = rawItems.map((oi) => {
    const p = unwrapProduct(oi.products);
    return {
      id: oi.id,
      quantity: oi.quantity,
      unit_price: oi.unit_price ?? undefined,
      total_price: oi.total_price ?? undefined,
      product_id: oi.product_id ?? '',
      product_name: p?.name ?? oi.product_name ?? 'Produit supprimé',
      product_image: p?.main_image ?? oi.product_image ?? null,
      sku: p?.sku ?? undefined,
    };
  });

  const itemCount = items.length;

  const dp = unwrapOne(order.driver_profile);
  const driverName =
    (order.driver_name && String(order.driver_name).trim()) ||
    (dp ? `${dp.first_name ?? ''} ${dp.last_name ?? ''}`.trim() : '') ||
    null;
  const specialPayload = parseSpecialPayload(order.notes || order.metadata);
  const isSpecialMobile = detectSpecialMobile(order, specialPayload);
  const quoteStatus = deriveQuoteStatus(specialPayload);

  return {
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    customer_name: order.customer_name ?? null,
    customer_phone: order.customer_phone ?? null,
    customer_phone_profile: null as string | null,
    total_amount: order.total_amount,
    total_items: itemCount,
    item_count: itemCount,
    items,
    status: order.status,
    notes: order.notes ?? null,
    is_special_mobile: isSpecialMobile,
    special_payload: specialPayload,
    quote_status: quoteStatus,
    driver_id: order.driver_id ?? null,
    driver_name: driverName,
    payment_method: order.payment_method ?? null,
  };
}

/** Liste riche sans embed livreur → profiles (souvent cassé : FK orders.driver_id → auth.users, pas profiles). */
const SELECT_FULL = `
  id,
  order_number,
  created_at,
  updated_at,
  status,
  payment_status,
  payment_method,
  total_amount,
  shipping_address,
  notes,
  metadata,
  driver_id,
  customer_name,
  customer_phone,
  order_items(
    id,
    quantity,
    unit_price,
    total_price,
    product_id,
    product_name,
    product_image,
    products(id, name, main_image, sku)
  )
`;

const SELECT_NO_PRODUCTS = `
  id,
  order_number,
  created_at,
  updated_at,
  status,
  payment_status,
  payment_method,
  total_amount,
  shipping_address,
  notes,
  metadata,
  driver_id,
  customer_name,
  customer_phone,
  order_items(
    id,
    quantity,
    unit_price,
    total_price,
    product_id,
    product_name,
    product_image
  )
`;

const SELECT_MIN_SAFE = `
  id,
  order_number,
  created_at,
  updated_at,
  status,
  payment_status,
  payment_method,
  total_amount,
  shipping_address,
  notes,
  metadata,
  driver_id,
  customer_name,
  customer_phone
`;

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
      .select('id, delivery_lat, delivery_lng, created_at, updated_at, status, order_number')
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

  const logOrdersStep = (step: string, err: { message?: string; code?: string } | null) => {
    // #region agent log
    fetch('http://127.0.0.1:7316/ingest/cbc4d87d-0063-4626-a2b8-cd3c21b6e6d2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '789a98' },
      body: JSON.stringify({
        sessionId: '789a98',
        location: 'api/orders/route.ts:GET',
        message: `orders select step: ${step}`,
        data: {
          hypothesisId: 'H2',
          step,
          supabaseMessage: String(err?.message ?? '').slice(0, 500),
          supabaseCode: String(err?.code ?? ''),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  };

  let res = await runSelect(SELECT_FULL, true);
  if (res.error) {
    logOrdersStep('after_SELECT_FULL_meta_true', res.error);
    const msg = String(res.error.message || '');
    if (msg.includes('metadata') || msg.includes('column orders.metadata')) {
      res = await runSelect(SELECT_FULL, false);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_FULL_retry', res.error);
    const msg = String(res.error.message || '');
    if (
      msg.includes('products') ||
      msg.includes('relationship') ||
      msg.includes('order_items') ||
      msg.includes('product_name') ||
      msg.includes('Could not find')
    ) {
      res = await runSelect(SELECT_NO_PRODUCTS, true);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_FULL_embed_items', res.error);
    const msg = String(res.error.message || '');
    if (
      msg.includes('products') ||
      msg.includes('relationship') ||
      msg.includes('order_items') ||
      msg.includes('product_name')
    ) {
      res = await runSelect(SELECT_NO_PRODUCTS, true);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_NO_PRODUCTS_post_full', res.error);
    const msg = String(res.error.message || '');
    if (msg.includes('metadata') || msg.includes('column orders.metadata')) {
      res = await runSelect(SELECT_NO_PRODUCTS, false);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_NO_PRODUCTS_meta_chain', res.error);
    const msg = String(res.error.message || '');
    if (msg.includes('metadata') || msg.includes('column orders.metadata')) {
      res = await runSelect(SELECT_NO_PRODUCTS, false);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_NO_PRODUCTS_retry', res.error);
    const msg = String(res.error.message || '');
    if (
      msg.includes('products') ||
      msg.includes('relationship') ||
      msg.includes('order_items') ||
      msg.includes('product_name')
    ) {
      res = await runSelect(SELECT_NO_PRODUCTS, true);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_NO_PRODUCTS_meta_true', res.error);
    const msg = String(res.error.message || '');
    if (msg.includes('metadata') || msg.includes('column orders.metadata')) {
      res = await runSelect(SELECT_NO_PRODUCTS, false);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_NO_PRODUCTS_retry', res.error);
    const msg = String(res.error.message || '');
    if (msg.includes('metadata') || msg.includes('column orders.metadata does not exist')) {
      res = await runSelect(SELECT_MIN_SAFE, true);
    }
  }
  if (res.error) {
    logOrdersStep('after_SELECT_MIN_SAFE_meta_true', res.error);
    const msg = String(res.error.message || '');
    if (msg.includes('metadata') || msg.includes('column orders.metadata')) {
      res = await runSelect(SELECT_MIN_SAFE, false);
    }
  }

  if (res.error) {
    console.error('[/api/orders] Supabase error:', JSON.stringify(res.error));
    // #region agent log
    fetch('http://127.0.0.1:7316/ingest/cbc4d87d-0063-4626-a2b8-cd3c21b6e6d2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '789a98' },
      body: JSON.stringify({
        sessionId: '789a98',
        location: 'api/orders/route.ts:GET',
        message: 'orders list final error after fallbacks',
        data: {
          hypothesisId: 'H2-H3',
          kind: filterParams.kind ?? 'all',
          hasSearch: Boolean(filterParams.search?.trim()),
          supabaseMessage: String(res.error?.message ?? ''),
          supabaseCode: String((res.error as { code?: string })?.code ?? ''),
          hint: String((res.error as { hint?: string })?.hint ?? ''),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const rows = (res.data ?? []) as unknown as OrderEmbedRow[];
  let mapped: ReturnType<typeof mapOrderRow>[];
  try {
    mapped = rows.map(mapOrderRow);
  } catch (mapErr) {
    const m = mapErr instanceof Error ? mapErr.message : String(mapErr);
    console.error('[/api/orders] mapOrderRow:', m);
    // #region agent log
    fetch('http://127.0.0.1:7316/ingest/cbc4d87d-0063-4626-a2b8-cd3c21b6e6d2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '789a98' },
      body: JSON.stringify({
        sessionId: '789a98',
        location: 'api/orders/route.ts:GET:map',
        message: 'mapOrderRow threw',
        data: { hypothesisId: 'H4', errMsg: m.slice(0, 400), rowCount: rows.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: 'Erreur lors du formatage des commandes' }, { status: 500 });
  }

  return NextResponse.json({
    data: mapped,
    count: res.count ?? mapped.length,
    page,
    pageSize,
  });
}
