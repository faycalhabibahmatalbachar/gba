'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Spin, Switch, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EyeOutlined, LockOutlined, UnlockOutlined, UserOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import type { ProfileRow, UserActivityRow, UserCartItemRow, UserFavoriteRow, UserOrderRow, UserSessionRow } from '@/lib/services/users';
import { translateOrderStatus } from '@/lib/i18n/translations';
import {
  clearUserCart,
  deleteUserFavorite,
  fetchUserActivities,
  fetchUserActivitiesEnriched,
  fetchUserById,
  fetchUserCartItems,
  fetchUserFavorites,
  fetchUserEngagementMetrics,
  fetchUserLastLocation,
  fetchUserOrders,
  fetchUserOrdersEnriched,
  fetchUserOrderStats,
  fetchUserSessions,
  suspendUser,
  unsuspendUser,
  updateUserProfile,
} from '@/lib/services/users';
import { supabase } from '@/lib/supabase/client';

export default function UserDetailPage() {
  const { message, modal } = App.useApp();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<ProfileRow | null>(null);
  const [suspendLoading, setSuspendLoading] = useState(false);

  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);

  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [activeOrderRaw, setActiveOrderRaw] = useState<any | null>(null);
  const [orderRawLoading, setOrderRawLoading] = useState(false);

  const [statsLoading, setStatsLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<{ ordersCount: number; totalSpent: number; lastOrderAt: string | null; lastOrderNumber: string | null } | null>(null);
  const [lastLocLoading, setLastLocLoading] = useState(true);
  const [lastLoc, setLastLoc] = useState<{ lat: number; lng: number; accuracy?: number | null; captured_at: string } | null>(null);

  const [engagementLoading, setEngagementLoading] = useState(true);
  const [engagement, setEngagement] = useState<any | null>(null);

  const [cartLoading, setCartLoading] = useState(true);
  const [cartItems, setCartItems] = useState<UserCartItemRow[]>([]);

  const [favLoading, setFavLoading] = useState(true);
  const [favorites, setFavorites] = useState<UserFavoriteRow[]>([]);

  const [activityLoading, setActivityLoading] = useState(true);
  const [sessions, setSessions] = useState<UserSessionRow[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [form] = Form.useForm<ProfileRow>();

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const u = await fetchUserById(String(userId));
      setUser(u);
      form.setFieldsValue(u);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const loadCart = async () => {
    if (!userId) return;
    setCartLoading(true);
    try {
      const data = await fetchUserCartItems(String(userId));
      setCartItems(data);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
      setCartItems([]);
    } finally {
      setCartLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (!userId) return;
    setFavLoading(true);
    try {
      const data = await fetchUserFavorites(String(userId));
      setFavorites(data);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
      setFavorites([]);
    } finally {
      setFavLoading(false);
    }
  };

  const loadActivity = async () => {
    if (!userId) return;
    setActivityLoading(true);
    try {
      const [sess, acts] = await Promise.all([
        fetchUserSessions(String(userId), 20),
        fetchUserActivitiesEnriched(String(userId), 50).catch(() => [] as any[]),
      ]);
      setSessions(sess);
      setActivities(acts);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
      setSessions([]);
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!userId) return;
    setOrdersLoading(true);
    try {
      const res = await fetchUserOrdersEnriched(String(userId), { page: ordersPage, pageSize: ordersPageSize });
      setOrders(res.data);
      setOrdersTotal(res.count);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadEnrichment = async () => {
    if (!userId) return;
    setStatsLoading(true);
    setLastLocLoading(true);
    setEngagementLoading(true);
    try {
      const [stats, loc] = await Promise.all([
        fetchUserOrderStats(String(userId)).catch(() => null),
        fetchUserLastLocation(String(userId)).catch(() => null),
      ]);
      setOrderStats(stats);
      setLastLoc(loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, captured_at: loc.captured_at } : null);
      const m = await fetchUserEngagementMetrics(String(userId)).catch(() => null);
      setEngagement(m);
    } finally {
      setStatsLoading(false);
      setLastLocLoading(false);
      setEngagementLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ordersPage, ordersPageSize]);

  useEffect(() => {
    void loadEnrichment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    void loadCart();
    void loadFavorites();
    void loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    void getCurrentUser();
  }, []);

  const title = useMemo(() => {
    const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    return name || user?.email || 'Utilisateur';
  }, [user]);

  const lastLocLabel = useMemo(() => {
    if (!lastLoc?.captured_at) return '—';
    return new Date(lastLoc.captured_at).toLocaleString('fr-FR');
  }, [lastLoc]);

  const engagementScore = useMemo(() => {
    if (!engagement) return null;
    const totalActions = Number(engagement.total_actions || 0);
    const ordersPlaced = Number(engagement.orders_placed || 0);
    const productsViewed = Number(engagement.products_viewed || 0);
    const messagesSent = Number(engagement.messages_sent || 0);
    const favoritesAdded = Number(engagement.favorites_added || 0);
    const totalSessions = Number(engagement.total_sessions || 0);

    const score =
      Math.min(100, totalActions * 0.1) * 0.3 +
      Math.min(100, ordersPlaced * 10) * 0.25 +
      Math.min(100, productsViewed * 0.5) * 0.15 +
      Math.min(100, messagesSent * 2) * 0.1 +
      Math.min(100, favoritesAdded * 1) * 0.1 +
      Math.min(100, totalSessions * 0.5) * 0.1;

    return Math.round(score);
  }, [engagement]);

  const engagementLevel = useMemo(() => {
    const s = engagementScore ?? 0;
    if (engagementScore == null) return null;
    if (s >= 80) return { label: 'Très actif', color: 'green' as const };
    if (s >= 60) return { label: 'Actif', color: 'blue' as const };
    if (s >= 40) return { label: 'Modéré', color: 'gold' as const };
    if (s >= 20) return { label: 'Peu actif', color: 'orange' as const };
    return { label: 'Inactif', color: 'default' as const };
  }, [engagementScore]);

  const ordersColumns: ColumnsType<any> = useMemo(() => [
    {
      title: 'Commande',
      key: 'order',
      width: 210,
      render: (_v, r) => {
        const num = r.order_number || r.id.slice(0, 8);
        const items = r.total_items != null ? `${Number(r.total_items)} article(s)` : '—';
        return (
          <div>
            <div style={{ fontWeight: 800 }}>{num}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(r.created_at).toLocaleString('fr-FR')}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{items}</div>
          </div>
        );
      },
    },
    {
      title: 'Statut',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v) => {
        const s = String(v || '—');
        const color = s === 'delivered' ? 'green' : s === 'cancelled' ? 'red' : s === 'in_delivery' ? 'blue' : 'default';
        return <Tag color={color}>{translateOrderStatus(v)}</Tag>;
      },
    },
    {
      title: 'Paiement',
      key: 'payment',
      width: 160,
      render: (_v, r) => {
        const provider = r.payment_provider || '—';
        const paid = r.paid_at ? 'Payé' : 'Non payé';
        return (
          <div>
            <div style={{ fontWeight: 700 }}>{provider}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{paid}</div>
          </div>
        );
      },
      responsive: ['md'],
    },
    {
      title: 'Destination',
      key: 'dest',
      width: 240,
      render: (_v, r) => {
        const city = r.shipping_city || '';
        const district = r.shipping_district || '';
        const country = r.shipping_country || '';
        const line = [district, city, country].filter(Boolean).join(', ');
        return <span style={{ fontSize: 12, opacity: 0.85 }}>{line || '—'}</span>;
      },
      responsive: ['lg'],
    },
    {
      title: 'Livreur',
      key: 'driver',
      width: 200,
      render: (_v, r) => {
        const name = r.driver_name || (r.driver_id ? String(r.driver_id).slice(0, 8) : null);
        if (!name) return <span style={{ fontSize: 12, opacity: 0.75 }}>—</span>;
        return (
          <div>
            <div style={{ fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{r.driver_phone || ''}</div>
          </div>
        );
      },
      responsive: ['lg'],
    },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      align: 'right',
      render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 900, color: '#4f46e5' }}>{v != null ? `${Number(v).toLocaleString('fr-FR')} XAF` : '—'}</span>,
    },
    {
      title: 'Payé',
      dataIndex: 'paid_at',
      key: 'paid_at',
      width: 120,
      render: (v) => (v ? <Tag color="green">Oui</Tag> : <Tag>Non</Tag>),
      responsive: ['md'],
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_v, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setActiveOrder(r);
            setActiveOrderRaw(null);
            setOrderDetailsOpen(true);
            setOrderRawLoading(true);
            (async () => {
              try {
                const { data, error } = await supabase
                  .from('orders')
                  .select('id, shipping_fee, shipping_cost, tax_amount, discount_amount, payment_method, payment_status, notes, currency, delivery_lat, delivery_lng, delivery_accuracy, delivery_captured_at')
                  .eq('id', r.id)
                  .maybeSingle();
                if (!error) setActiveOrderRaw(data || null);
              } finally {
                setOrderRawLoading(false);
              }
            })();
          }}
        />
      ),
    },
  ], []);

  const cartTotal = useMemo(() => cartItems.reduce((s, it) => s + Number(it.products?.price || 0) * Number(it.quantity || 0), 0), [cartItems]);
  const cartCount = useMemo(() => cartItems.reduce((s, it) => s + Number(it.quantity || 0), 0), [cartItems]);

  const cartColumns: ColumnsType<UserCartItemRow> = useMemo(() => [
    {
      title: 'Produit',
      key: 'product',
      render: (_v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {r.products?.main_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.products.main_image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
              {r.products?.name || 'Produit'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{r.product_id?.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Qté',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center',
    },
    {
      title: 'Prix',
      key: 'price',
      width: 140,
      align: 'right',
      render: (_v, r) => <span>{r.products?.price != null ? `${Number(r.products.price).toLocaleString('fr-FR')} XAF` : '—'}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_v, r) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            disabled={!r.products?.main_image}
            onClick={() => {
              if (!r.products?.main_image) return;
              modal.info({
                title: r.products?.name || 'Image produit',
                width: 520,
                icon: null,
                content: (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.products.main_image}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 12, objectFit: 'contain' }}
                    />
                  </div>
                ),
              });
            }}
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => {
              modal.confirm({
                title: 'Supprimer du panier',
                content: 'Supprimer cet article du panier ? ',
                okText: 'Supprimer',
                cancelText: 'Annuler',
                onOk: async () => {
                  try {
                    const { error } = await supabase.from('cart_items').delete().eq('id', r.id);
                    if (error) throw error;
                    message.success('Supprimé');
                    void loadCart();
                  } catch (e: any) {
                    message.error(e?.message || 'Erreur');
                  }
                },
              });
            }}
          />
        </Space>
      ),
    },
    {
      title: 'Sous-total',
      key: 'subtotal',
      width: 160,
      align: 'right',
      render: (_v, r) => {
        const v = Number(r.products?.price || 0) * Number(r.quantity || 0);
        return <span style={{ fontWeight: 800 }}>{v.toLocaleString('fr-FR')} XAF</span>;
      },
    },
  ], [message, modal]);

  const favoritesColumns: ColumnsType<UserFavoriteRow> = useMemo(() => [
    {
      title: 'Produit',
      key: 'product',
      render: (_v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {r.products?.main_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.products.main_image}
              alt=""
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flex: '0 0 auto' }}
            />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', flex: '0 0 auto' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
              {r.products?.name || 'Produit'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{r.product_id?.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Prix',
      key: 'price',
      width: 140,
      align: 'right',
      render: (_v, r) => (
        <span style={{ fontWeight: 800, color: '#4f46e5' }}>
          {r.products?.price != null ? `${Number(r.products.price).toLocaleString('fr-FR')} XAF` : '—'}
        </span>
      ),
      responsive: ['md'],
    },
    {
      title: 'Ajouté',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v) => <span style={{ fontSize: 12, opacity: 0.75 }}>{v ? new Date(v).toLocaleString('fr-FR') : '—'}</span>,
      responsive: ['md'],
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_v, r) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            disabled={!r.products?.main_image}
            onClick={() => {
              if (!r.products?.main_image) return;
              modal.info({
                title: r.products?.name || 'Image produit',
                width: 520,
                icon: null,
                content: (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.products.main_image}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 12, objectFit: 'contain' }}
                    />
                  </div>
                ),
              });
            }}
          />
          <Button
            danger
            size="small"
            onClick={() => {
              modal.confirm({
                title: 'Retirer des favoris',
                content: 'Supprimer ce favori ? ',
                okText: 'Supprimer',
                cancelText: 'Annuler',
                onOk: async () => {
                  try {
                    await deleteUserFavorite(r.id);
                    message.success('Supprimé');
                    void loadFavorites();
                  } catch (e: any) {
                    message.error(e?.message || 'Erreur');
                  }
                },
              });
            }}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ], [message, modal]);

  const sessionsColumns: ColumnsType<UserSessionRow> = useMemo(() => [
    {
      title: 'Début',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (v) => <span style={{ fontSize: 12, opacity: 0.85 }}>{v ? new Date(v).toLocaleString('fr-FR') : '—'}</span>,
    },
    {
      title: 'Fin',
      dataIndex: 'ended_at',
      key: 'ended_at',
      width: 180,
      render: (v) => <span style={{ fontSize: 12, opacity: 0.85 }}>{v ? new Date(v).toLocaleString('fr-FR') : '—'}</span>,
      responsive: ['md'],
    },
  ], []);

  const activityStats = useMemo(() => {
    const total = activities.length;
    const counts: Record<string, number> = {};
    activities.forEach((a) => {
      const k = String(a.action_type || 'other');
      counts[k] = (counts[k] || 0) + 1;
    });
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return { total, top };
  }, [activities]);

  const activityColumns: ColumnsType<any> = useMemo(() => [
    {
      title: 'Action',
      dataIndex: 'action_type',
      key: 'action_type',
      width: 180,
      render: (v, r) => {
        const k = String(v || '—');
        const lower = k.toLowerCase();
        const color = lower.includes('cart') ? 'blue' : lower.includes('fav') ? 'magenta' : lower.includes('app') ? 'green' : 'default';
        return <Tag color={color}>{r?.action_label || k}</Tag>;
      },
    },
    {
      title: 'Entité',
      key: 'entity',
      width: 320,
      render: (_v, r) => {
        const ent = r.entity;
        if (ent?.label) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {ent.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ent.image} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6' }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
                  {ent.label}
                </div>
                {ent.subtitle ? <div style={{ fontSize: 12, opacity: 0.7 }}>{ent.subtitle}</div> : null}
                {ent.price != null ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{Number(ent.price).toLocaleString('fr-FR')} XAF</div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.5 }}>{r.entity_type ? String(r.entity_type) : '—'}</div>
                )}
              </div>
            </div>
          );
        }

        const fallback = `${r.entity_type || '—'}${r.entity_id ? `: ${String(r.entity_id).slice(0, 8)}` : ''}`;
        return (
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{fallback}</div>
            {r.detail_label ? <div style={{ fontSize: 12, opacity: 0.7 }}>{r.detail_label}</div> : null}
          </div>
        );
      },
      responsive: ['md'],
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v) => <span style={{ fontSize: 12, opacity: 0.85 }}>{v ? new Date(v).toLocaleString('fr-FR') : '—'}</span>,
    },
  ], []);

  const handleSuspend = async () => {
    if (!userId || !user || !currentUserId) return;
    modal.confirm({
      title: "Suspendre l'utilisateur",
      content: (
        <div>
          <p>Êtes-vous sûr de vouloir suspendre cet utilisateur ?</p>
          <p>{"L'utilisateur sera bloqué et ne pourra plus utiliser l'application."}</p>
        </div>
      ),
      okText: 'Suspendre',
      okType: 'danger',
      cancelText: 'Annuler',
      onOk: async () => {
        setSuspendLoading(true);
        try {
          const updated = await suspendUser(String(userId), currentUserId, 'Suspension par administrateur');
          setUser(updated);
          message.success('Utilisateur suspendu');
        } catch (e: any) {
          message.error(e?.message || 'Erreur lors de la suspension');
        } finally {
          setSuspendLoading(false);
        }
      },
    });
  };

  const handleUnsuspend = async () => {
    if (!userId || !user) return;
    setSuspendLoading(true);
    try {
      const updated = await unsuspendUser(String(userId));
      setUser(updated);
      message.success('Utilisateur réactivé');
    } catch (e: any) {
      message.error(e?.message || 'Erreur lors de la réactivation');
    } finally {
      setSuspendLoading(false);
    }
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const updated = await updateUserProfile(String(userId), values);
      setUser(updated);
      form.setFieldsValue(updated);
      message.success('Profil mis à jour');
    } catch (e: any) {
      if (e?.errorFields) {
        // validation
      } else {
        message.error(e?.message || 'Erreur');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header avec avatar et contrôles */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div style={{ position: 'relative' }}>
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt="Avatar"
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: user?.is_suspended ? '3px solid #ef4444' : '3px solid #22c55e' }}
              />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: user?.is_suspended ? '3px solid #ef4444' : '3px solid #22c55e' }}>
                <UserOutlined style={{ fontSize: 32, color: '#9ca3af' }} />
              </div>
            )}
            {user?.is_suspended && (
              <div style={{ position: 'absolute', bottom: -4, right: -4, background: '#ef4444', color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LockOutlined style={{ fontSize: 14 }} />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
              {user?.is_suspended ? (
                <Tag color="red" icon={<LockOutlined />}>Suspendu</Tag>
              ) : (
                <Tag color="green" icon={<UnlockOutlined />}>Actif</Tag>
              )}
            </div>
            <Typography.Text type="secondary">ID: {String(userId || '')}</Typography.Text>
            {user?.is_suspended && user?.suspended_at && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                Suspendu le: {new Date(user.suspended_at).toLocaleString('fr-FR')}
                {user?.suspension_reason && ` - ${user.suspension_reason}`}
              </div>
            )}
          </div>
        </div>
        <Space>
          {user?.is_suspended ? (
            <Button
              type="primary"
              icon={<UnlockOutlined />}
              onClick={() => void handleUnsuspend()}
              loading={suspendLoading}
            >
              Réactiver
            </Button>
          ) : (
            <Button
              danger
              icon={<LockOutlined />}
              onClick={() => void handleSuspend()}
              loading={suspendLoading}
            >
              Suspendre
            </Button>
          )}
        </Space>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card loading={statsLoading}>
          <div className="text-xs text-gray-500">Commandes</div>
          <div className="text-2xl font-extrabold">{orderStats ? orderStats.ordersCount : '—'}</div>
        </Card>
        <Card loading={statsLoading}>
          <div className="text-xs text-gray-500">Total dépensé</div>
          <div className="text-2xl font-extrabold text-indigo-600">{orderStats ? `${orderStats.totalSpent.toLocaleString('fr-FR')} XAF` : '—'}</div>
        </Card>
        <Card loading={statsLoading}>
          <div className="text-xs text-gray-500">Dernière commande</div>
          <div className="text-sm font-bold">{orderStats?.lastOrderNumber || '—'}</div>
          <div className="text-xs text-gray-500 mt-1">{orderStats?.lastOrderAt ? new Date(orderStats.lastOrderAt).toLocaleString('fr-FR') : '—'}</div>
        </Card>
        <Card loading={lastLocLoading}>
          <div className="text-xs text-gray-500">Dernière position</div>
          <div className="text-sm font-bold">{lastLoc ? `${Number(lastLoc.lat).toFixed(5)}, ${Number(lastLoc.lng).toFixed(5)}` : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">{lastLocLabel}{lastLoc?.accuracy != null ? ` (±${Number(lastLoc.accuracy).toFixed(0)}m)` : ''}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
        <Card loading={engagementLoading}>
          <div className="text-xs text-gray-500">Score d'engagement</div>
          <div className="text-4xl font-extrabold text-indigo-600">{engagementScore != null ? engagementScore : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">/100</div>
          {engagementLevel ? <Tag color={engagementLevel.color} style={{ marginTop: 8 }}>{engagementLevel.label}</Tag> : null}
        </Card>
        <Card loading={engagementLoading}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <div className="text-xs text-gray-500">Actions</div>
              <div className="text-xl font-extrabold">{engagement?.total_actions ?? '—'}</div>
            </Card>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <div className="text-xs text-gray-500">Produits vus</div>
              <div className="text-xl font-extrabold">{engagement?.products_viewed ?? '—'}</div>
            </Card>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <div className="text-xs text-gray-500">Favoris</div>
              <div className="text-xl font-extrabold">{engagement?.favorites_added ?? '—'}</div>
            </Card>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <div className="text-xs text-gray-500">Sessions</div>
              <div className="text-xl font-extrabold">{engagement?.total_sessions ?? '—'}</div>
            </Card>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <div className="text-xs text-gray-500">Temps total</div>
              <div className="text-xl font-extrabold">{engagement?.total_time_spent_seconds != null ? `${Math.round(Number(engagement.total_time_spent_seconds) / 60)} min` : '—'}</div>
            </Card>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <div className="text-xs text-gray-500">Dernière activité</div>
              <div className="text-sm font-bold">
                {user?.last_seen_at
                  ? new Date(user.last_seen_at).toLocaleString('fr-FR')
                  : (engagement?.last_activity_at ? new Date(String(engagement.last_activity_at)).toLocaleString('fr-FR') : '—')}
              </div>
              {user?.is_online && (
                <span className="flex items-center gap-1 mt-1">
                  <span className="presence-badge-online" />
                  <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>En ligne maintenant</span>
                </span>
              )}
            </Card>
          </div>
        </Card>
      </div>

      <Card>
        <Tabs
          items={[
            {
              key: 'overview',
              label: 'Profil',
              children: (
                <Spin spinning={loading}>
                  <div className="space-y-4">
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="Email">{user?.email || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Rôle">
                        <Tag color={user?.role === 'admin' ? 'purple' : user?.role === 'driver' ? 'blue' : 'default'}>{user?.role || 'user'}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Statut">
                        {user?.is_suspended ? (
                          <div>
                            <Tag color="red" icon={<LockOutlined />}>Suspendu</Tag>
                            {user?.suspended_at && (
                              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                                Depuis: {new Date(user.suspended_at).toLocaleString('fr-FR')}
                              </div>
                            )}
                            {user?.suspension_reason && (
                              <div style={{ fontSize: 12, marginTop: 2 }}>Raison: {user.suspension_reason}</div>
                            )}
                          </div>
                        ) : (
                          <Tag color="green" icon={<UnlockOutlined />}>Actif</Tag>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="Téléphone">{user?.phone || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Ville">{user?.city || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Créé le">{user?.created_at ? new Date(user.created_at).toLocaleString('fr-FR') : '—'}</Descriptions.Item>
                    </Descriptions>

                    <Form form={form} layout="vertical">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Form.Item name="first_name" label="Prénom">
                          <Input placeholder="Prénom" />
                        </Form.Item>
                        <Form.Item name="last_name" label="Nom">
                          <Input placeholder="Nom" />
                        </Form.Item>
                        <Form.Item name="phone" label="Téléphone">
                          <Input placeholder="Téléphone" />
                        </Form.Item>
                        <Form.Item name="city" label="Ville">
                          <Input placeholder="Ville" />
                        </Form.Item>
                        <Form.Item name="role" label="Rôle">
                          <Select
                            options={[
                              { value: 'user', label: 'Client' },
                              { value: 'driver', label: 'Livreur' },
                              { value: 'admin', label: 'Admin' },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item label="Disponibilité (driver)">
                          <Space>
                            <Form.Item name="is_available" noStyle valuePropName="checked">
                              <Switch />
                            </Form.Item>
                            <Typography.Text type="secondary">Active si le rôle est Livreur</Typography.Text>
                          </Space>
                        </Form.Item>
                      </div>

                      <Space>
                        <Button type="primary" onClick={() => void save()} loading={saving}>Enregistrer</Button>
                        <Button onClick={() => form.setFieldsValue(user || {})} disabled={!user}>Réinitialiser</Button>
                      </Space>
                    </Form>
                  </div>
                </Spin>
              ),
            },
            {
              key: 'orders',
              label: 'Commandes',
              children: (
                <div className="space-y-3">
                  <Typography.Text type="secondary">Historique des commandes de cet utilisateur</Typography.Text>
                  <Table
                    rowKey="id"
                    loading={ordersLoading}
                    columns={ordersColumns}
                    dataSource={orders}
                    pagination={{
                      current: ordersPage,
                      pageSize: ordersPageSize,
                      total: ordersTotal,
                      showSizeChanger: true,
                      onChange: (p, ps) => {
                        setOrdersPage(p);
                        setOrdersPageSize(ps);
                      },
                    }}
                    scroll={{ x: 1100 }}
                  />

                  <Modal
                    open={orderDetailsOpen}
                    onCancel={() => {
                      setOrderDetailsOpen(false);
                      setActiveOrder(null);
                      setActiveOrderRaw(null);
                    }}
                    footer={null}
                    title={activeOrder?.order_number || activeOrder?.id ? `Commande ${activeOrder.order_number || String(activeOrder.id).slice(0, 8)}` : 'Commande'}
                    width={820}
                  >
                    {activeOrder ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Card size="small" title="Paiement">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ fontSize: 12, opacity: 0.75 }}>Provider</span>
                              <span style={{ fontWeight: 800 }}>{activeOrder.payment_provider || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                              <span style={{ fontSize: 12, opacity: 0.75 }}>Statut</span>
                              {activeOrder.paid_at ? <Tag color="green">Payé</Tag> : <Tag>Non payé</Tag>}
                            </div>
                            {activeOrder.paid_at ? (
                              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                                {new Date(activeOrder.paid_at).toLocaleString('fr-FR')}
                              </div>
                            ) : null}
                          </Card>

                          <Card size="small" title="Montants">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ fontSize: 12, opacity: 0.75 }}>Total</span>
                              <span style={{ fontWeight: 900, color: '#4f46e5' }}>{Number(activeOrder.total_amount || 0).toLocaleString('fr-FR')} XAF</span>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                              {activeOrder.total_items != null ? `${Number(activeOrder.total_items)} article(s)` : ''}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                              {activeOrderRaw?.currency ? `Devise: ${activeOrderRaw.currency}` : ''}
                            </div>
                          </Card>

                          <Card size="small" title="Statut">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ fontSize: 12, opacity: 0.75 }}>Commande</span>
                              <Tag>{String(activeOrder.status || '—')}</Tag>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                              Créée: {activeOrder.created_at ? new Date(activeOrder.created_at).toLocaleString('fr-FR') : '—'}
                            </div>
                          </Card>
                        </div>

                        <Card size="small" title="Détails paiement / frais" loading={orderRawLoading}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>Méthode</span>
                                <span style={{ fontWeight: 700 }}>{activeOrderRaw?.payment_method ?? '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>Statut paiement</span>
                                <span style={{ fontWeight: 700 }}>{activeOrderRaw?.payment_status ?? '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>Frais livraison</span>
                                <span style={{ fontWeight: 800 }}>{activeOrderRaw?.shipping_fee != null ? `${Number(activeOrderRaw.shipping_fee).toLocaleString('fr-FR')} XAF` : (activeOrderRaw ? '—' : '')}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>Coût livraison</span>
                                <span style={{ fontWeight: 800 }}>{activeOrderRaw?.shipping_cost != null ? `${Number(activeOrderRaw.shipping_cost).toLocaleString('fr-FR')} XAF` : (activeOrderRaw ? '—' : '')}</span>
                              </div>
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>Taxes</span>
                                <span style={{ fontWeight: 800 }}>{activeOrderRaw?.tax_amount != null ? `${Number(activeOrderRaw.tax_amount).toLocaleString('fr-FR')} XAF` : (activeOrderRaw ? '—' : '')}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>Remise</span>
                                <span style={{ fontWeight: 800 }}>{activeOrderRaw?.discount_amount != null ? `${Number(activeOrderRaw.discount_amount).toLocaleString('fr-FR')} XAF` : (activeOrderRaw ? '—' : '')}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>Notes</span>
                                <span style={{ fontSize: 12, opacity: 0.85, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {activeOrderRaw ? (activeOrderRaw?.notes || '—') : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Card size="small" title="Livraison">
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                              {[
                                activeOrder.shipping_district,
                                activeOrder.shipping_city,
                                activeOrder.shipping_country,
                              ].filter(Boolean).join(', ') || '—'}
                            </div>
                            {activeOrder.shipping_address ? (
                              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                                {typeof activeOrder.shipping_address === 'string'
                                  ? activeOrder.shipping_address
                                  : JSON.stringify(activeOrder.shipping_address)}
                              </div>
                            ) : null}
                          </Card>
                          <Card size="small" title="Livreur">
                            <div style={{ fontWeight: 700 }}>{activeOrder.driver_name || '—'}</div>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>{activeOrder.driver_phone || ''}</div>
                            {activeOrderRaw?.delivery_lat != null && activeOrderRaw?.delivery_lng != null ? (
                              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                                GPS: {Number(activeOrderRaw.delivery_lat).toFixed(5)}, {Number(activeOrderRaw.delivery_lng).toFixed(5)}
                                {activeOrderRaw.delivery_accuracy != null ? ` (±${Number(activeOrderRaw.delivery_accuracy).toFixed(0)}m)` : ''}
                                {activeOrderRaw.delivery_captured_at ? ` — ${new Date(activeOrderRaw.delivery_captured_at).toLocaleString('fr-FR')}` : ''}
                              </div>
                            ) : null}
                          </Card>
                        </div>

                        <Card size="small" title="Articles">
                          <Table
                            rowKey={(r: any) => r?.id || r?.order_item_id || r?.product_id || r?.idx || r?.sku || String(r?.product_name || r?.name || '')}
                            size="small"
                            pagination={false}
                            dataSource={(() => {
                              const it = activeOrder.items;
                              if (Array.isArray(it)) return it;
                              if (it && Array.isArray(it.items)) return it.items;
                              if (it && Array.isArray(it.order_items)) return it.order_items;
                              return [];
                            })()}
                            columns={[
                              {
                                title: 'Produit',
                                key: 'p',
                                render: (_v: any, it: any) => {
                                  const name = it?.product_name || it?.name || it?.products?.name || 'Produit';
                                  const img = it?.product_image || it?.image || it?.products?.main_image || it?.products?.image || null;
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      {img ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={img} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} />
                                      ) : (
                                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f3f4f6' }} />
                                      )}
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
                                          {name}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                },
                              },
                              {
                                title: '',
                                key: 'img',
                                width: 48,
                                align: 'center' as const,
                                render: (_v: any, it: any) => {
                                  const img = it?.product_image || it?.image || it?.products?.main_image || it?.products?.image || null;
                                  return (
                                    <Button
                                      size="small"
                                      icon={<EyeOutlined />}
                                      disabled={!img}
                                      onClick={() => {
                                        if (!img) return;
                                        modal.info({
                                          title: it?.product_name || it?.name || it?.products?.name || 'Image produit',
                                          width: 520,
                                          icon: null,
                                          content: (
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={img}
                                                alt=""
                                                style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 12, objectFit: 'contain' }}
                                              />
                                            </div>
                                          ),
                                        });
                                      }}
                                    />
                                  );
                                },
                              },
                              {
                                title: 'Qté',
                                dataIndex: 'quantity',
                                key: 'q',
                                width: 70,
                                align: 'center' as const,
                                render: (v: any) => v ?? '—',
                              },
                              {
                                title: 'Prix',
                                key: 'pr',
                                width: 140,
                                align: 'right' as const,
                                render: (_v: any, it: any) => {
                                  const up = it?.unit_price ?? it?.price;
                                  return up != null ? `${Number(up).toLocaleString('fr-FR')} XAF` : '—';
                                },
                              },
                              {
                                title: 'Total',
                                key: 'tt',
                                width: 140,
                                align: 'right' as const,
                                render: (_v: any, it: any) => {
                                  const total = it?.total_price;
                                  if (total != null) return `${Number(total).toLocaleString('fr-FR')} XAF`;
                                  const q = Number(it?.quantity || 0);
                                  const up = Number(it?.unit_price ?? it?.price ?? 0);
                                  if (q && up) return `${Number(q * up).toLocaleString('fr-FR')} XAF`;
                                  return '—';
                                },
                              },
                            ]}
                            scroll={{ x: 760 }}
                          />
                        </Card>
                      </div>
                    ) : null}
                  </Modal>
                </div>
              ),
            },
            {
              key: 'activity',
              label: 'Activité',
              children: (
                <Spin spinning={activityLoading}>
                  <div className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <Typography.Text type="secondary">Sessions & événements</Typography.Text>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {activityStats.total} activité(s)
                          {activityStats.top.length ? ` — Top: ${activityStats.top.map(([k, c]) => `${k} (${c})`).join(', ')}` : ''}
                        </div>
                      </div>
                      <Button onClick={() => void loadActivity()} disabled={!userId}>Actualiser</Button>
                    </div>

                    <Card size="small" title="Sessions">
                      <Table
                        rowKey="id"
                        size="small"
                        columns={sessionsColumns}
                        dataSource={sessions}
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 900 }}
                      />
                    </Card>

                    <Card size="small" title="Activités">
                      <Table
                        rowKey="id"
                        size="small"
                        columns={activityColumns}
                        dataSource={activities}
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 900 }}
                      />
                    </Card>
                  </div>
                </Spin>
              ),
            },
            {
              key: 'cart',
              label: 'Panier',
              children: (
                <Spin spinning={cartLoading}>
                  <div className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <Typography.Text type="secondary">Articles du panier</Typography.Text>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{cartCount} article(s) — Total: {cartTotal.toLocaleString('fr-FR')} XAF</div>
                      </div>
                      <Space wrap>
                        <Button onClick={() => void loadCart()} disabled={!userId}>Actualiser</Button>
                        <Button
                          danger
                          disabled={!userId || !cartItems.length}
                          onClick={() => {
                            modal.confirm({
                              title: 'Vider le panier',
                              content: 'Supprimer tous les articles du panier ?',
                              okText: 'Vider',
                              cancelText: 'Annuler',
                              onOk: async () => {
                                try {
                                  await clearUserCart(String(userId));
                                  message.success('Panier vidé');
                                  void loadCart();
                                } catch (e: any) {
                                  message.error(e?.message || 'Erreur');
                                }
                              },
                            });
                          }}
                        >
                          Vider
                        </Button>
                      </Space>
                    </div>

                    <Table
                      rowKey="id"
                      columns={cartColumns}
                      dataSource={cartItems}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 900 }}
                    />
                  </div>
                </Spin>
              ),
            },
            {
              key: 'favorites',
              label: 'Favoris',
              children: (
                <Spin spinning={favLoading}>
                  <div className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <Typography.Text type="secondary">Produits favoris ({favorites.length})</Typography.Text>
                      <Button onClick={() => void loadFavorites()} disabled={!userId}>Actualiser</Button>
                    </div>

                    <Table
                      rowKey="id"
                      columns={favoritesColumns}
                      dataSource={favorites}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 900 }}
                    />
                  </div>
                </Spin>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
