import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';

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
  const driverName = dp
    ? `${dp.first_name ?? ''} ${dp.last_name ?? ''}`.trim() || null
    : null;
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

/** PostgREST OR group: matches mobile "special" heuristics (order_number + notes + raw metadata text). */
const SPECIAL_ORDER_OR_FILTERS =
  'order_number.ilike.sp-%,notes.ilike.%special%,notes.ilike.%devis%,notes.ilike.%quote%,notes.ilike.%quotation%,metadata.ilike.%special%,metadata.ilike.%quote%,metadata.ilike.%devis%';

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
  driver_profile:profiles!orders_driver_id_fkey(first_name, last_name),
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

const SELECT_NO_DRIVER = `
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

type ListFilterParams = {
  status?: string;
  driverId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  search?: string;
  kind?: 'all' | 'special_mobile' | 'standard';
};

function applyKindFilter<
  Q extends {
    or: (f: string) => Q;
    not: (column: string, operator: string, value: unknown) => Q;
  },
>(q: Q, kind: ListFilterParams['kind']): Q {
  if (kind === 'special_mobile') {
    return q.or(SPECIAL_ORDER_OR_FILTERS);
  }
  if (kind === 'standard') {
    // NOT (special heuristics), null-safe on notes/metadata (avoids SQL UNKNOWN wiping rows).
    let qq = q.not('order_number', 'ilike', 'sp%');
    qq = qq.or(
      'notes.is.null,and(notes.not.ilike.%special%,notes.not.ilike.%devis%,notes.not.ilike.%quote%,notes.not.ilike.%quotation%)',
    );
    qq = qq.or(
      'metadata.is.null,and(metadata.not.ilike.%special%,metadata.not.ilike.%quote%,metadata.not.ilike.%devis%)',
    );
    return qq;
  }
  return q;
}

function applyListFilters<
  Q extends {
    eq: (c: string, v: string) => Q;
    gte: (c: string, v: string | number) => Q;
    lte: (c: string, v: string | number) => Q;
    or: (f: string) => Q;
    not: (column: string, operator: string, value: unknown) => Q;
  },
>(q: Q, params: ListFilterParams): Q {
  let qq = q;
  if (params.status && params.status !== 'all') qq = qq.eq('status', params.status);
  if (params.driverId) qq = qq.eq('driver_id', params.driverId);
  if (params.dateFrom) qq = qq.gte('created_at', params.dateFrom);
  if (params.dateTo) qq = qq.lte('created_at', params.dateTo);
  if (params.amountMin != null) qq = qq.gte('total_amount', params.amountMin);
  if (params.amountMax != null) qq = qq.lte('total_amount', params.amountMax);
  if (params.search?.trim()) {
    const s = params.search.trim();
    qq = qq.or(`order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`);
  }
  return applyKindFilter(qq, params.kind ?? 'all');
}

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
  const search = url.searchParams.get('search') || url.searchParams.get('q') || '';
  const status = url.searchParams.get('status') || 'all';
  const driverId = url.searchParams.get('driverId');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const amountMinRaw = url.searchParams.get('amountMin');
  const amountMaxRaw = url.searchParams.get('amountMax');
  const amountMin = amountMinRaw != null && amountMinRaw !== '' ? Number(amountMinRaw) : null;
  const amountMax = amountMaxRaw != null && amountMaxRaw !== '' ? Number(amountMaxRaw) : null;
  const sortByRaw = url.searchParams.get('sortBy') || 'created_at';
  const kindRaw = url.searchParams.get('kind') || 'all';
  const kind = kindRaw === 'special_mobile' || kindRaw === 'standard' ? kindRaw : 'all';
  const sortBy = SORT_WHITELIST.has(sortByRaw) ? sortByRaw : 'created_at';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const ascending = sortOrder === 'asc';

  const filterParams: ListFilterParams = {
    status: status === 'all' ? undefined : status,
    driverId: driverId || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    amountMin: Number.isFinite(amountMin as number) ? amountMin : null,
    amountMax: Number.isFinite(amountMax as number) ? amountMax : null,
    search,
    kind,
  };

  const runSelect = async (selectStr: string) => {
    const base = sb.from('orders').select(selectStr, { count: 'exact' });
    const filtered = applyListFilters(base, filterParams);
    return filtered.order(sortBy, { ascending }).range(offset, offset + pageSize - 1);
  };

  let res = await runSelect(SELECT_FULL);
  if (res.error) {
    const msg = String(res.error.message || '');
    if (msg.includes('driver_profile') || msg.includes('orders_driver_id_fkey') || msg.includes('Could not find')) {
      res = await runSelect(SELECT_NO_DRIVER);
    }
  }
  if (res.error) {
    const msg = String(res.error.message || '');
    if (msg.includes('products') || msg.includes('relationship')) {
      res = await runSelect(SELECT_NO_PRODUCTS);
    }
  }
  if (res.error) {
    const msg = String(res.error.message || '');
    if (msg.includes('metadata') || msg.includes('column orders.metadata does not exist')) {
      res = await runSelect(SELECT_MIN_SAFE);
    }
  }

  if (res.error) {
    console.error('[/api/orders] Supabase error:', JSON.stringify(res.error));
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const rows = (res.data ?? []) as unknown as OrderEmbedRow[];
  const mapped = rows.map(mapOrderRow);

  return NextResponse.json({
    data: mapped,
    count: res.count ?? mapped.length,
    page,
    pageSize,
  });
}
