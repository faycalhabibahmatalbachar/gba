import { supabase } from '@/lib/supabase/client';

export type DriverLocation = {
  id?: string;
  driver_id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  captured_at: string;
};

export type ActiveDelivery = {
  id: string;
  order_id: string;
  order_number?: string | null;
  status: string;
  driver_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_avatar?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_lat?: number | null;
  shipping_lng?: number | null;
  estimated_delivery_at?: string | null;
  delivered_at?: string | null;
  proof_of_delivery_url?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at?: string | null;
  // joined driver location
  driver_location?: DriverLocation | null;
};

export type StatusHistory = {
  id: string;
  delivery_id?: string | null;
  order_id?: string | null;
  status: string;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
};

export async function fetchActiveDeliveries(): Promise<ActiveDelivery[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      id, order_id, status, driver_id, estimated_delivery_at, delivered_at,
      proof_of_delivery_url, admin_note, created_at, updated_at,
      orders:order_id(
        order_number, shipping_address, shipping_city,
        profiles:user_id(first_name, last_name, phone, email)
      ),
      drivers:driver_id(first_name, last_name, phone, avatar_url)
    `)
    .in('status', ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'shipped'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return ((data || []) as any[]).map((d) => {
    const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
    const driver = Array.isArray(d.drivers) ? d.drivers[0] : d.drivers;
    const client = order ? (Array.isArray(order.profiles) ? order.profiles[0] : order.profiles) : null;
    return {
      id: d.id,
      order_id: d.order_id,
      order_number: order?.order_number || null,
      status: d.status,
      driver_id: d.driver_id || null,
      driver_name: driver ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || null : null,
      driver_phone: driver?.phone || null,
      driver_avatar: driver?.avatar_url || null,
      client_name: client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() || null : null,
      client_phone: client?.phone || null,
      client_email: client?.email || null,
      shipping_address: order?.shipping_address || null,
      shipping_city: order?.shipping_city || null,
      shipping_lat: null,
      shipping_lng: null,
      estimated_delivery_at: d.estimated_delivery_at || null,
      delivered_at: d.delivered_at || null,
      proof_of_delivery_url: d.proof_of_delivery_url || null,
      admin_note: d.admin_note || null,
      created_at: d.created_at,
      updated_at: d.updated_at || null,
      driver_location: null,
    } as ActiveDelivery;
  });
}

export async function fetchDriverLocations(driverIds: string[]): Promise<Record<string, DriverLocation>> {
  if (!driverIds.length) return {};
  const { data, error } = await supabase
    .from('driver_locations')
    .select('driver_id, lat, lng, accuracy, speed, heading, captured_at')
    .in('driver_id', driverIds)
    .order('captured_at', { ascending: false });

  if (error) throw error;

  const map: Record<string, DriverLocation> = {};
  for (const row of (data || []) as DriverLocation[]) {
    if (!map[row.driver_id]) map[row.driver_id] = row;
  }
  return map;
}

export async function fetchDriverLocationHistory(driverId: string, limit = 50): Promise<DriverLocation[]> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('driver_id, lat, lng, accuracy, speed, heading, captured_at')
    .eq('driver_id', driverId)
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as DriverLocation[];
}

export async function fetchDeliveryStatusHistory(deliveryId: string): Promise<StatusHistory[]> {
  const { data, error } = await supabase
    .from('delivery_status_history')
    .select('id, delivery_id, status, note, created_by, created_at')
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []) as StatusHistory[];
}

export async function forceDeliveryStatus(deliveryId: string, status: string, note?: string) {
  const { error } = await supabase
    .from('deliveries')
    .update({ status, admin_note: note || null, updated_at: new Date().toISOString() })
    .eq('id', deliveryId);
  if (error) throw error;
}

export async function reassignDelivery(deliveryId: string, newDriverId: string) {
  const { error } = await supabase
    .from('deliveries')
    .update({ driver_id: newDriverId, updated_at: new Date().toISOString() })
    .eq('id', deliveryId);
  if (error) throw error;
}

export type TrackingKpis = {
  activeDrivers: number;
  inTransit: number;
  delayed: number;
  deliveredToday: number;
};

export type DriverRow = { id: string; first_name?: string | null; last_name?: string | null; phone?: string | null; is_available?: boolean | null };

export async function fetchAvailableDrivers(): Promise<DriverRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone, is_available')
    .eq('role', 'driver')
    .order('first_name', { ascending: true });
  if (error) throw error;
  return (data || []) as DriverRow[];
}

export async function fetchTrackingKpis(): Promise<TrackingKpis> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const [activeDriversRes, inTransitRes, deliveredTodayRes] = await Promise.all([
    supabase.from('driver_locations').select('driver_id', { count: 'exact', head: true }).gte('captured_at', tenMinAgo),
    supabase.from('deliveries').select('id', { count: 'exact', head: true }).in('status', ['in_transit', 'out_for_delivery', 'shipped', 'picked_up']),
    supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('status', 'delivered').gte('delivered_at', todayStart.toISOString()),
  ]);

  return {
    activeDrivers: activeDriversRes.count ?? 0,
    inTransit: inTransitRes.count ?? 0,
    delayed: 0,
    deliveredToday: deliveredTodayRes.count ?? 0,
  };
}
