import { supabase } from '@/lib/supabase/client';
import { parseApiJson } from '@/lib/fetch-api-json';

export type OrderItem = {
  id: string;
  product_id: string;
  product_name?: string;
  product_image?: string | null;
  sku?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
};

export type OrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone_profile?: string | null;
  customer_phone?: string | null;
  total_amount: number | null;
  total_items?: number | null;
  item_count?: number;
  items?: OrderItem[];
  status: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  payment_method?: string | null;
};

export type FetchOrdersParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  driverId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type OrdersKpis = {
  totalOrders: number;
  revenue: number;
  avgBasket: number;
  pendingCount: number;
  deliveredCount: number;
  deliveryRate: number;
};

function applyFilters(q: any, params: FetchOrdersParams) {
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

export async function fetchOrders(params: FetchOrdersParams = {}) {
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));
  qs.set('sortBy', sortBy);
  qs.set('sortOrder', sortOrder);
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.driverId) qs.set('driverId', params.driverId);
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo) qs.set('dateTo', params.dateTo);
  if (params.amountMin != null) qs.set('amountMin', String(params.amountMin));
  if (params.amountMax != null) qs.set('amountMax', String(params.amountMax));

  const r = await fetch(`/api/orders?${qs.toString()}`, { credentials: 'include' });
  const j = await parseApiJson<{ data: OrderRow[]; count: number }>(r);
  if (!r.ok) {
    const err = j as { error?: string };
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  return { data: j.data ?? [], count: j.count ?? 0 };
}

/** KPIs for current filters. Revenue/avg are computed from up to 5000 rows for performance. */
export async function fetchOrdersKpis(params: Omit<FetchOrdersParams, 'page' | 'pageSize'> = {}): Promise<OrdersKpis> {
  const baseQ = supabase
    .from('orders')
    .select('id, total_amount, status', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 4999);

  const q = applyFilters(baseQ, { ...params, page: 1, pageSize: 5000 });
  const res = await q;

  if (res.error) {
    const fallback = applyFilters(
      supabase.from('orders').select('id, total_amount, status', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 4999),
      { ...params, page: 1, pageSize: 5000 },
    );
    const r = await fallback;
    if (r.error) return { totalOrders: 0, revenue: 0, avgBasket: 0, pendingCount: 0, deliveredCount: 0, deliveryRate: 0 };
    return computeKpis(r.data || [], r.count || 0);
  }

  return computeKpis((res.data || []) as { total_amount: number | null; status: string | null }[], res.count || 0);
}

function computeKpis(
  rows: { total_amount: number | null; status: string | null }[],
  totalCount: number,
): OrdersKpis {
  const revenue = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const pendingCount = rows.filter((r) => String(r.status || '').toLowerCase() === 'pending').length;
  const deliveredCount = rows.filter((r) => String(r.status || '').toLowerCase() === 'delivered').length;
  const n = rows.length;
  return {
    totalOrders: totalCount,
    revenue,
    avgBasket: n ? revenue / n : 0,
    pendingCount,
    deliveredCount,
    deliveryRate: totalCount ? (deliveredCount / totalCount) * 100 : 0,
  };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'delivered') {
    patch.delivered_at = new Date().toISOString();
    patch.cancelled_at = null;
  } else if (status === 'cancelled') {
    patch.cancelled_at = new Date().toISOString();
    patch.delivered_at = null;
  }
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) throw error;
}

export async function bulkUpdateOrderStatus(orderIds: string[], status: string) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'delivered') {
    patch.delivered_at = new Date().toISOString();
    patch.cancelled_at = null;
  } else if (status === 'cancelled') {
    patch.cancelled_at = new Date().toISOString();
    patch.delivered_at = null;
  }
  const { error } = await supabase.from('orders').update(patch).in('id', orderIds);
  if (error) throw error;
}

export async function bulkAssignDriver(orderIds: string[], driverId: string | null) {
  const { error } = await supabase
    .from('orders')
    .update({ driver_id: driverId, updated_at: new Date().toISOString() })
    .in('id', orderIds);
  if (error) throw error;
}

export type OrderDetailsRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  updated_at?: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_phone_profile?: string | null;
  status: string | null;
  total_amount: number | null;
  driver_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  payment_provider?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  paid_at?: string | null;
  total_items?: number | null;
  items?: any;
  shipping_address?: any;
  shipping_city?: string | null;
  shipping_district?: string | null;
  shipping_country?: string | null;
  shipping_fee?: number | null;
  shipping_cost?: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  currency?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_accuracy?: number | null;
  delivery_captured_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  notes?: string | null;
  order_items?: OrderItem[];
};

export async function fetchOrderDetails(orderId: string) {
  const { data: orderData, error: orderError } = await supabase
    .from('order_details_view')
    .select(
      'id, order_number, created_at, updated_at, customer_name, customer_phone, customer_phone_profile, status, total_amount, driver_id, driver_name, driver_phone, payment_provider, payment_method, payment_status, paid_at, total_items, items, shipping_address, shipping_city, shipping_district, shipping_country, shipping_fee, shipping_cost, tax_amount, discount_amount, currency, delivery_lat, delivery_lng, delivery_accuracy, delivery_captured_at, delivered_at, cancelled_at, notes',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!orderData) return null;

  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('id, product_id, product_name, product_image, quantity, unit_price, total_price')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) console.error('Error fetching order items:', itemsError);

  return { ...orderData, order_items: itemsData || [] } as OrderDetailsRow;
}

export async function assignOrderDriver(orderId: string, driverId: string | null) {
  const { error } = await supabase
    .from('orders')
    .update({ driver_id: driverId, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}
