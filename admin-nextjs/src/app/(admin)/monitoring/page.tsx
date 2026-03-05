'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { App, Badge, Button, Card, Col, Empty, Input, Row, Space, Spin, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EyeOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { Bar, Pie } from '@ant-design/charts';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '@/components/ui/PageHeader';

type ProfileRow = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null };
type ProductRow = { id: string; name: string; price?: number | null; main_image?: string | null; quantity?: number | null; categories?: { id: string; name: string } | null };

type CartItemRow = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  products?: ProductRow | null;
};

type FavoriteRow = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  products?: ProductRow | null;
};

type CartGroup = {
  userId: string;
  user: ProfileRow | null;
  items: CartItemRow[];
  total: number;
  itemCount: number;
  lastActivity: string;
  kind: 'active' | 'abandoned';
};

function getName(p: ProfileRow | null) {
  if (!p) return 'Utilisateur';
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || p.phone || p.id.slice(0, 8);
}

export default function MonitoringPage() {
  const { message, modal } = App.useApp();
  const [tab, setTab] = useState('carts');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [cartGroups, setCartGroups] = useState<CartGroup[]>([]);
  const [cartSearch, setCartSearch] = useState('');

  const [favoritesTopProducts, setFavoritesTopProducts] = useState<{ name: string; count: number }[]>([]);
  const [favoritesTopProductsVisual, setFavoritesTopProductsVisual] = useState<{ id: string; name: string; count: number; image?: string | null; price?: number | null }[]>([]);
  const [favoritesTopCategories, setFavoritesTopCategories] = useState<{ name: string; count: number }[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesTotal, setFavoritesTotal] = useState(0);

  const [topCartProducts, setTopCartProducts] = useState<{ id: string; name: string; qty: number; image?: string | null; price?: number | null }[]>([]);

  const [productsRows, setProductsRows] = useState<(ProductRow & { cart_count: number; favorite_count: number })[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');

  const clearUserCart = async (userId: string) => {
    try {
      const { error } = await supabase.from('cart_items').delete().eq('user_id', userId);
      if (error) throw error;
      message.success('Panier vidé');
      await loadCarts();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    }
  };

  const deleteCartItem = async (id: string) => {
    try {
      const { error } = await supabase.from('cart_items').delete().eq('id', id);
      if (error) throw error;
      message.success('Article supprimé');
      await loadCarts();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    }
  };

  const loadCarts = async () => {
    setLoading(true);
    try {
      const { data: cartItems, error: cartErr } = await supabase
        .from('cart_items')
        .select('id, user_id, product_id, quantity, created_at, products(id,name,price,main_image,quantity,categories(id,name))')
        .order('created_at', { ascending: false });
      if (cartErr) throw cartErr;

      const userIds = [...new Set((cartItems || []).map((i: any) => i.user_id).filter(Boolean))] as string[];
      const profileMap: Record<string, ProfileRow> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .in('id', userIds);
        (profs || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }

      const groups: Record<string, CartGroup> = {};
      const prodAgg: Record<string, { id: string; name: string; qty: number; image?: string | null; price?: number | null }> = {};
      (cartItems || []).forEach((item: any) => {
        const u = item.user_id;
        if (!u) return;
        if (!groups[u]) {
          groups[u] = {
            userId: u,
            user: profileMap[u] || null,
            items: [],
            total: 0,
            itemCount: 0,
            lastActivity: item.created_at,
            kind: 'active',
          };
        }
        groups[u].items.push(item);
        groups[u].total += Number(item.products?.price || 0) * Number(item.quantity || 0);
        groups[u].itemCount += Number(item.quantity || 0);

        const pid = item.product_id || item.products?.id;
        if (pid) {
          if (!prodAgg[pid]) {
            prodAgg[pid] = {
              id: pid,
              name: item.products?.name || 'Produit',
              qty: 0,
              image: item.products?.main_image || null,
              price: item.products?.price ?? null,
            };
          }
          prodAgg[pid].qty += Number(item.quantity || 0);
        }
      });

      const now = Date.now();
      const out: CartGroup[] = Object.values(groups).map((g) => {
        const hours = (now - new Date(g.lastActivity).getTime()) / (1000 * 60 * 60);
        const kind: CartGroup['kind'] = hours < 24 ? 'active' : 'abandoned';
        return { ...g, kind };
      });
      setCartGroups(out.sort((a, b) => +new Date(b.lastActivity) - +new Date(a.lastActivity)));
      setTopCartProducts(Object.values(prodAgg).sort((a, b) => b.qty - a.qty).slice(0, 6));
    } catch (e: any) {
      message.error(e?.message || 'Erreur monitoring paniers');
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const { data: favs, error } = await supabase
        .from('favorites')
        .select('id, user_id, product_id, created_at, products(id,name,price,main_image,categories(id,name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (favs || []) as any as FavoriteRow[];
      setFavoritesTotal(rows.length);

      const prodCounts: Record<string, { name: string; count: number }> = {};
      const prodVisual: Record<string, { id: string; name: string; count: number; image?: string | null; price?: number | null }> = {};
      const catCounts: Record<string, { name: string; count: number }> = {};
      rows.forEach((f: any) => {
        const p = f.products;
        const pname = p?.name || 'Produit';
        const pid = f.product_id || p?.id || pname;
        if (!prodCounts[pid]) prodCounts[pid] = { name: pname, count: 0 };
        prodCounts[pid].count += 1;

        if (!prodVisual[pid]) {
          prodVisual[pid] = {
            id: String(pid),
            name: pname,
            count: 0,
            image: p?.main_image || null,
            price: p?.price ?? null,
          };
        }
        prodVisual[pid].count += 1;

        const cname = p?.categories?.name || 'Non catégorisé';
        if (!catCounts[cname]) catCounts[cname] = { name: cname, count: 0 };
        catCounts[cname].count += 1;
      });

      setFavoritesTopProducts(Object.values(prodCounts).sort((a, b) => b.count - a.count).slice(0, 10));
      setFavoritesTopCategories(Object.values(catCounts).sort((a, b) => b.count - a.count).slice(0, 8));
      setFavoritesTopProductsVisual(Object.values(prodVisual).sort((a, b) => b.count - a.count).slice(0, 12));
    } catch (e: any) {
      message.error(e?.message || 'Erreur monitoring favoris');
    } finally {
      setFavoritesLoading(false);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const { data: prods, error } = await supabase
        .from('products')
        .select('id,name,price,quantity,main_image,categories(id,name),cart_items(quantity),favorites(id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const processed = (prods || []).map((p: any) => ({
        ...p,
        cart_count: (p.cart_items || []).reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0),
        favorite_count: (p.favorites || []).length,
      }));
      setProductsRows(processed);
    } catch (e: any) {
      message.error(e?.message || 'Erreur monitoring produits');
    } finally {
      setProductsLoading(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCarts(), loadFavorites(), loadProducts()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    const ch = supabase
      .channel('monitoring-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items' }, () => void loadCarts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites' }, () => void loadFavorites())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void loadProducts())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const cartStats = useMemo(() => {
    const total = cartGroups.length;
    const active = cartGroups.filter((g) => g.kind === 'active').length;
    const abandoned = cartGroups.filter((g) => g.kind === 'abandoned').length;
    const totalValue = cartGroups.reduce((s, g) => s + g.total, 0);
    const avgValue = total ? totalValue / total : 0;
    return { total, active, abandoned, totalValue, avgValue };
  }, [cartGroups]);

  const globalStats = useMemo(() => {
    const productsTotal = productsRows.length;
    const cartItemsTotal = cartGroups.reduce((s, g) => s + g.itemCount, 0);
    const cartsValue = cartGroups.reduce((s, g) => s + g.total, 0);
    const favorites = favoritesTotal;
    const topFav = favoritesTopProducts[0]?.name || '—';
    return { productsTotal, cartItemsTotal, cartsValue, favorites, topFav };
  }, [productsRows.length, cartGroups, favoritesTotal, favoritesTopProducts]);

  const filteredCartGroups = useMemo(() => {
    if (!cartSearch.trim()) return cartGroups;
    const s = cartSearch.trim().toLowerCase();
    return cartGroups.filter((g) => {
      const name = getName(g.user).toLowerCase();
      const email = (g.user?.email || '').toLowerCase();
      const phone = (g.user?.phone || '').toLowerCase();
      return name.includes(s) || email.includes(s) || phone.includes(s);
    });
  }, [cartGroups, cartSearch]);

  const cartsColumns: ColumnsType<CartGroup> = [
    {
      title: 'Utilisateur',
      key: 'user',
      render: (_v, r) => (
        <div style={{ maxWidth: 260 }}>
          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getName(r.user)}</div>
          <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.user?.email || r.user?.phone || ''}</div>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      align: 'right',
      render: (_v, r) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<UserOutlined />}
            onClick={() => {
              window.location.href = `/users/${r.userId}`;
            }}
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => {
              modal.confirm({
                title: 'Vider le panier',
                content: `Vider le panier de ${getName(r.user)} ?`,
                okText: 'Vider',
                cancelText: 'Annuler',
                onOk: async () => {
                  await clearUserCart(r.userId);
                },
              });
            }}
          />
        </Space>
      ),
      responsive: ['md'],
    },
    {
      title: 'Type',
      key: 'kind',
      width: 120,
      render: (_v, r) => (r.kind === 'active' ? <Tag color="green">Actif</Tag> : <Tag color="gold">Abandonné</Tag>),
    },
    {
      title: 'Articles',
      key: 'items',
      width: 110,
      align: 'center',
      render: (_v, r) => <Badge count={r.itemCount} showZero />,
    },
    {
      title: 'Total',
      key: 'total',
      align: 'right',
      width: 140,
      render: (_v, r) => <span style={{ fontWeight: 800, color: '#4f46e5' }}>{r.total.toFixed(0)} FCFA</span>,
    },
    {
      title: 'Dernière activité',
      key: 'last',
      width: 160,
      render: (_v, r) => <span style={{ fontSize: 12, opacity: 0.75 }}>{new Date(r.lastActivity).toLocaleString('fr-FR')}</span>,
    },
  ];

  const favoritesBarConfig = useMemo(() => ({
    data: favoritesTopProducts,
    xField: 'count',
    yField: 'name',
    seriesField: 'name',
    legend: false,
    height: 320,
    color: '#4f46e5',
  }), [favoritesTopProducts]);

  const favoritesPieConfig = useMemo(() => ({
    data: favoritesTopCategories,
    angleField: 'count',
    colorField: 'name',
    radius: 0.9,
    height: 320,
    label: { type: 'outer' as const, content: '{name}' },
  }), [favoritesTopCategories]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productsRows;
    const s = productSearch.trim().toLowerCase();
    return productsRows.filter((p) => p.name.toLowerCase().includes(s));
  }, [productsRows, productSearch]);

  const productsStats = useMemo(() => {
    const total = productsRows.length;
    const lowStock = productsRows.filter((p) => Number(p.quantity || 0) <= 20 && Number(p.quantity || 0) > 0).length;
    const outOfStock = productsRows.filter((p) => Number(p.quantity || 0) === 0).length;
    const avgPrice = total ? productsRows.reduce((s, p) => s + Number(p.price || 0), 0) / total : 0;
    return { total, lowStock, outOfStock, avgPrice };
  }, [productsRows]);

  const productsColumns: ColumnsType<any> = [
    {
      title: 'Produit',
      key: 'name',
      render: (_v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.main_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.main_image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{r.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{r.categories?.name || 'Non catégorisé'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Stock',
      key: 'stock',
      width: 110,
      align: 'center',
      render: (_v, r) => {
        const q = Number(r.quantity || 0);
        const color = q > 20 ? 'green' : q > 0 ? 'gold' : 'red';
        return <Tag color={color}>{q}</Tag>;
      },
    },
    {
      title: 'Dans paniers',
      key: 'cart_count',
      width: 130,
      align: 'center',
      render: (_v, r) => <Badge count={r.cart_count} showZero />,
    },
    {
      title: 'Favoris',
      key: 'favorite_count',
      width: 110,
      align: 'center',
      render: (_v, r) => <Badge count={r.favorite_count} showZero />,
    },
    {
      title: 'Prix',
      key: 'price',
      width: 140,
      align: 'right',
      render: (_v, r) => <span style={{ fontWeight: 800, color: '#4f46e5' }}>{Number(r.price || 0).toFixed(0)} FCFA</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring"
        subtitle="Surveillance en temps réel"
        extra={
          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void refreshAll()}>
            Actualiser
          </Button>
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <Card>
            <div className="text-xs text-gray-500">Valeur paniers</div>
            <div className="text-2xl font-extrabold text-indigo-600">{globalStats.cartsValue.toFixed(0)} FCFA</div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <div className="text-xs text-gray-500">Articles en panier</div>
            <div className="text-2xl font-extrabold">{globalStats.cartItemsTotal}</div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <div className="text-xs text-gray-500">Favoris</div>
            <div className="text-2xl font-extrabold">{globalStats.favorites}</div>
            <div className="text-xs text-gray-500 mt-1">Top: {globalStats.topFav}</div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <div className="text-xs text-gray-500">Produits</div>
            <div className="text-2xl font-extrabold">{globalStats.productsTotal}</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card title="Top produits dans les paniers" extra={<Tag color="blue">Realtime</Tag>}>
            {loading ? (
              <div className="py-8 flex justify-center"><Spin /></div>
            ) : topCartProducts.length ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {topCartProducts.map((p) => (
                  <div key={p.id} style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f3f4f6' }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Qté: <strong>{p.qty}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary">Aucun produit dans les paniers</Typography.Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Top produits en favoris" extra={<Tag color="blue">Realtime</Tag>}>
            {favoritesLoading ? (
              <div className="py-8 flex justify-center"><Spin /></div>
            ) : favoritesTopProductsVisual.length ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {favoritesTopProductsVisual.slice(0, 6).map((p) => (
                  <div key={p.id} style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f3f4f6' }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Favoris: <strong>{p.count}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary">Aucun favori</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'carts',
              label: 'Paniers',
              children: (
                <div className="space-y-3">
                  <Row gutter={[12, 12]}>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Total paniers</div><div className="text-2xl font-extrabold">{cartStats.total}</div></Card>
                    </Col>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Actifs</div><div className="text-2xl font-extrabold">{cartStats.active}</div></Card>
                    </Col>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Abandonnés</div><div className="text-2xl font-extrabold">{cartStats.abandoned}</div></Card>
                    </Col>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Panier moyen</div><div className="text-2xl font-extrabold">{cartStats.avgValue.toFixed(0)} FCFA</div></Card>
                    </Col>
                  </Row>

                  <Card>
                    <Space vertical style={{ width: '100%' }} size={10}>
                      <Input placeholder="Rechercher (nom, email, téléphone)" value={cartSearch} onChange={(e) => setCartSearch(e.target.value)} allowClear />
                      <Table
                        rowKey="userId"
                        loading={loading}
                        columns={cartsColumns}
                        dataSource={filteredCartGroups}
                        pagination={{ pageSize: 15 }}
                        scroll={{ x: 900 }}
                        expandable={{
                          expandedRowRender: (r) => (
                            <Table
                              rowKey="id"
                              size="small"
                              pagination={false}
                              dataSource={r.items}
                              columns={[
                                {
                                  title: 'Produit',
                                  key: 'p',
                                  render: (_v: any, it: any) => (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      {it.products?.main_image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={it.products.main_image} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} />
                                      ) : (
                                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f3f4f6' }} />
                                      )}
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>{it.products?.name || 'Produit'}</div>
                                        <div style={{ fontSize: 12, opacity: 0.7 }}>{it.product_id?.slice(0, 8)}</div>
                                      </div>
                                    </div>
                                  ),
                                },
                                {
                                  title: '',
                                  key: 'img',
                                  width: 54,
                                  align: 'center',
                                  render: (_v: any, it: any) => (
                                    <Button
                                      size="small"
                                      icon={<EyeOutlined />}
                                      disabled={!it.products?.main_image}
                                      onClick={() => {
                                        const img = it.products?.main_image;
                                        if (!img) return;
                                        modal.info({
                                          title: it.products?.name || 'Image produit',
                                          width: 520,
                                          icon: null,
                                          content: (
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={img} alt="" style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 12, objectFit: 'contain' }} />
                                            </div>
                                          ),
                                        });
                                      }}
                                    />
                                  ),
                                },
                                { title: 'Qté', dataIndex: 'quantity', key: 'q', width: 80, align: 'center' },
                                { title: 'Prix', key: 'pr', width: 140, align: 'right', render: (_v, it: any) => `${Number(it.products?.price || 0).toFixed(0)} FCFA` },
                                { title: 'Sous-total', key: 'st', width: 140, align: 'right', render: (_v, it: any) => `${(Number(it.products?.price || 0) * Number(it.quantity || 0)).toFixed(0)} FCFA` },
                                {
                                  title: 'Suppr.',
                                  key: 'del',
                                  width: 90,
                                  align: 'center',
                                  render: (_v: any, it: any) => (
                                    <Button
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      onClick={() => {
                                        modal.confirm({
                                          title: 'Supprimer du panier',
                                          content: 'Supprimer cet article ?',
                                          okText: 'Supprimer',
                                          cancelText: 'Annuler',
                                          onOk: async () => {
                                            await deleteCartItem(it.id);
                                          },
                                        });
                                      }}
                                    />
                                  ),
                                },
                              ]}
                            />
                          ),
                        }}
                      />
                    </Space>
                  </Card>
                </div>
              ),
            },
            {
              key: 'favorites',
              label: 'Favoris',
              children: (
                <div className="space-y-3">
                  <Row gutter={[12, 12]}>
                    <Col xs={24} lg={12}>
                      <Card title="Top produits" extra={<Tag color="blue">Realtime</Tag>}>
                        {favoritesLoading ? <div className="py-10 flex justify-center"><Spin /></div> : <Bar {...favoritesBarConfig} />}
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="Répartition par catégorie" extra={<Tag color="blue">Realtime</Tag>}>
                        {favoritesLoading ? <div className="py-10 flex justify-center"><Spin /></div> : <Pie {...favoritesPieConfig} />}
                      </Card>
                    </Col>
                  </Row>

                  <Card title="Top produits (visuel)">
                    {favoritesLoading ? (
                      <div className="py-10 flex justify-center"><Spin /></div>
                    ) : favoritesTopProductsVisual.length ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {favoritesTopProductsVisual.map((p) => (
                          <div key={p.id} style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ height: 120, background: '#f3f4f6' }}>
                              {p.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.image} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                              ) : null}
                            </div>
                            <div style={{ padding: 10 }}>
                              <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Favoris: <strong>{p.count}</strong></div>
                              {p.price != null ? <div style={{ fontSize: 12, fontWeight: 800, color: '#4f46e5', marginTop: 2 }}>{Number(p.price).toFixed(0)} FCFA</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty description="Aucun favori" />
                    )}
                  </Card>
                </div>
              ),
            },
            {
              key: 'products',
              label: 'Produits',
              children: (
                <div className="space-y-3">
                  <Row gutter={[12, 12]}>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Total produits</div><div className="text-2xl font-extrabold">{productsStats.total}</div></Card>
                    </Col>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Stock faible</div><div className="text-2xl font-extrabold">{productsStats.lowStock}</div></Card>
                    </Col>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Rupture</div><div className="text-2xl font-extrabold">{productsStats.outOfStock}</div></Card>
                    </Col>
                    <Col xs={12} lg={6}>
                      <Card><div className="text-xs text-gray-500">Prix moyen</div><div className="text-2xl font-extrabold">{productsStats.avgPrice.toFixed(0)} FCFA</div></Card>
                    </Col>
                  </Row>

                  <Card>
                    <Space vertical style={{ width: '100%' }} size={10}>
                      <Input placeholder="Rechercher un produit" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} allowClear />
                      <Table
                        rowKey="id"
                        loading={productsLoading}
                        columns={productsColumns}
                        dataSource={filteredProducts}
                        pagination={{ pageSize: 15 }}
                        scroll={{ x: 900 }}
                      />
                    </Space>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
