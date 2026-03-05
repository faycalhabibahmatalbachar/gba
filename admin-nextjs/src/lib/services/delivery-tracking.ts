import { supabase } from '@/lib/supabase/client';

export type DriverProfile = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type DriverLocation = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  captured_at?: string | null;
};

export type ActiveOrder = {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  user_id?: string | null;
  status?: string | null;
  created_at: string;
  displayName: string;
  displayNum: string;
};

export type DriverWithState = {
  driver: DriverProfile;
  location: DriverLocation | null;
  orders: ActiveOrder[];
  lastSeenMinutes: number | null;
  isOnline: boolean;
  isOverloaded: boolean;
  isStale: boolean;
  delayedOrdersCount: number;
};

const STALE_MINUTES = 10;
const OVERLOAD_THRESHOLD = 5;
const SLA_HOURS = 2;

export async function fetchAllDriversWithState(): Promise<DriverWithState[]> {
  const { data: drivers, error: driversErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone')
    .eq('role', 'driver')
    .order('created_at', { ascending: false });
  if (driversErr) throw driversErr;
  const driverList = (drivers || []) as DriverProfile[];

  const { data: locs } = await supabase
    .from('driver_locations')
    .select('driver_id, lat, lng, accuracy, captured_at')
    .order('captured_at', { ascending: false })
    .limit(500);
  const locRows = (locs || []) as any[];
  const latestByDriver: Record<string, DriverLocation> = {};
  for (const r of locRows) {
    if (!r.driver_id || latestByDriver[r.driver_id]) continue;
    latestByDriver[r.driver_id] = {
      lat: r.lat,
      lng: r.lng,
      accuracy: r.accuracy,
      captured_at: r.captured_at,
    };
  }

  const { data: ordersRaw } = await supabase
    .from('orders')
    .select('id, user_id, status, order_number, customer_name, created_at, driver_id')
    .in('status', ['confirmed', 'shipped', 'processing'])
    .not('driver_id', 'is', null);
  const ordersAll = (ordersRaw || []) as any[];
  const ordersByDriver: Record<string, any[]> = {};
  for (const o of ordersAll) {
    const did = o.driver_id;
    if (!did) continue;
    ordersByDriver[did] = ordersByDriver[did] || [];
    ordersByDriver[did].push(o);
  }

  const userIds = [...new Set(ordersAll.filter((o) => o.user_id && !o.customer_name).map((o) => o.user_id))];
  const profileMap: Record<string, string> = {};
  if (userIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, email').in('id', userIds);
    (profs || []).forEach((p: any) => {
      profileMap[p.id] = `${[p.first_name, p.last_name].filter(Boolean).join(' ')}`.trim() || p.email || p.id?.slice(0, 8) || '?';
    });
  }

  const mapName = (d: DriverProfile) =>
    `${[d.first_name, d.last_name].filter(Boolean).join(' ')}`.trim() || d.email || d.phone || `Livreur ${d.id.slice(0, 8)}`;

  const now = Date.now();
  const slaMs = SLA_HOURS * 60 * 60 * 1000;

  return driverList.map((driver) => {
    const ordersRaw = ordersByDriver[driver.id] || [];
    const orders = ordersRaw.map((o) => ({
      ...o,
      displayName: o.customer_name || (o.user_id ? profileMap[o.user_id] : undefined) || `Client ${(o.user_id || '').slice(0, 8) || '?'}`,
      displayNum: o.order_number || `#${o.id.slice(0, 8)}`,
    }));
    const delayedOrdersCount = orders.filter((o) => now - new Date(o.created_at).getTime() > slaMs).length;
    const loc = latestByDriver[driver.id] || null;
    const lastSeenMinutes = loc?.captured_at
      ? Math.max(0, Math.round((now - new Date(loc.captured_at).getTime()) / 60000))
      : null;
    const isOnline = lastSeenMinutes != null && lastSeenMinutes < STALE_MINUTES;
    const isOverloaded = orders.length >= OVERLOAD_THRESHOLD;
    const isStale = lastSeenMinutes != null && lastSeenMinutes >= STALE_MINUTES;

    return {
      driver,
      location: loc,
      orders,
      lastSeenMinutes,
      isOnline,
      isOverloaded,
      isStale,
      delayedOrdersCount,
    };
  });
}

export async function fetchDriverLocation(driverId: string): Promise<DriverLocation | null> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('lat, lng, accuracy, captured_at')
    .eq('driver_id', driverId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DriverLocation | null;
}

export async function fetchDriverTrail(driverId: string, limit = 10): Promise<[number, number][]> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('lat, lng')
    .eq('driver_id', driverId)
    .order('captured_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as any[]).map((r) => [r.lat, r.lng] as [number, number]);
}

export async function fetchClientLocation(userId: string): Promise<DriverLocation | null> {
  const { data, error } = await supabase.from('user_locations').select('lat, lng, accuracy, captured_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as DriverLocation | null;
}
