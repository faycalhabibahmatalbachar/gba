import type { SupabaseClient } from '@supabase/supabase-js';

export type LiveMarker = {
  driver_id: string;
  lat: number;
  lng: number;
  order_id: string | null;
  at: string;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  status: 'online' | 'busy' | 'inactive' | 'offline' | 'delivering' | 'idle';
  inactive_minutes: number;
  speed_kmh: number | null;
  heading: number | null;
  battery_level: number | null;
  driver_row_id: string | null;
  delivery_address: string | null;
  stale_position: boolean;
  source?: 'live' | 'db_fallback';
  marker_kind?: 'driver' | 'client';
  companion?: {
    lat: number;
    lng: number;
    label: string;
    source: 'order_delivery' | 'user_current_location';
  } | null;
};

export type LiveStats = {
  online: number;
  delivering: number;
  idle: number;
  offline: number;
  orders_active: number;
  drivers_on_map: number;
  active_deliveries: number;
  updated_at: string;
};

/** Positions considérées « live » : fenêtre glissante 15 minutes (spec ops). */
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * driver_locations.driver_id = auth.users.id (mobile upsert).
 * Jointure drivers sur user_id.
 */
export async function buildLiveMarkers(sb: SupabaseClient): Promise<{ markers: LiveMarker[]; stats: LiveStats }> {
  const since = new Date(Date.now() - FIFTEEN_MIN_MS).toISOString();

  const { data: locs, error } = await sb
    .from('driver_locations')
    .select(
      'id, driver_id, lat, lng, order_id, created_at, captured_at, recorded_at, speed_mps, heading, battery_level, is_moving',
    )
    .gte('captured_at', since)
    .order('captured_at', { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);

  const byUser = new Map<
    string,
    {
      id: string;
      driver_id: string;
      lat: number;
      lng: number;
      order_id: string | null;
      at: string;
      speed_mps: number | null;
      heading: number | null;
      battery_level: number | null;
      is_moving: boolean | null;
    }
  >();

  for (const row of locs || []) {
    const r = row as Record<string, unknown>;
    const uid = String(r.driver_id);
    if (byUser.has(uid)) continue;
    const atRaw = (r.recorded_at || r.captured_at || r.created_at) as string;

    byUser.set(uid, {
      id: String(r.id),
      driver_id: uid,
      lat: Number(r.lat),
      lng: Number(r.lng),
      order_id: (r.order_id as string | null) ?? null,
      at: atRaw,
      speed_mps: r.speed_mps != null ? Number(r.speed_mps) : null,
      heading: r.heading != null ? Number(r.heading) : null,
      battery_level: r.battery_level != null ? Number(r.battery_level) : null,
      is_moving: r.is_moving === true ? true : r.is_moving === false ? false : null,
    });
  }

  const { count: activeDrivers } = await sb
    .from('drivers')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const userIds = [...byUser.keys()];
  if (userIds.length === 0) {
    const { count: oa } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'processing', 'shipped']);

    const markers: LiveMarker[] = [];
    const { data: rosterOnly } = await sb
      .from('drivers')
      .select(
        'id, user_id, name, phone, is_active, current_lat, current_lng, last_location_at, vehicle_plate',
      )
      .eq('is_active', true)
      .not('user_id', 'is', null)
      .limit(500);

    for (const d of rosterOnly || []) {
      const row = d as Record<string, unknown>;
      const uid = String(row.user_id || '');
      const lat = Number(row.current_lat);
      const lng = Number(row.current_lng);
      if (!uid || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const atRaw = (row.last_location_at as string) || new Date(0).toISOString();
      const inactiveMinutes = Math.max(0, Math.round((Date.now() - new Date(atRaw).getTime()) / 60000));
      markers.push({
        driver_id: uid,
        lat,
        lng,
        order_id: null,
        at: atRaw,
        display_name: String(row.name || 'Livreur'),
        avatar_url: null,
        phone: (row.phone as string | null) ?? null,
        status: 'inactive',
        inactive_minutes: inactiveMinutes,
        speed_kmh: null,
        heading: null,
        battery_level: null,
        driver_row_id: String(row.id),
        delivery_address: null,
        stale_position: true,
        source: 'db_fallback',
      });
    }

    const activeDeliveries = markers.filter((m) => m.order_id).length;
    return {
      markers,
      stats: {
        online: 0,
        delivering: 0,
        idle: markers.length,
        offline: Math.max(0, (activeDrivers ?? 0) - markers.length),
        orders_active: oa ?? 0,
        drivers_on_map: markers.length,
        active_deliveries: activeDeliveries,
        updated_at: new Date().toISOString(),
      },
    };
  }

  const { data: drivers } = await sb
    .from('drivers')
    .select('id, user_id, is_online, is_available, is_active, vehicle_plate, name')
    .in('user_id', userIds);

  const dmap = new Map<string, Record<string, unknown>>();
  const idByUser = new Map<string, string>();
  for (const d of drivers || []) {
    const row = d as Record<string, unknown>;
    const u = row.user_id as string | undefined;
    if (u) {
      dmap.set(u, row);
      idByUser.set(u, String(row.id));
    }
  }

  const { data: profs } = await sb
    .from('profiles')
    .select('id, first_name, last_name, full_name, avatar_url, phone')
    .in('id', userIds);

  const pmap = new Map<string, Record<string, unknown>>();
  for (const p of profs || []) {
    pmap.set(String((p as { id: string }).id), p as Record<string, unknown>);
  }

  const orderIds = [...new Set([...byUser.values()].map((l) => l.order_id).filter(Boolean))] as string[];
  const orderAddr = new Map<string, string | null>();
  const orderClient = new Map<string, { user_id: string | null; delivery_lat: number | null; delivery_lng: number | null }>();
  const clientCurrent = new Map<string, { latitude: number; longitude: number }>();
  if (orderIds.length) {
    const { data: ords } = await sb
      .from('orders')
      .select('id, user_id, delivery_address, delivery_lat, delivery_lng')
      .in('id', orderIds);
    for (const o of ords || []) {
      const row = o as {
        id: string;
        user_id: string | null;
        delivery_address: string | null;
        delivery_lat: number | null;
        delivery_lng: number | null;
      };
      orderAddr.set(row.id, row.delivery_address ?? null);
      orderClient.set(row.id, {
        user_id: row.user_id ?? null,
        delivery_lat: row.delivery_lat != null ? Number(row.delivery_lat) : null,
        delivery_lng: row.delivery_lng != null ? Number(row.delivery_lng) : null,
      });
    }

    const userIds = [...new Set((ords || []).map((o) => (o as { user_id?: string | null }).user_id).filter(Boolean))] as string[];
    if (userIds.length) {
      const { data: uclRows } = await sb
        .from('user_current_location')
        .select('user_id, latitude, longitude, updated_at')
        .in('user_id', userIds);

      for (const ucl of uclRows || []) {
        const row = ucl as { user_id: string; latitude: number; longitude: number };
        if (!Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) continue;
        clientCurrent.set(row.user_id, { latitude: Number(row.latitude), longitude: Number(row.longitude) });
      }
    }
  }

  const markers: LiveMarker[] = [...byUser.values()].map((loc) => {
    const dr = dmap.get(loc.driver_id);
    const pr = pmap.get(loc.driver_id);
    const display = String(
      pr?.full_name ||
        [pr?.first_name, pr?.last_name].filter(Boolean).join(' ') ||
        dr?.name ||
        'Livreur',
    );

    const inactiveMinutes = Math.max(0, Math.round((Date.now() - new Date(loc.at).getTime()) / 60000));
    let status: LiveMarker['status'] = 'offline';
    if (dr?.is_active === false) status = 'offline';
    else if (inactiveMinutes > 20) status = 'inactive';
    else if (loc.order_id) status = 'delivering';
    else if (loc.is_moving === true) status = 'delivering';
    else if (dr?.is_online === true || dr?.is_available === true) status = 'online';
    else status = 'idle';

    const speed_kmh =
      loc.speed_mps != null && Number.isFinite(loc.speed_mps) ? Math.round(loc.speed_mps * 3.6 * 10) / 10 : null;

    const stale_position = inactiveMinutes > 10;

    return {
      driver_id: loc.driver_id,
      lat: loc.lat,
      lng: loc.lng,
      order_id: loc.order_id,
      at: loc.at,
      display_name: display,
      avatar_url: (pr?.avatar_url as string | null) ?? null,
      phone: (pr?.phone as string | null) ?? null,
      status,
      inactive_minutes: inactiveMinutes,
      speed_kmh,
      heading: loc.heading,
      battery_level: loc.battery_level,
      driver_row_id: idByUser.get(loc.driver_id) ?? null,
      delivery_address: loc.order_id ? orderAddr.get(loc.order_id) ?? null : null,
      stale_position,
      source: 'live',
      marker_kind: 'driver',
      companion: (() => {
        if (!loc.order_id) return null;
        const oc = orderClient.get(loc.order_id);
        if (!oc) return null;
        const live = oc.user_id ? clientCurrent.get(oc.user_id) : null;
        if (live && Number.isFinite(live.latitude) && Number.isFinite(live.longitude)) {
          return {
            lat: live.latitude,
            lng: live.longitude,
            label: 'Client (temps réel)',
            source: 'user_current_location' as const,
          };
        }
        if (oc.delivery_lat != null && oc.delivery_lng != null) {
          return {
            lat: oc.delivery_lat,
            lng: oc.delivery_lng,
            label: 'Client (adresse livraison)',
            source: 'order_delivery' as const,
          };
        }
        return null;
      })(),
    };
  });

  const coveredAuthIds = new Set(markers.map((m) => m.driver_id));
  const { data: rosterDrivers } = await sb
    .from('drivers')
    .select(
      'id, user_id, name, phone, is_active, is_online, is_available, current_lat, current_lng, last_location_at, vehicle_plate',
    )
    .eq('is_active', true)
    .not('user_id', 'is', null)
    .limit(500);

  for (const d of rosterDrivers || []) {
    const row = d as Record<string, unknown>;
    const uid = String(row.user_id || '');
    if (!uid || coveredAuthIds.has(uid)) continue;
    const lat = Number(row.current_lat);
    const lng = Number(row.current_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    coveredAuthIds.add(uid);
    const atRaw = (row.last_location_at as string) || new Date(0).toISOString();
    const inactiveMinutes = Math.max(0, Math.round((Date.now() - new Date(atRaw).getTime()) / 60000));
    markers.push({
      driver_id: uid,
      lat,
      lng,
      order_id: null,
      at: atRaw,
      display_name: String(row.name || 'Livreur'),
      avatar_url: null,
      phone: (row.phone as string | null) ?? null,
      status: 'inactive',
      inactive_minutes: inactiveMinutes,
      speed_kmh: null,
      heading: null,
      battery_level: null,
      driver_row_id: String(row.id),
      delivery_address: null,
      stale_position: true,
      source: 'db_fallback',
      marker_kind: 'driver',
      companion: null,
    });
  }

  const activeDeliveries = markers.filter((m) => m.order_id).length;
  const online = markers.filter((m) => m.status === 'online').length;
  const delivering = markers.filter((m) => m.status === 'delivering' || m.order_id).length;
  const idle = markers.filter((m) => m.status === 'idle' || m.status === 'inactive').length;
  const offline = Math.max(0, (activeDrivers ?? 0) - markers.length);

  const { count: ordersActive } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['confirmed', 'processing', 'shipped']);

  return {
    markers,
    stats: {
      online,
      delivering,
      idle,
      offline,
      orders_active: ordersActive ?? 0,
      drivers_on_map: markers.length,
      active_deliveries: activeDeliveries,
      updated_at: new Date().toISOString(),
    },
  };
}
