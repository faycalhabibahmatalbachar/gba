import { supabase } from '@/lib/supabase/client';

export type DeliveryOrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  updated_at?: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_phone_profile?: string | null;
  status: string | null;
  total_amount: number | null;
  driver_id: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  payment_provider?: string | null;
  paid_at?: string | null;
  items?: any;
  total_items?: number | null;
  shipping_address?: any;
  shipping_city?: string | null;
  shipping_district?: string | null;
  shipping_country?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
};

export type FetchDeliveriesParams = {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function fetchDeliveries(params: FetchDeliveriesParams) {
  const { page, pageSize, status, search, driverId, dateFrom, dateTo } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('order_details_view')
    .select(
      'id, order_number, created_at, updated_at, customer_name, customer_phone, customer_phone_profile, status, total_amount, driver_id, driver_name, driver_phone, payment_provider, paid_at, items, total_items, shipping_address, shipping_city, shipping_district, shipping_country, delivered_at, cancelled_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status && status !== 'all') q = q.eq('status', status);
  if (driverId) q = q.eq('driver_id', driverId);
  if (dateFrom) q = q.gte('created_at', dateFrom);
  if (dateTo) q = q.lte('created_at', dateTo);
  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`);
  }

  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data || []) as DeliveryOrderRow[], count: count || 0 };
}

export async function fetchDeliveryKpis(params?: { dateFrom?: string; dateTo?: string; lateHours?: number }) {
  const lateHours = params?.lateHours ?? 6;
  const now = Date.now();
  const lateCutoffIso = new Date(now - lateHours * 60 * 60 * 1000).toISOString();

  let base = supabase.from('orders').select('id, status, created_at', { count: 'exact', head: false });
  if (params?.dateFrom) base = base.gte('created_at', params.dateFrom);
  if (params?.dateTo) base = base.lte('created_at', params.dateTo);

  const { data, error } = await base;
  if (error) throw error;
  const rows = (data || []) as any[];

  const todayFrom = new Date();
  todayFrom.setHours(0, 0, 0, 0);
  const todayIso = todayFrom.toISOString();

  const today = rows.filter((r) => r.created_at >= todayIso).length;
  const inProgress = rows.filter((r) => ['confirmed', 'processing', 'shipped'].includes(String(r.status || '').toLowerCase())).length;
  const delivered = rows.filter((r) => String(r.status || '').toLowerCase() === 'delivered').length;
  const cancelled = rows.filter((r) => String(r.status || '').toLowerCase() === 'cancelled').length;
  const late = rows.filter((r) => String(r.status || '').toLowerCase() === 'shipped' && r.created_at < lateCutoffIso).length;

  return { today, inProgress, late, delivered, cancelled };
}

export async function updateDeliveryStatus(orderId: string, status: string) {
  const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
  if (error) throw error;
}

export async function assignDriver(orderId: string, driverId: string | null) {
  const { error } = await supabase.from('orders').update({ driver_id: driverId, updated_at: new Date().toISOString() }).eq('id', orderId);
  if (error) throw error;
}

export async function bulkAssignDriver(orderIds: string[], driverId: string | null) {
  if (!orderIds.length) return;
  const { error } = await supabase
    .from('orders')
    .update({ driver_id: driverId, updated_at: new Date().toISOString() })
    .in('id', orderIds);
  if (error) throw error;
}

export async function bulkUpdateDeliveryStatus(orderIds: string[], status: string) {
  if (!orderIds.length) return;
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', orderIds);
  if (error) throw error;
}

export function buildDestinationAddress(o: DeliveryOrderRow) {
  const a: any = o.shipping_address;

  if (typeof a === 'string') {
    const parts = [a, o.shipping_district, o.shipping_city, o.shipping_country].filter(Boolean);
    return parts.join(', ');
  }

  const obj: any = a || {};
  const street = obj.street ?? obj.address ?? obj.line1 ?? obj.address1 ?? obj.street_address ?? obj.address_line_1;
  const district = obj.district ?? obj.neighborhood ?? obj.quarter ?? obj.area ?? o.shipping_district;
  const city = obj.city ?? obj.town ?? obj.locality ?? o.shipping_city;
  const state = obj.wilaya ?? obj.state ?? obj.region ?? obj.province;
  const country = obj.country ?? o.shipping_country;
  const parts = [street, district, city, state, country].filter(Boolean);
  return parts.join(', ');
}

export function buildGoogleMapsDirectionsUrl(o: DeliveryOrderRow) {
  const a: any = o.shipping_address || {};
  const lat = a.lat ?? a.latitude;
  const lng = a.lng ?? a.longitude;
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function buildOsmUrl(o: DeliveryOrderRow) {
  const a: any = o.shipping_address || {};
  const lat = a.lat ?? a.latitude;
  const lng = a.lng ?? a.longitude;
  if (lat == null || lng == null) return null;
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=18/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`;
}
