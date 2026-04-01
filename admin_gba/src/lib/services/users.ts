import { supabase } from '@/lib/supabase/client';

export type ProfileRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;
  city?: string | null;
  is_available?: boolean | null;
  avatar_url?: string | null;
  is_suspended?: boolean | null;
  suspended_at?: string | null;
  suspended_by?: string | null;
  suspension_reason?: string | null;
  last_seen_at?: string | null;
  is_online?: boolean | null;
  created_at?: string;
};

export type FetchUsersParams = {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
};

export type UsersKpis = {
  total: number;
  clients: number;
  drivers: number;
  admins: number;
};

export async function fetchUsersKpis(): Promise<UsersKpis> {
  const [totalRes, clientsRes, driversRes, adminsRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).or('role.is.null,role.eq.client,role.eq.user'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
  ]);
  return {
    total: totalRes.count ?? 0,
    clients: clientsRes.count ?? 0,
    drivers: driversRes.count ?? 0,
    admins: adminsRes.count ?? 0,
  };
}

export async function fetchUsers(params: FetchUsersParams) {
  const { page, pageSize, role, search } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('profiles')
    .select('id, email, first_name, last_name, phone, role, city, is_available, avatar_url, is_suspended, last_seen_at, is_online, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (role && role !== 'all') {
    if (role === 'client' || role === 'user') {
      // Clients can have role null, 'client', or 'user'
      q = q.or('role.is.null,role.eq.client,role.eq.user');
    } else {
      q = q.eq('role', role);
    }
  }
  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data || []) as ProfileRow[], count: count || 0 };
}

export async function fetchUserById(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, phone, role, city, is_available, avatar_url, is_suspended, suspended_at, suspended_by, suspension_reason, last_seen_at, is_online, created_at')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function updateUserProfile(userId: string, patch: Partial<ProfileRow>) {
  const allowed: Partial<ProfileRow> = {
    first_name: patch.first_name,
    last_name: patch.last_name,
    phone: patch.phone,
    role: patch.role,
    city: patch.city,
    is_available: patch.is_available,
    avatar_url: patch.avatar_url,
    is_suspended: patch.is_suspended,
    suspended_at: patch.suspended_at,
    suspended_by: patch.suspended_by,
    suspension_reason: patch.suspension_reason,
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(allowed)
    .eq('id', userId)
    .select('id, email, first_name, last_name, phone, role, city, is_available, avatar_url, is_suspended, suspended_at, suspended_by, suspension_reason, created_at')
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export type UserOrderRow = {
  id: string;
  order_number: string | null;
  status: string | null;
  total_amount: number | null;
  created_at: string;
  paid_at?: string | null;
  driver_id?: string | null;
};

export type UserOrderEnrichedRow = UserOrderRow & {
  payment_provider?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  total_items?: number | null;
  items?: any;
  shipping_address?: any;
  shipping_city?: string | null;
  shipping_district?: string | null;
  shipping_country?: string | null;
};

export async function fetchUserOrders(userId: string, params: { page: number; pageSize: number } = { page: 1, pageSize: 10 }) {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data, error, count } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount, created_at, paid_at, driver_id', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data || []) as UserOrderRow[], count: count || 0 };
}

export async function fetchUserOrdersEnriched(
  userId: string,
  params: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
) {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data, error, count } = await supabase
    .from('order_details_view')
    .select(
      'id, order_number, status, total_amount, created_at, paid_at, payment_provider, driver_id, driver_name, driver_phone, total_items, items, shipping_address, shipping_city, shipping_district, shipping_country',
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data || []) as UserOrderEnrichedRow[], count: count || 0 };
}

export type UserEngagementMetrics = {
  total_actions?: number | null;
  orders_placed?: number | null;
  products_viewed?: number | null;
  messages_sent?: number | null;
  favorites_added?: number | null;
  total_sessions?: number | null;
  total_time_spent_seconds?: number | null;
  total_amount_spent?: number | null;
  last_activity_at?: string | null;
};

export async function fetchUserEngagementMetrics(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_activity_metrics')
      .select('total_actions, orders_placed, products_viewed, messages_sent, favorites_added, total_sessions, total_time_spent_seconds, total_amount_spent, last_activity_at')
      .eq('user_id', userId)
      .eq('period_type', 'all_time')
      .maybeSingle();
    if (error) return null;
    return (data as any as UserEngagementMetrics) || null;
  } catch {
    return null;
  }
}

export type UserLastLocationRow = {
  user_id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  captured_at: string;
};

export async function fetchUserLastLocation(userId: string) {
  const { data, error } = await supabase
    .from('user_locations')
    .select('user_id, lat, lng, accuracy, captured_at')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any as UserLastLocationRow) || null;
}

export type UserOrderStats = {
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  lastOrderNumber: string | null;
};

