import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import {
  loadNotificationCounts,
  loadOrderAggregatesForUsers,
  loadTokenCounts,
} from '@/app/api/users/_lib/user-metrics';
import { loadUserSessionRows } from '@/app/api/users/_lib/user-sessions';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  role: z.enum(['admin', 'driver', 'client', 'user', 'superadmin', 'super_admin']).optional(),
  is_suspended: z.boolean().optional(),
  suspension_reason: z.string().max(500).optional().nullable(),
  first_name: z.string().max(120).optional().nullable(),
  last_name: z.string().max(120).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  avatar_url: z.string().max(2000).optional().nullable(),
  role_change_reason: z.string().min(3).max(500).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('users', 'read');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data: profile, error: pe } = await sb
      .from('profiles')
      .select(
        'id, email, first_name, last_name, phone, role, city, country, is_available, avatar_url, is_suspended, suspended_at, suspended_by, suspension_reason, last_seen_at, is_online, created_at, loyalty_points, updated_at',
      )
      .eq('id', id)
      .maybeSingle();

    if (pe) throw pe;
    if (!profile) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const roleNorm = String(profile.role || '').toLowerCase();
    const isAdminLike = ['admin', 'superadmin', 'super_admin'].includes(roleNorm);
    const isDriver = roleNorm === 'driver';

    let last_sign_in_at: string | null = null;
    try {
      const { data: au } = await sb.auth.admin.getUserById(id);
      last_sign_in_at = au.user?.last_sign_in_at ?? null;
    } catch {
      /* ignore */
    }

    /** Fiches admin / superadmin : aucune métrique e-commerce. */
    if (isAdminLike) {
      const tc = await loadTokenCounts(sb, [id]);
      const sessions = await loadUserSessionRows(sb, id);
      const { data: roleAudits } = await sb
        .from('audit_logs')
        .select('id, created_at, user_id, action_type, entity_type, changes, metadata')
        .eq('entity_type', 'user')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(40);
      const { data: tokens } = await sb
        .from('device_tokens')
        .select('id, token, platform, device_model, is_valid, last_seen_at, last_active_at, updated_at, created_at')
        .eq('user_id', id)
        .order('updated_at', { ascending: false })
        .limit(50);
      const nc = await loadNotificationCounts(sb, [id]);
      return NextResponse.json({
        profile: { ...profile, last_sign_in_at },
        stats: {
          orders_count: 0,
          total_spent: 0,
          ltv_score: null,
          device_tokens_count: tc[id] || 0,
          notifications_received_count: nc[id] || 0,
          reorder_rate: 0,
          avg_basket: 0,
          delivered_count: 0,
        },
        bigdata: null,
        orders: [],
        payments: [],
        device_tokens: tokens || [],
        activities: [],
        sessions: sessions || [],
        role_audit_samples: roleAudits || [],
        user_behaviors: [],
      });
    }

    /** Livreur : pas de tunnel e-commerce client. */
    if (isDriver) {
      const tc = await loadTokenCounts(sb, [id]);
      const nc = await loadNotificationCounts(sb, [id]);
      const sessions = await loadUserSessionRows(sb, id);
      const { data: roleAudits } = await sb
        .from('audit_logs')
        .select('id, created_at, user_id, action_type, entity_type, changes, metadata')
        .eq('entity_type', 'user')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(40);
      const { data: tokens } = await sb
        .from('device_tokens')
        .select('id, token, platform, device_model, is_valid, last_seen_at, last_active_at, updated_at, created_at')
        .eq('user_id', id)
        .order('updated_at', { ascending: false })
        .limit(50);
      const { data: activities } = await sb
        .from('user_activities')
        .select('id, action_type, entity_type, entity_id, action_details, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      return NextResponse.json({
        profile: { ...profile, last_sign_in_at },
        stats: {
          orders_count: 0,
          total_spent: 0,
          ltv_score: null,
          device_tokens_count: tc[id] || 0,
          notifications_received_count: nc[id] || 0,
          reorder_rate: 0,
          avg_basket: 0,
          delivered_count: 0,
        },
        bigdata: null,
        orders: [],
        payments: [],
        device_tokens: tokens || [],
        activities: activities || [],
        sessions: sessions || [],
        role_audit_samples: roleAudits || [],
        user_behaviors: [],
      });
    }

    const { orderCount, spent } = await loadOrderAggregatesForUsers(sb, [id]);
    const tc = await loadTokenCounts(sb, [id]);
    const nc = await loadNotificationCounts(sb, [id]);
    const totalSpent = spent[id] || 0;
    const ordersCount = orderCount[id] || 0;

    const { data: orders } = await sb
      .from('orders')
      .select('id, status, total_amount, payment_status, payment_method, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: payments } = await sb
      .from('payments')
      .select('id, order_id, amount, currency, status, provider, created_at, updated_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: tokens } = await sb
      .from('device_tokens')
      .select('id, token, platform, device_model, is_valid, last_seen_at, last_active_at, updated_at, created_at')
      .eq('user_id', id)
      .order('updated_at', { ascending: false })
      .limit(50);

    const { data: activities } = await sb
      .from('user_activities')
      .select('id, action_type, entity_type, entity_id, action_details, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(500);

    const sessions = await loadUserSessionRows(sb, id);

    const { data: roleAudits } = await sb
      .from('audit_logs')
      .select('id, created_at, user_id, action_type, entity_type, changes, metadata')
      .eq('entity_type', 'user')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(40);

    const ubRes = await sb
      .from('user_behavior')
      .select('id, product_id, action, duration_seconds, source, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    const mapActivityToBehavior = (actionType: string | null | undefined): string => {
      const t = String(actionType || '').toLowerCase();
      if (t === 'product_view') return 'view';
      if (t === 'cart_add') return 'add_to_cart';
      if (t === 'order_created') return 'purchase';
      if (t === 'favorite_add' || t === 'fav_add') return 'wishlist';
      return t || 'view';
    };

    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const { data: ordersYear } = await sb
      .from('orders')
      .select('created_at, total_amount, status')
      .eq('user_id', id)
      .gte('created_at', yearAgo)
      .order('created_at', { ascending: true })
      .limit(2000);

    const monthMap = new Map<string, number>();
    for (const o of ordersYear || []) {
      const ca = String((o as { created_at: string }).created_at);
      const key = ca.slice(0, 7);
      monthMap.set(key, (monthMap.get(key) || 0) + Number((o as { total_amount?: number }).total_amount || 0));
    }
    const monthly_spending = [...monthMap.entries()].map(([month, amount]) => ({ month, amount }));

    let behaviorList = ubRes.error ? [] : ubRes.data || [];
    if (behaviorList.length === 0 && (activities?.length ?? 0) > 0) {
      behaviorList = (activities || []).slice(0, 120).map((a) => {
        const row = a as {
          id: string;
          entity_id?: string | null;
          action_type?: string | null;
          created_at: string;
        };
        const act = mapActivityToBehavior(row.action_type);
        return {
          id: row.id,
          product_id: row.entity_id,
          action: act,
          duration_seconds: null as number | null,
          source: 'user_activities',
          created_at: row.created_at,
        };
      });
    }
    const behavior_counts = { view: 0, add_to_cart: 0, purchase: 0, wishlist: 0, share: 0 };
    for (const b of behaviorList) {
      const a = String((b as { action?: string }).action || '');
      if (a in behavior_counts) (behavior_counts as Record<string, number>)[a] += 1;
    }

    const ordList = orders || [];
    const delivered = ordList.filter((o) => ['delivered', 'completed'].includes(String((o as { status?: string }).status)));
    const reorder_rate = ordersCount >= 2 ? 100 : 0;
    const avg_basket = ordersCount > 0 ? Math.round(totalSpent / ordersCount) : 0;

    return NextResponse.json({
      profile: { ...profile, last_sign_in_at },
      stats: {
        orders_count: ordersCount,
        total_spent: totalSpent,
        ltv_score: Math.min(100, Math.round(Math.log10(totalSpent + 1) * 25)),
        device_tokens_count: tc[id] || 0,
        notifications_received_count: nc[id] || 0,
        reorder_rate,
        avg_basket,
        delivered_count: delivered.length,
      },
      bigdata: {
        monthly_spending,
        behavior_counts,
        product_views: behavior_counts.view,
        cart_adds: behavior_counts.add_to_cart,
        checkouts: behavior_counts.purchase,
      },
      orders: orders || [],
      payments: payments || [],
      device_tokens: tokens || [],
      activities: activities || [],
      sessions: sessions || [],
      role_audit_samples: roleAudits || [],
      user_behaviors: behaviorList,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('users', 'update');
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation', details: parsed.error.flatten() }, { status: 422 });
  }

  if (
    parsed.data.role !== undefined &&
    ['superadmin', 'super_admin', 'admin'].includes(parsed.data.role)
  ) {
    const sup = await requireSuperAdmin();
    if (!sup.ok) return sup.response;
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  const { data: before } = await sb
    .from('profiles')
    .select(
      'id, email, role, first_name, last_name, phone, city, country, avatar_url, is_suspended, suspension_reason',
    )
    .eq('id', id)
    .maybeSingle();

  if (!before) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  if (
    parsed.data.role !== undefined &&
    parsed.data.role !== before.role &&
    !parsed.data.role_change_reason
  ) {
    return NextResponse.json({ error: 'Motif obligatoire pour changement de rôle' }, { status: 422 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) {
    const normalizedRole = parsed.data.role === 'super_admin' ? 'superadmin' : parsed.data.role;
    patch.role = normalizedRole;
    if (normalizedRole === 'superadmin') {
      patch.is_suspended = false;
      patch.suspended_at = null;
      patch.suspended_by = null;
      patch.suspension_reason = null;
    }
  }
  if (parsed.data.first_name !== undefined) patch.first_name = parsed.data.first_name;
  if (parsed.data.last_name !== undefined) patch.last_name = parsed.data.last_name;
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
  if (parsed.data.city !== undefined) patch.city = parsed.data.city;
  if (parsed.data.country !== undefined) patch.country = parsed.data.country;
  if (parsed.data.avatar_url !== undefined) patch.avatar_url = parsed.data.avatar_url;

  if (parsed.data.is_suspended === true) {
    patch.is_suspended = true;
    patch.suspended_at = new Date().toISOString();
    patch.suspended_by = auth.userId;
    patch.suspension_reason = parsed.data.suspension_reason ?? 'Suspended by admin';
  } else if (parsed.data.is_suspended === false) {
    patch.is_suspended = false;
    patch.suspended_at = null;
    patch.suspended_by = null;
    patch.suspension_reason = null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 422 });
  }

  const { data, error } = await sb.from('profiles').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (parsed.data.role !== undefined) {
    const normalizedRole = parsed.data.role === 'super_admin' ? 'superadmin' : parsed.data.role;
    await sb.auth.admin.updateUserById(id, { app_metadata: { role: normalizedRole } }).catch(() => null);
  }

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'update',
    entityType: 'user',
    entityId: id,
    changes: {
      before: before as Record<string, unknown>,
      after: (data || {}) as Record<string, unknown>,
    },
    description: parsed.data.role_change_reason ?? 'Mise à jour profil utilisateur',
    metadata: { field: parsed.data.role !== undefined ? 'role' : 'profile' },
  });

  return NextResponse.json({ ok: true, data });
}
