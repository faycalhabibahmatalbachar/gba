export type LiveMapMarker = {
  driver_id: string;
  lat: number;
  lng: number;
  order_id: string | null;
  at: string;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  status: string;
  inactive_minutes: number;
  speed_kmh?: number | null;
  heading?: number | null;
  battery_level?: number | null;
  driver_row_id?: string | null;
  delivery_address?: string | null;
  stale_position?: boolean;
  /** Position issue de drivers.current_lat/lng (pas de point GPS récent) */
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
  orders_without_driver?: number;
};