export async function fetchUserOrderStats(userId: string): Promise<UserOrderStats> {
  const { data: rows, error } = await supabase
    .from('orders')
    .select('total_amount, created_at, order_number')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  const list = (rows || []) as any[];
  const ordersCount = list.length;
  const totalSpent = list.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const last = list[0] || null;
  return {
    ordersCount,
    totalSpent,
    lastOrderAt: last?.created_at || null,
    lastOrderNumber: last?.order_number || null,
  };
}

export type UserCartItemRow = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  products?: { id: string; name: string; price?: number | null; main_image?: string | null } | null;
};

export async function fetchUserCartItems(userId: string) {
  const { data, error } = await supabase
    .from('cart_items')
    .select('id, user_id, product_id, quantity, created_at, products(id,name,price,main_image)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as any as UserCartItemRow[];
}

export async function clearUserCart(userId: string) {
  const { error } = await supabase.from('cart_items').delete().eq('user_id', userId);
  if (error) throw error;
}

export type UserFavoriteRow = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  products?: { id: string; name: string; price?: number | null; main_image?: string | null } | null;
};

export async function fetchUserFavorites(userId: string) {
  const { data, error } = await supabase
    .from('favorites')
    .select('id, user_id, product_id, created_at, products(id,name,price,main_image)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as any as UserFavoriteRow[];
}

export async function deleteUserFavorite(favoriteId: string) {
  const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);
  if (error) throw error;
}

export type UserSessionRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string | null;
  device_type?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

export async function fetchUserSessions(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, user_id, started_at, ended_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    device_type: null,
    ip_address: null,
    user_agent: null,
  })) as UserSessionRow[];
}

export type UserActivityRow = {
  id: string;
  user_id: string;
  action_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_details?: any;
  created_at: string;
};

export type EnrichedEntity = {
  label: string;
  image?: string | null;
  price?: number | null;
  subtitle?: string | null;
};

export type UserActivityEnrichedRow = UserActivityRow & {
  entity?: EnrichedEntity | null;
  action_label?: string;
  detail_label?: string | null;
};

export async function fetchUserActivities(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('user_activities')
    .select('id, user_id, action_type, entity_type, entity_id, action_details, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as UserActivityRow[];
}

export async function fetchUserActivitiesEnriched(userId: string, limit = 50) {
  const base = await fetchUserActivities(userId, limit);

  const actionLabel = (t?: string | null) => {
    const k = String(t || '').toLowerCase();
    if (!k) return '—';
    if (k === 'app_opened') return 'Ouverture de l’app';
    if (k === 'cart_add') return 'Ajout au panier';
    if (k === 'cart_remove') return 'Retrait du panier';
    if (k === 'favorite_add' || k === 'fav_add') return 'Ajout aux favoris';
    if (k === 'favorite_remove' || k === 'fav_remove') return 'Retrait des favoris';
    if (k === 'order_created') return 'Commande créée';
    return k;
  };

  const detailLabel = (a: UserActivityRow) => {
    const d: any = a.action_details;
    const qty = d?.quantity ?? d?.qty;
    if (qty != null && !Number.isNaN(Number(qty))) return `Qté: ${Number(qty)}`;
    return null;
  };

  const productIds = [...new Set(
    base
      .filter((a) => (a.entity_type || '').toLowerCase() === 'product' && a.entity_id)
      .map((a) => String(a.entity_id)),
  )];

  const productMap: Record<string, EnrichedEntity> = {};
  if (productIds.length) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, main_image, price')
      .in('id', productIds);
    (prods || []).forEach((p: any) => {
      productMap[p.id] = { label: p.name || p.id.slice(0, 8), image: p.main_image || null, price: p.price ?? null, subtitle: null };
    });
  }

  return base.map((a) => {
    const et = (a.entity_type || '').toLowerCase();
    const detail = detailLabel(a);
    if (et === 'product' && a.entity_id) {
      const ent = productMap[String(a.entity_id)] || { label: `Produit ${String(a.entity_id).slice(0, 8)}`, subtitle: null };
      return { ...a, entity: { ...ent, subtitle: detail }, action_label: actionLabel(a.action_type), detail_label: detail };
    }
    if (a.entity_type && a.entity_id) {
      return {
        ...a,
        entity: { label: `${a.entity_type}: ${String(a.entity_id).slice(0, 8)}`, subtitle: detail },
        action_label: actionLabel(a.action_type),
        detail_label: detail,
      };
    }
    return { ...a, entity: null, action_label: actionLabel(a.action_type), detail_label: detail };
  }) as UserActivityEnrichedRow[];
}

export async function suspendUser(userId: string, suspendedBy: string, reason: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_by: suspendedBy,
      suspension_reason: reason,
    })
    .eq('id', userId)
    .select('id, email, first_name, last_name, phone, role, city, is_available, avatar_url, is_suspended, suspended_at, suspended_by, suspension_reason, created_at')
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function unsuspendUser(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_suspended: false,
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
    })
    .eq('id', userId)
    .select('id, email, first_name, last_name, phone, role, city, is_available, avatar_url, is_suspended, suspended_at, suspended_by, suspension_reason, created_at')
    .single();

  if (error) throw error;
  return data as ProfileRow;
}
