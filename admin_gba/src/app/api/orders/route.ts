import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
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
  driver_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  order_items?: OrderItemEmbed[] | null;
  driver_profile?: DriverEmbed | DriverEmbed[];
};

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
    driver_id: order.driver_id ?? null,
    driver_name: driverName,
    payment_method: order.payment_method ?? null,
  };
}

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

const SORT_WHITELIST = new Set(['created_at', 'total_amount', 'status', 'order_number']);

type ListFilterParams = {
  status?: string;
  driverId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  search?: string;
};

function applyListFilters<
  Q extends {
    eq: (c: string, v: string) => Q;
    gte: (c: string, v: string | number) => Q;
    lte: (c: string, v: string | number) => Q;
    or: (f: string) => Q;
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
  return qq;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const url = new URL(req.url);
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
