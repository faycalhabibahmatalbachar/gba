'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Avatar, Badge, Button, Card, Col, Divider, Drawer, Empty, Image, Input, Row, Segmented, Select, Skeleton, Space, Statistic, Steps, Table, Tag, Tooltip, Typography } from 'antd';
import { ArrowUpOutlined, EyeOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase/client';
import EmptyState from '@/components/ui/EmptyState';
import { translateOrderStatus, translatePaymentMethod } from '@/lib/i18n/translations';

const Line = dynamic(() => import('@ant-design/charts').then((m) => m.Line), { ssr: false });
const Bar = dynamic(() => import('@ant-design/charts').then((m) => m.Bar), { ssr: false });
const Column = dynamic(() => import('@ant-design/charts').then((m) => m.Column), { ssr: false });
const Pie = dynamic(() => import('@ant-design/charts').then((m) => m.Pie), { ssr: false });

type PeriodKey = '24h' | '7d' | '30d';

async function updateOrderWithFallback(orderId: string, patch: Record<string, any>) {
  const r1 = await supabase.from('orders').update(patch).eq('id', orderId);
  if (!r1.error) return r1;

  const msg = String((r1.error as any)?.message || '').toLowerCase();
  const isSchemaCache = msg.includes('schema cache') || msg.includes('could not find');
  const isMissingColumn = msg.includes('does not exist') || msg.includes('column');
  if (isSchemaCache || isMissingColumn) {
    const safe: Record<string, any> = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'status')) safe.status = patch.status;
    if (Object.prototype.hasOwnProperty.call(patch, 'driver_id')) safe.driver_id = patch.driver_id;
    return await supabase.from('orders').update(safe).eq('id', orderId);
  }

  return r1;
}

type DashboardKpis = {
  totalOrders: number;
  pending: number;
  inProgress: number;
  delivered: number;
  cancelled: number;
  revenue: number;
  stockoutRate: number;
  outOfStockCount: number;
  totalProducts: number;
};

type RecentOrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  status: string | null;
  total_amount: number | null;
  customer_name?: string | null;
};

type DrawerOrderItemRow = {
  id?: string;
  product_id?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
};

type DriverOption = { value: string; label: string };

type TopRow = {
  key: string;
  productId?: string;
  label: string;
  imageUrl?: string | null;
  qty: number;
  amount: number;
  shareQty: number;
  shareAmount: number;
};

type FunnelRow = {
  step: string;
  sessions: number;
};

type AlertItem = { title: string; detail: string; severity: 'high' | 'medium' | 'low' };

type SearchTopRow = { term: string; count: number };

type OrdersSeriesPoint = {
  date: string;
  orders: number;
};

type RevenueSeriesPoint = {
  date: string;
  revenue: number;
};

type PrevKpis = {
  totalOrders: number;
  revenue: number;
  delivered: number;
  pending: number;
};

type OutOfStockProduct = { id: string; name: string | null };

type ProductDetailsRow = {
  id: string;
  name: string | null;
  sku?: string | null;
  price?: number | null;
  quantity?: number | null;
  main_image?: string | null;
  images?: string[] | null;
  description?: string | null;
  categories?: { id: string; name: string } | { id: string; name: string }[] | null;
};

const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'processing', label: 'En cours' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
];

function statusTag(status?: string | null) {
  const s = String(status || '').toLowerCase();
  const map: Record<string, { color: string; bg: string; label: string }> = {
    pending:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  label: 'En attente' },
    confirmed:  { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  label: 'Confirmée' },
    processing: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)',  label: 'En cours' },
    shipped:    { color: '#14B8A6', bg: 'rgba(20,184,166,0.10)',  label: 'Expédiée' },
    delivered:  { color: '#10B981', bg: 'rgba(16,185,129,0.10)',  label: 'Livrée' },
    cancelled:  { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   label: 'Annulée' },
  };
  const v = map[s] || { color: 'var(--text-3)', bg: 'var(--bg-hover)', label: status || '—' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
      color: v.color, backgroundColor: v.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.color }} />
      {v.label}
    </span>
  );
}

function periodToRange(period: PeriodKey) {
  const now = dayjs();
  if (period === '24h') return { dateFrom: now.subtract(24, 'hour').toISOString(), dateTo: now.toISOString() };
  if (period === '30d') return { dateFrom: now.subtract(30, 'day').toISOString(), dateTo: now.toISOString() };
  return { dateFrom: now.subtract(7, 'day').toISOString(), dateTo: now.toISOString() };
}

function prevPeriodRange(period: PeriodKey) {
  const now = dayjs();
  if (period === '24h') return { dateFrom: now.subtract(48, 'hour').toISOString(), dateTo: now.subtract(24, 'hour').toISOString() };
  if (period === '30d') return { dateFrom: now.subtract(60, 'day').toISOString(), dateTo: now.subtract(30, 'day').toISOString() };
  return { dateFrom: now.subtract(14, 'day').toISOString(), dateTo: now.subtract(7, 'day').toISOString() };
}

type OrderStatusFilter = 'all' | 'pending' | 'inProgress' | 'delivered' | 'cancelled';

function matchesStatusFilter(o: RecentOrderRow, f: OrderStatusFilter) {
  if (f === 'all') return true;
  const s = String(o.status || '').toLowerCase();
  if (f === 'pending') return s === 'pending';
  if (f === 'delivered') return s === 'delivered';
  if (f === 'cancelled') return s === 'cancelled';
  return ['confirmed', 'processing', 'shipped'].includes(s);
}

function relativeTime(iso: string): string {
  const d = dayjs(iso);
  const minutes = dayjs().diff(d, 'minute');
  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = dayjs().diff(d, 'hour');
  if (hours < 24) return `Il y a ${hours}h`;
  const days = dayjs().diff(d, 'day');
  if (days < 7) return `Il y a ${days}j`;
  return d.format('DD/MM HH:mm');
}

function MiniSparkline({ data, color = '#4f46e5', height = 36 }: { data: { date: string; orders?: number; revenue?: number }[]; color?: string; height?: number }) {
  const values = data.map((d) => d.orders ?? d.revenue ?? 0);
  const max = Math.max(1, ...values);
  const w = 80;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * w;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  if (values.length === 0) return <div style={{ height, width: w }} className="opacity-50" />;
  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} opacity={0.9} />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>('7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<RecentOrderRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerItems, setDrawerItems] = useState<DrawerOrderItemRow[]>([]);
  const [drawerOrderDetails, setDrawerOrderDetails] = useState<any | null>(null);
  const [drawerActionLoading, setDrawerActionLoading] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis>({
    totalOrders: 0,
    pending: 0,
    inProgress: 0,
    delivered: 0,
    cancelled: 0,
    revenue: 0,
    stockoutRate: 0,
    outOfStockCount: 0,
    totalProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopRow[]>([]);
  const [topCategories, setTopCategories] = useState<TopRow[]>([]);
  const [hideUncategorized, setHideUncategorized] = useState(true);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [ordersSeries, setOrdersSeries] = useState<OrdersSeriesPoint[]>([]);

  const [productOpen, setProductOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [productRow, setProductRow] = useState<ProductDetailsRow | null>(null);

  const range = useMemo(() => periodToRange(period), [period]);
  const refreshTimer = useRef<any>(null);
  const refreshSeq = useRef(0);
  const recentOrdersRef = useRef<HTMLDivElement | null>(null);

  const viewSupportsDeliveryTimestamps = useRef<boolean | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [topSearches, setTopSearches] = useState<SearchTopRow[]>([]);
  const [checkoutAbandoned, setCheckoutAbandoned] = useState(0);
  const [prevKpis, setPrevKpis] = useState<PrevKpis>({ totalOrders: 0, revenue: 0, delivered: 0, pending: 0 });
  const [revenueSeries, setRevenueSeries] = useState<RevenueSeriesPoint[]>([]);
  const [pendingSeries, setPendingSeries] = useState<OrdersSeriesPoint[]>([]);
  const [deliveredSeries, setDeliveredSeries] = useState<OrdersSeriesPoint[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<OutOfStockProduct[]>([]);

  const refresh = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const seq = ++refreshSeq.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { dateFrom, dateTo } = range;
      const prevRange = prevPeriodRange(period);

      const [
        { data: orders, error: ordersErr },
        { data: prods, error: prodsErr },
        { data: prevOrders },
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, created_at, total_amount, paid_at, customer_name')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase.from('products').select('id, name, quantity, price, category_id, categories(name), main_image, images').limit(5000),
        supabase
          .from('orders')
          .select('id, status, created_at, total_amount, paid_at')
          .gte('created_at', prevRange.dateFrom)
          .lte('created_at', prevRange.dateTo)
          .limit(2000),
      ]);
      if (ordersErr) throw ordersErr;
      if (prodsErr) throw prodsErr;

      if (seq !== refreshSeq.current) return;

      const orderRows = (orders || []) as any[];
      const productRows = (prods || []) as any[];
      const prevOrderRows = (prevOrders || []) as any[];

      const totalOrders = orderRows.length;
      const pending = orderRows.filter((r) => String(r.status || '').toLowerCase() === 'pending').length;
      const inProgress = orderRows.filter((r) => ['confirmed', 'processing', 'shipped'].includes(String(r.status || '').toLowerCase())).length;
      const delivered = orderRows.filter((r) => String(r.status || '').toLowerCase() === 'delivered').length;
      const cancelled = orderRows.filter((r) => String(r.status || '').toLowerCase() === 'cancelled').length;
      const revenue = orderRows.reduce((s, r) => {
        const isPaid = r.paid_at != null || String(r.status || '').toLowerCase() === 'delivered';
        if (!isPaid) return s;
        return s + Number(r.total_amount || 0);
      }, 0);

      const totalProducts = productRows.length;
      const outOfStockCount = productRows.filter((p) => {
        const q = p.quantity;
        return Number(q ?? 0) <= 0;
      }).length;
      const stockoutRate = totalProducts ? outOfStockCount / totalProducts : 0;

      setKpis({
        totalOrders,
        pending,
        inProgress,
        delivered,
        cancelled,
        revenue,
        stockoutRate,
        outOfStockCount,
        totalProducts,
      });

      setRecentOrders(
        orderRows.slice(0, 8).map((o) => ({
          id: o.id,
          order_number: o.order_number ?? null,
          created_at: o.created_at,
          status: o.status ?? null,
          total_amount: o.total_amount ?? null,
          customer_name: o.customer_name ?? null,
        })),
      );

      const dayBucket: Record<string, number> = {};
      const revenueByDay: Record<string, number> = {};
      const pendingByDay: Record<string, number> = {};
      const deliveredByDay: Record<string, number> = {};
      for (const o of orderRows) {
        const d = dayjs(o.created_at).format('YYYY-MM-DD');
        const s = String(o.status || '').toLowerCase();
        dayBucket[d] = (dayBucket[d] || 0) + 1;
        if (s === 'pending') pendingByDay[d] = (pendingByDay[d] || 0) + 1;
        if (s === 'delivered') deliveredByDay[d] = (deliveredByDay[d] || 0) + 1;
        const isPaid = o.paid_at != null || s === 'delivered';
        if (isPaid) revenueByDay[d] = (revenueByDay[d] || 0) + Number(o.total_amount || 0);
      }
      const series = Object.entries(dayBucket)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, ordersCount]) => ({ date, orders: ordersCount }));
      setOrdersSeries(series);
      const revSeries = Object.entries(revenueByDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, revenue]) => ({ date, revenue }));
      setRevenueSeries(revSeries);
      setPendingSeries(Object.entries(pendingByDay).sort((a, b) => a[0].localeCompare(b[0])).map(([date, orders]) => ({ date, orders })));
      setDeliveredSeries(Object.entries(deliveredByDay).sort((a, b) => a[0].localeCompare(b[0])).map(([date, orders]) => ({ date, orders })));

      const prevTotal = prevOrderRows.length;
      const prevRev = prevOrderRows.reduce((s, r) => {
        const isPaid = r.paid_at != null || String(r.status || '').toLowerCase() === 'delivered';
        return isPaid ? s + Number(r.total_amount || 0) : s;
      }, 0);
      const prevDelivered = prevOrderRows.filter((r) => String(r.status || '').toLowerCase() === 'delivered').length;
      const prevPending = prevOrderRows.filter((r) => String(r.status || '').toLowerCase() === 'pending').length;
      setPrevKpis({ totalOrders: prevTotal, revenue: prevRev, delivered: prevDelivered, pending: prevPending });

      const outOfStock = productRows
        .filter((p: any) => Number(p.quantity ?? 0) <= 0)
        .map((p: any) => ({ id: p.id, name: p.name ?? null }));
      setOutOfStockProducts(outOfStock);

      const orderIds = orderRows.map((o) => o.id);
      const { data: items, error: itemsErr } = orderIds.length
        ? await supabase
            .from('order_items')
            .select('order_id, product_id, product_name, quantity, unit_price')
            .in('order_id', orderIds)
            .limit(20000)
        : { data: [], error: null };
      if (itemsErr) throw itemsErr;

      const productMap: Record<string, any> = {};
      for (const p of productRows) productMap[p.id] = p;

      const byProd: Record<string, { qty: number; amount: number; label?: string }> = {};
      const byCat: Record<string, { qty: number; amount: number; label: string }> = {};

      for (const it of (items || []) as any[]) {
        const pid = String(it.product_id);
        const qty = Number(it.quantity || 0);
        const prod = productMap[pid];
        const unit = it.unit_price != null ? Number(it.unit_price) : Number(prod?.price || 0);
        const amount = qty * unit;

        byProd[pid] = byProd[pid] || { qty: 0, amount: 0, label: it.product_name || undefined };
        byProd[pid].qty += qty;
        byProd[pid].amount += amount;
        if (!byProd[pid].label && it.product_name) byProd[pid].label = it.product_name;

        const catId = prod?.category_id ? String(prod.category_id) : 'uncategorized';
        const catName = (Array.isArray(prod?.categories) ? prod.categories?.[0]?.name : prod?.categories?.name) || 'Sans catégorie';
        byCat[catId] = byCat[catId] || { qty: 0, amount: 0, label: catName };
        byCat[catId].qty += qty;
        byCat[catId].amount += amount;
      }

      const totalQtyAll = Object.values(byProd).reduce((s, v) => s + Number(v.qty || 0), 0);
      const totalAmountAll = Object.values(byProd).reduce((s, v) => s + Number(v.amount || 0), 0);

      const topProdRows: TopRow[] = Object.entries(byProd)
        .map(([pid, v]) => {
          const label = v.label || productMap[pid]?.name || pid.slice(0, 8);
          const p = productMap[pid];
          const images = p?.images;
          const firstImage = Array.isArray(images) ? images?.[0] : null;
          const imageUrl = (p?.main_image ?? firstImage ?? null) as string | null;
          const shareQty = totalQtyAll ? v.qty / totalQtyAll : 0;
          const shareAmount = totalAmountAll ? v.amount / totalAmountAll : 0;
          return { key: pid, productId: pid, label, imageUrl, qty: v.qty, amount: v.amount, shareQty, shareAmount };
        })
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8);
      setTopProducts(topProdRows);

      const totalCatQtyAll = Object.values(byCat).reduce((s, v) => s + Number(v.qty || 0), 0);
      const totalCatAmountAll = Object.values(byCat).reduce((s, v) => s + Number(v.amount || 0), 0);

      const topCatRows: TopRow[] = Object.entries(byCat)
        .map(([cid, v]) => {
          const shareQty = totalCatQtyAll ? v.qty / totalCatQtyAll : 0;
          const shareAmount = totalCatAmountAll ? v.amount / totalCatAmountAll : 0;
          return { key: cid, label: v.label, qty: v.qty, amount: v.amount, shareQty, shareAmount };
        })
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8);
      setTopCategories(topCatRows);

      const { data: acts, error: actsErr } = await supabase
        .from('user_activities')
        .select('id, session_id, action_type, page_name, action_details, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .limit(50000);
      if (actsErr) throw actsErr;

      const rows = (acts || []) as any[];
      const normalize = (s: any) => String(s || '').toLowerCase();

      const visits = new Set<string>();
      const carts = new Set<string>();
      const checkouts = new Set<string>();
      const purchases = new Set<string>();

      for (const a of rows) {
        const sid = a.session_id ? String(a.session_id) : null;
        if (!sid) continue;
        const t = normalize(a.action_type);
        const page = normalize(a.page_name);

        const isVisit = t === 'product_view' || t === 'category_view' || t === 'search' || t === 'app_opened' || ['home', 'product', 'catalog', 'search'].includes(page);
        if (isVisit) visits.add(sid);

        if (t === 'cart_add') carts.add(sid);
        if (t === 'checkout_started') checkouts.add(sid);
        if (t === 'payment_completed' || t === 'order_placed') purchases.add(sid);
      }

      setFunnel([
        { step: 'Visite', sessions: visits.size },
        { step: 'Panier', sessions: carts.size },
        { step: 'Checkout', sessions: checkouts.size },
        { step: 'Achat', sessions: purchases.size },
      ]);

      const searchCount: Record<string, number> = {};
      let abandoned = 0;
      for (const a of rows) {
        const t = normalize(a.action_type);
        if (t === 'checkout_abandoned') abandoned += 1;
        if (t === 'search') {
          const d: any = a.action_details || {};
          const term = String(d.query ?? d.q ?? d.term ?? '').trim();
          if (!term) continue;
          const cleaned = term.replace(/\s+/g, ' ').trim();
          if (cleaned.length < 3) continue;
          const k = cleaned.toLowerCase();
          searchCount[k] = (searchCount[k] || 0) + 1;
        }
      }
      const top = Object.entries(searchCount)
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setTopSearches(top);
      setCheckoutAbandoned(abandoned);

      const nowIso = new Date().toISOString();
      const stalePendingCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const oldPending = orderRows.filter((r) => String(r.status || '').toLowerCase() === 'pending' && String(r.created_at) < stalePendingCutoff).length;
      const outStock = outOfStockCount;
      const nextAlerts: AlertItem[] = [];
      if (oldPending > 0) nextAlerts.push({ title: 'Commandes en attente', detail: `${oldPending} > 2h`, severity: 'high' });
      if (outStock > 0) nextAlerts.push({ title: 'Ruptures de stock', detail: `${outStock} produit(s)`, severity: 'high' });
      if (abandoned > 0) nextAlerts.push({ title: 'Checkout abandonné', detail: `${abandoned} événement(s)`, severity: 'medium' });
      if (!nextAlerts.length) nextAlerts.push({ title: 'Tout est OK', detail: `Dernière mise à jour ${dayjs(nowIso).format('HH:mm')}`, severity: 'low' });
      setAlerts(nextAlerts);

      setLastUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      if (seq !== refreshSeq.current) return;
      const msg = e?.message || 'Erreur lors du chargement du dashboard';
      setError(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    setOrderStatusFilter('all');
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    const debounceRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => refresh({ silent: true }), 500);
    };

    const ch = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, debounceRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debounceRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, debounceRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activities' }, debounceRefresh)
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const ordersChartConfig = useMemo(() => {
    return {
      data: ordersSeries.length ? ordersSeries : [{ date: dayjs().format('YYYY-MM-DD'), orders: 0 }],
      xField: 'date',
      yField: 'orders',
      height: 260,
      smooth: true,
      point: { size: 4, shape: 'circle' },
      area: true,
      style: { fill: 'linear-gradient(90deg, rgba(79,70,229,0.25) 0%, rgba(79,70,229,0.02) 100%)', lineWidth: 2 },
      tooltip: { channel: 'y', valueFormatter: (v: number) => `${v} commandes` },
      axis: { x: { labelFormatter: (v: string) => dayjs(v).format('DD/MM') } },
    } as any;
  }, [ordersSeries]);

  const funnelChartConfig = useMemo(() => {
    const chartData = funnel.length ? funnel.map(f => ({ type: f.step, value: f.sessions })) : [{ type: '—', value: 0 }];
    return {
      data: chartData,
      xField: 'type',
      yField: 'value',
      height: 260,
      legend: false,
      colorField: 'type',
      style: { radius: [6, 6, 0, 0] },
      axis: { x: { labelAutoRotate: true }, y: { title: 'Sessions' } },
      tooltip: { channel: 'y', valueFormatter: (v: number) => `${v} sessions` },
    } as any;
  }, [funnel]);

  const conversion = useMemo(() => {
    const visits = funnel.find((r) => r.step === 'Visite')?.sessions ?? 0;
    const purchases = funnel.find((r) => r.step === 'Achat')?.sessions ?? 0;
    if (!visits) return 0;
    return purchases / visits;
  }, [funnel]);

  const variation = useMemo(() => {
    const prev = prevKpis;
    const cur = kpis;
    const orderPct = prev.totalOrders ? ((cur.totalOrders - prev.totalOrders) / prev.totalOrders) * 100 : 0;
    const revenuePct = prev.revenue ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : 0;
    const deliveredPct = prev.delivered ? ((cur.delivered - prev.delivered) / prev.delivered) * 100 : 0;
    const pendingPct = prev.pending ? ((cur.pending - prev.pending) / prev.pending) * 100 : 0;
    return { orderPct, revenuePct, deliveredPct, pendingPct };
  }, [kpis, prevKpis]);

  const statusCounts = useMemo(() => {
    const counts: Record<OrderStatusFilter, number> = {
      all: recentOrders.length,
      pending: 0,
      inProgress: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const o of recentOrders) {
      const s = String(o.status || '').toLowerCase();
      if (s === 'pending') counts.pending += 1;
      else if (s === 'delivered') counts.delivered += 1;
      else if (s === 'cancelled') counts.cancelled += 1;
      else if (['confirmed', 'processing', 'shipped'].includes(s)) counts.inProgress += 1;
    }
    return counts;
  }, [recentOrders]);

  const topCategoriesUi = useMemo(() => {
    const rows = [...topCategories];
    const isUncat = (r: TopRow) => String(r.label || '').trim().toLowerCase() === 'sans catégorie';
    const filtered = hideUncategorized ? rows.filter((r) => !isUncat(r)) : rows;
    return filtered.sort((a, b) => {
      const au = isUncat(a);
      const bu = isUncat(b);
      if (au && !bu) return 1;
      if (!au && bu) return -1;
      return b.qty - a.qty;
    });
  }, [topCategories, hideUncategorized]);

  const filteredRecentOrders = useMemo(() => {
    const s = orderSearch.trim().toLowerCase();
    return recentOrders
      .filter((o) => matchesStatusFilter(o, orderStatusFilter))
      .filter((o) => {
        if (!s) return true;
        const number = String(o.order_number || '').toLowerCase();
        const customer = String(o.customer_name || '').toLowerCase();
        return number.includes(s) || customer.includes(s);
      });
  }, [recentOrders, orderStatusFilter, orderSearch]);

  const isEmpty = !loading && !error && kpis.totalOrders === 0 && topProducts.length === 0 && recentOrders.length === 0;

  const selectedOrderTitle = useMemo(() => {
    if (!selectedOrder) return 'Détails commande';
    return selectedOrder.order_number || `Commande ${selectedOrder.id.slice(0, 8)}`;
  }, [selectedOrder]);

  const openProduct = async (productId: string) => {
    setProductOpen(true);
    setProductLoading(true);
    setProductError(null);
    setProductRow(null);
    try {
      const { data, error: e } = await supabase
        .from('products')
        .select('id, name, sku, price, quantity, main_image, images, description, categories(id,name)')
        .eq('id', productId)
        .maybeSingle();
      if (e) throw e;
      setProductRow((data as unknown as ProductDetailsRow) || null);
    } catch (e: any) {
      setProductError(e?.message || 'Impossible de charger le produit');
    } finally {
      setProductLoading(false);
    }
  };

  const loadOrderDetails = async (orderId: string) => {
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerItems([]);
    setDrawerOrderDetails(null);
    try {
      const fetchFromView = async (select: string) => {
        return await supabase
          .from('order_details_view')
          .select(select)
          .eq('id', orderId)
          .maybeSingle();
      };

      const viewSelectWithTimestamps = 'id, order_number, status, total_amount, created_at, paid_at, delivered_at, cancelled_at, payment_provider, payment_method, driver_id, driver_name, user_id, customer_name, customer_phone, customer_phone_profile, shipping_address, shipping_city, shipping_district, shipping_country, total_items, items';
      const viewSelectNoTimestamps = 'id, order_number, status, total_amount, created_at, paid_at, payment_provider, payment_method, driver_id, driver_name, user_id, customer_name, customer_phone, customer_phone_profile, shipping_address, shipping_city, shipping_district, shipping_country, total_items, items';

      const preferWithTs = viewSupportsDeliveryTimestamps.current !== false;

      const { data: viewRow, error: viewErr } = await (async () => {
        if (preferWithTs) {
          const r1 = await fetchFromView(viewSelectWithTimestamps);
          if (!r1.error) {
            viewSupportsDeliveryTimestamps.current = true;
            return r1;
          }

          const msg = String((r1.error as any)?.message || '').toLowerCase();
          const isColumnIssue = msg.includes('does not exist') || msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find');
          const isBadRequest = String((r1.error as any)?.code || '') === 'PGRST100' || msg.includes('bad request');
          if (isColumnIssue || isBadRequest) {
            viewSupportsDeliveryTimestamps.current = false;
            return await fetchFromView(viewSelectNoTimestamps);
          }
          return r1;
        }

        return await fetchFromView(viewSelectNoTimestamps);
      })();

      if (viewErr) throw viewErr;

      if (viewRow) {
        setDrawerOrderDetails(viewRow);
        const rawItems = (viewRow as any)?.items;
        if (Array.isArray(rawItems)) {
          const mapped = rawItems.map((it: any) => ({
            product_id: it.product_id ?? it.productId ?? null,
            product_name: it.product_name ?? it.productName ?? it.name ?? null,
            product_image: it.product_image ?? it.productImage ?? it.image ?? null,
            quantity: Number(it.quantity ?? it.qty ?? 0),
            unit_price: Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0),
            total_price: Number(it.total_price ?? it.totalPrice ?? 0),
          })) as DrawerOrderItemRow[];
          setDrawerItems(mapped.filter((x) => x.quantity > 0));
        }
        return;
      }

      const [{ data: orderRow, error: orderErr }, { data: items, error: itemsErr }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, paid_at, delivered_at, cancelled_at, payment_provider, payment_method, driver_id, shipping_address, shipping_city, shipping_district, shipping_country, customer_name, customer_phone')
          .eq('id', orderId)
          .maybeSingle(),
        supabase
          .from('order_items')
          .select('id, product_id, product_name, product_image, quantity, unit_price, total_price')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      if (orderErr) throw orderErr;
      if (itemsErr) throw itemsErr;
      setDrawerOrderDetails(orderRow || null);
      setDrawerItems(((items || []) as any[]).map((it) => ({
        id: it.id,
        product_id: it.product_id,
        product_name: it.product_name,
        product_image: it.product_image,
        quantity: Number(it.quantity || 0),
        unit_price: Number(it.unit_price || 0),
        total_price: Number(it.total_price || 0),
      })) as DrawerOrderItemRow[]);
    } catch (e: any) {
      setDrawerError(e?.message || 'Impossible de charger les détails de la commande');
    } finally {
      setDrawerLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedOrder?.id) return;
    loadOrderDetails(selectedOrder.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder?.id]);

  useEffect(() => {
    let mounted = true;
    const loadDrivers = async () => {
      try {
        const { data, error: e } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone')
          .eq('role', 'driver')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (e) return;
        if (!mounted) return;
        const opts = ((data || []) as any[]).map((r) => {
          const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
          const label = name || r.phone || r.id.slice(0, 8);
          return { value: r.id, label };
        }) as DriverOption[];
        setDrivers(opts);
      } catch {}
    };
    loadDrivers();
    return () => {
      mounted = false;
    };
  }, []);

  const updateOrderPatch = async (patch: Record<string, any>) => {
    if (!selectedOrder?.id) return;
    setDrawerActionLoading(true);
    try {
      const nextPatch: Record<string, any> = { ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
        const s = String(patch.status || '').toLowerCase();
        if (s === 'delivered') {
          nextPatch.delivered_at = new Date().toISOString();
          nextPatch.cancelled_at = null;
        } else if (s === 'cancelled') {
          nextPatch.cancelled_at = new Date().toISOString();
          nextPatch.delivered_at = null;
        }
      }

      const { error: e } = await updateOrderWithFallback(selectedOrder.id, { ...nextPatch });
      if (e) throw e;
      await loadOrderDetails(selectedOrder.id);
      await refresh({ silent: true });
    } catch (e: any) {
      setDrawerError(e?.message || 'Action impossible (vérifie RLS)');
    } finally {
      setDrawerActionLoading(false);
    }
  };

  const drawerContact = useMemo(() => {
    const d: any = drawerOrderDetails || {};
    return d.customer_phone_profile || d.customer_phone || null;
  }, [drawerOrderDetails]);

  const drawerAddressLabel = useMemo(() => {
    const d: any = drawerOrderDetails || {};
    const a: any = d.shipping_address;
    if (typeof a === 'string') return a;
    if (a && typeof a === 'object') {
      const street = a.street ?? a.address ?? a.line1 ?? a.address1;
      const district = a.district ?? a.neighborhood ?? d.shipping_district;
      const city = a.city ?? d.shipping_city;
      const country = a.country ?? d.shipping_country;
      return [street, district, city, country].filter(Boolean).join(', ');
    }
    return [d.shipping_district, d.shipping_city, d.shipping_country].filter(Boolean).join(', ');
  }, [drawerOrderDetails]);

  const drawerTotal = useMemo(() => {
    const t = drawerOrderDetails?.total_amount ?? selectedOrder?.total_amount ?? 0;
    return Number(t || 0);
  }, [drawerOrderDetails?.total_amount, selectedOrder?.total_amount]);

  const drawerItemsSubtotal = useMemo(() => {
    return drawerItems.reduce((s, r) => {
      const line = r.total_price != null ? Number(r.total_price) : Number(r.unit_price || 0) * Number(r.quantity || 0);
      return s + Number(line || 0);
    }, 0);
  }, [drawerItems]);

  const paymentLabel = useMemo(() => {
    const p = drawerOrderDetails?.payment_provider || drawerOrderDetails?.payment_method || null;
    return translatePaymentMethod(p);
  }, [drawerOrderDetails?.payment_provider, drawerOrderDetails?.payment_method]);

  const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const tag = dayjs().format('YYYYMMDD_HHmm');
    exportCsv(
      `dashboard_orders_${tag}.csv`,
      ['order_number', 'customer_name', 'status', 'total_amount', 'created_at'],
      filteredRecentOrders.map((o) => [o.order_number || o.id, o.customer_name || '', o.status || '', Number(o.total_amount || 0), o.created_at]),
    );
    exportCsv(
      `dashboard_top_products_${tag}.csv`,
      ['product', 'qty', 'share_qty', 'amount'],
      topProducts.map((p) => [p.label, p.qty, Math.round(p.shareQty * 1000) / 1000, Math.round(p.amount)]),
    );
    exportCsv(
      `dashboard_top_categories_${tag}.csv`,
      ['category', 'qty', 'share_qty', 'amount'],
      topCategories.map((c) => [c.label, c.qty, Math.round(c.shareQty * 1000) / 1000, Math.round(c.amount)]),
    );
  };

  const topSearchesMax = useMemo(() => {
    return topSearches.reduce((m, r) => Math.max(m, Number(r.count || 0)), 1);
  }, [topSearches]);

  const drilldownToOrders = (searchText: string) => {
    setOrderStatusFilter('all');
    setOrderSearch(searchText);
    requestAnimationFrame(() => {
      try {
        recentOrdersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {}
    });
  };

  const timeline = useMemo(() => {
    const d: any = drawerOrderDetails || {};
    const createdAt = d.created_at || selectedOrder?.created_at;
    const paidAt = d.paid_at;
    const deliveredAt = d.delivered_at;
    const cancelledAt = d.cancelled_at;
    const status = String(d.status ?? selectedOrder?.status ?? '').toLowerCase();

    const items = [
      { title: 'Créée', content: createdAt ? dayjs(createdAt).format('DD/MM HH:mm') : '—' },
      { title: 'Paiement', content: paidAt ? dayjs(paidAt).format('DD/MM HH:mm') : '—' },
      { title: 'Livraison', content: deliveredAt ? dayjs(deliveredAt).format('DD/MM HH:mm') : '—' },
    ];

    if (status === 'cancelled' || cancelledAt) {
      items.push({ title: 'Annulée', content: cancelledAt ? dayjs(cancelledAt).format('DD/MM HH:mm') : '—' });
    }

    const current = (() => {
      if (status === 'delivered' || deliveredAt) return 2;
      if (paidAt) return 1;
      if (createdAt) return 0;
      return 0;
    })();

    return { items, current };
  }, [drawerOrderDetails, selectedOrder]);

  const liveTimestamp = useMemo(() => lastUpdatedAt ? dayjs(lastUpdatedAt).format('HH:mm:ss') : '—', [lastUpdatedAt]);
  const overallTrend = useMemo(() => {
    const v = variation.revenuePct;
    if (v > 0) return { text: `+${Math.round(v * 10) / 10}% vs période préc.`, up: true };
    if (v < 0) return { text: `${Math.round(v * 10) / 10}% vs période préc.`, up: false };
    return { text: 'Stable vs période préc.', up: null };
  }, [variation.revenuePct]);

  return (
    <div className="space-y-5">
      {/* 1. Header Analytics Live */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 20px',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10B981' }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#10B981' }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>LIVE</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Dernière mise à jour</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-1)' }}>{liveTimestamp}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: 999,
                background: overallTrend.up === true ? 'rgba(16,185,129,0.10)' : overallTrend.up === false ? 'rgba(239,68,68,0.10)' : 'var(--bg-elevated)',
                color: overallTrend.up === true ? '#10B981' : overallTrend.up === false ? '#EF4444' : 'var(--text-2)',
              }}
            >
              {overallTrend.text}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Segmented
              value={period}
              options={[{ label: '24h', value: '24h' }, { label: '7j', value: '7d' }, { label: '30j', value: '30d' }]}
              onChange={(v) => setPeriod(v as PeriodKey)}
            />
            <Button onClick={() => refresh()} loading={loading} type="primary" size="middle">Actualiser</Button>
            <Button onClick={handleExport} disabled={loading}>Exporter CSV</Button>
          </div>
        </div>
      </div>

      {error && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Typography.Text type="danger">{error}</Typography.Text>
            <Button onClick={() => refresh()} loading={loading}>Réessayer</Button>
          </div>
        </Card>
      )}

      {isEmpty && (
        <Card>
          <EmptyState
            icon="orders"
            title="Aucune donnée pour la période"
            description="Changez la période (24h, 7j, 30j) ou attendez de nouvelles commandes."
            actionLabel="Actualiser"
            onAction={() => refresh()}
          />
        </Card>
      )}

      {/* 2. KPI Cards */}
      <Row gutter={[16, 16]}>
        {([
          { label: 'Total commandes', value: kpis.totalOrders, pct: variation.orderPct, prev: prevKpis.totalOrders, color: '#6366F1', bg: 'rgba(99,102,241,0.10)', icon: <ShoppingOutlined />, spark: ordersSeries, sparkColor: '#6366F1', onClick: () => setOrderStatusFilter('all'), invertTrend: false },
          { label: 'En attente', value: kpis.pending, pct: variation.pendingPct, prev: prevKpis.pending, color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', icon: <ArrowUpOutlined />, spark: pendingSeries, sparkColor: '#F59E0B', onClick: () => setOrderStatusFilter('pending'), invertTrend: true },
          { label: 'Livrées', value: kpis.delivered, pct: variation.deliveredPct, prev: prevKpis.delivered, color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: <span style={{ fontWeight: 700 }}>✓</span>, spark: deliveredSeries, sparkColor: '#10B981', onClick: () => setOrderStatusFilter('delivered'), invertTrend: false },
          { label: 'Revenus', value: null, pct: variation.revenuePct, prev: prevKpis.revenue, color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', icon: <span style={{ fontWeight: 700 }}>F</span>, spark: revenueSeries, sparkColor: '#8B5CF6', onClick: undefined, revenue: kpis.revenue, invertTrend: false },
        ] as const).map((kpi, i) => (
          <Col xs={12} md={6} key={i}>
            <Card hoverable={!!kpi.onClick} onClick={kpi.onClick} styles={{ body: { padding: 20 } }}>
              {loading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
                <div className="flex justify-between items-start">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>{kpi.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: kpi.value !== null ? 'var(--text-1)' : 'var(--text-1)', fontFamily: 'var(--font-heading)' }}>
                      {kpi.value !== null ? kpi.value : <>{Math.round(kpi.revenue!).toLocaleString('fr-FR')} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>FCFA</span></>}
                    </div>
                    {kpi.prev > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: (kpi.invertTrend ? kpi.pct <= 0 : kpi.pct >= 0) ? '#10B981' : '#EF4444' }}>
                        {kpi.pct >= 0 ? '↑' : '↓'} {Math.abs(Math.round(kpi.pct * 10) / 10)}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: kpi.bg, color: kpi.color, fontSize: 16 }}>
                      {kpi.icon}
                    </div>
                    <MiniSparkline data={kpi.spark as any} color={kpi.sparkColor} />
                  </div>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* 3. Alertes & Top recherches & Checkout donut */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Alertes critiques</span>} styles={{ body: { padding: 16 } }}>
            {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : (
              <div className="space-y-3">
                {alerts.filter((a) => a.severity === 'high' || a.severity === 'medium').map((a) => (
                  <div key={`${a.title}-${a.detail}`} className="flex items-center justify-between gap-2">
                    <Badge status={a.severity === 'high' ? 'error' : 'warning'} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', flex: 1 }} className="truncate">{a.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.detail}</span>
                  </div>
                ))}
                {outOfStockProducts.length > 0 && (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginBottom: 8 }}>Ruptures de stock</div>
                    <ul className="space-y-1 max-h-24 overflow-y-auto" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {outOfStockProducts.slice(0, 5).map((p) => (
                        <li key={p.id} style={{ fontSize: 13, color: 'var(--text-2)' }} className="truncate">{p.name || p.id.slice(0, 8)}</li>
                      ))}
                    </ul>
                    <Button type="link" size="small" style={{ padding: 0, marginTop: 4, height: 'auto' }} onClick={() => router.push('/products?stock=out')}>Voir tout →</Button>
                  </div>
                )}
                {alerts.every((a) => a.severity === 'low') && (
                  <div className="flex items-center gap-2" style={{ color: '#10B981' }}>
                    <Badge status="success" /> <span style={{ fontSize: 13 }}>Tout est OK</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Top recherches</span>} styles={{ body: { padding: 16 } }}>
            {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : topSearches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-3)', fontSize: 13 }}>Aucune recherche</div>
            ) : (
              <div className="space-y-3">
                {topSearches.slice(0, 5).map((r) => {
                  const pct = Math.max(8, topSearchesMax ? Math.round((Number(r.count || 0) / topSearchesMax) * 100) : 0);
                  return (
                    <div key={r.term} className="cursor-pointer" onClick={() => drilldownToOrders(r.term)}>
                      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 4 }}>
                        <Tooltip title={r.term}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }} className="truncate flex-1">{r.term}</span>
                        </Tooltip>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{r.count}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#6366F1', borderRadius: 999, transition: 'width 300ms ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Checkout abandonné</span>} styles={{ body: { padding: 16 } }}>
            {loading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
              <div className="flex flex-col items-center">
                {(() => {
                  const completed = Math.max(0, funnel.find((r) => r.step === 'Achat')?.sessions ?? 0);
                  const donutData = [
                    { type: 'Abandonnés', value: checkoutAbandoned },
                    { type: 'Complétés', value: completed },
                  ].filter((d) => d.value > 0);
                  return (
                    <>
                      <div style={{ width: 128, height: 128, position: 'relative' }}>
                        {donutData.length > 0 ? (
                          <Pie
                            data={donutData}
                            angleField="value"
                            colorField="type"
                            radius={1}
                            innerRadius={0.6}
                            color={['#F59E0B', '#10B981']}
                            legend={false}
                          />
                        ) : (
                          <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-3)' }}>0</span>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Événements abandonnés</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>{checkoutAbandoned}</span>
                    </>
                  );
                })()}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 4. Série temporelle + Funnel vertical */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Commandes (série)</span>}
            extra={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>{dayjs(range.dateFrom).format('DD/MM')} → {dayjs(range.dateTo).format('DD/MM')}</span>}
            styles={{ body: { padding: 20 } }}
          >
            {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : <Line {...ordersChartConfig} />}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Funnel (sessions)</span>} styles={{ body: { padding: 20 } }}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <>
                <Column {...funnelChartConfig} />
                <div className="mt-3 flex items-center justify-between px-1">
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Conversion (Achat / Visite)</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#6366F1' }}>{Math.round(conversion * 1000) / 10}%</span>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card hoverable>
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Statistic title="Rupture stock" value={Math.round(kpis.stockoutRate * 1000) / 10} suffix="%" />
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{kpis.outOfStockCount} / {kpis.totalProducts} produits</div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable onClick={() => setOrderStatusFilter('inProgress')}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Statistic title="En cours" value={kpis.inProgress} />
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Confirmées / en préparation / expédiées</div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable onClick={() => setOrderStatusFilter('cancelled')}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Statistic title="Annulées" value={kpis.cancelled} />
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Sur la période sélectionnée</div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <div ref={recentOrdersRef} />
          <Card
            title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Commandes récentes</span>}
            extra={(
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="small"
                  value={orderStatusFilter}
                  options={[
                    { label: `Toutes (${statusCounts.all})`, value: 'all' },
                    { label: `En attente (${statusCounts.pending})`, value: 'pending' },
                    { label: `En cours (${statusCounts.inProgress})`, value: 'inProgress' },
                    { label: `Livrées (${statusCounts.delivered})`, value: 'delivered' },
                    { label: `Annulées (${statusCounts.cancelled})`, value: 'cancelled' },
                  ]}
                  onChange={(v) => setOrderStatusFilter(v as OrderStatusFilter)}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="Rechercher (numéro / client)"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  style={{ width: 220 }}
                />
              </div>
            )}
          >
            <Table
              size="small"
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} commande(s)` }}
              loading={loading}
              dataSource={filteredRecentOrders}
              locale={{ emptyText: loading ? 'Chargement…' : 'Aucune commande' }}
              scroll={{ x: true }}
              className="dashboard-orders-table"
              onRow={(record) => ({
                onClick: () => setSelectedOrder(record),
                style: { cursor: 'pointer' },
              })}
              columns={[
                {
                  title: '#',
                  dataIndex: 'order_number',
                  render: (v, r) => {
                    const idLabel = v || r.id.slice(0, 8);
                    const isNew = dayjs().diff(dayjs(r.created_at), 'hour') < 1;
                    return (
                      <Space size={8}>
                        <Typography.Text strong>{idLabel}</Typography.Text>
                        {isNew ? <Tag color="blue">Nouveau</Tag> : null}
                      </Space>
                    );
                  },
                },
                { title: 'Client', dataIndex: 'customer_name', render: (v) => v || '—' },
                { title: 'Statut', dataIndex: 'status', render: (v) => statusTag(v) },
                { title: 'Total', dataIndex: 'total_amount', align: 'right', render: (v) => `${Number(v || 0).toLocaleString()} FCFA` },
                {
                  title: 'Date',
                  dataIndex: 'created_at',
                  render: (v: string) => (
                    <div>
                      <div>{dayjs(v).format('DD/MM HH:mm')}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{relativeTime(v)}</Typography.Text>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Card title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Top produits</span>}>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  loading={loading}
                  dataSource={topProducts}
                  scroll={{ x: true }}
                  columns={[
                    {
                      title: 'Produit',
                      dataIndex: 'label',
                      key: 'label',
                      render: (v: string, r: TopRow, index: number) => {
                        const rank = index + 1;
                        const rankBadge = rank <= 3 ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold"
                            style={{
                              background: rank === 1 ? 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)' : rank === 2 ? 'linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)' : 'linear-gradient(135deg, #FDE68A 0%, #FCD34D 100%)',
                              color: rank === 1 ? '#78350F' : rank === 2 ? '#1F2937' : '#92400E',
                            }}
                          >
                            {rank}
                          </span>
                        ) : null;
                        return (
                          <Tooltip title={v}>
                            <div className="flex items-center gap-2">
                              {rankBadge}
                              {r.imageUrl ? (
                                <Image src={r.imageUrl} alt="" width={38} height={38} preview={false} style={{ objectFit: 'cover', borderRadius: 10 }} />
                              ) : (
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-elevated)' }} />
                              )}
                              <span className="truncate max-w-[160px]">{v}</span>
                            </div>
                          </Tooltip>
                        );
                      },
                    },
                    { title: 'Qté', dataIndex: 'qty', width: 70, align: 'right', sorter: (a, b) => a.qty - b.qty },
                    {
                      title: 'Part',
                      dataIndex: 'shareQty',
                      width: 140,
                      render: (v: any) => {
                        const pct = Math.max(0, Math.min(100, Math.round(Number(v || 0) * 1000) / 10));
                        return (
                          <div style={{ minWidth: 120 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{pct}%</span>
                            </div>
                            <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999 }}>
                              <div style={{ width: `${pct}%`, height: 6, background: '#6366F1', borderRadius: 999 }} />
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Montant',
                      dataIndex: 'amount',
                      width: 120,
                      align: 'right',
                      render: (v) => `${Math.round(Number(v || 0)).toLocaleString()} FCFA`,
                    },
                    {
                      title: '',
                      key: 'view',
                      width: 44,
                      align: 'right',
                      render: (_v: unknown, r: TopRow) => (
                        <Tooltip title="Voir le produit">
                          <Button
                            type="text"
                            icon={<EyeOutlined style={{ fontSize: 18 }} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              const pid = r.productId || r.key;
                              void openProduct(pid);
                            }}
                          />
                        </Tooltip>
                      ),
                    },
                  ]}
                  onRow={(r) => ({
                    onClick: () => drilldownToOrders(r.label),
                    style: { cursor: 'pointer' },
                  })}
                />
              </Card>
            </Col>
            <Col span={24}>
              <Card
                title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Top catégories</span>}
                extra={(
                  <Button size="small" onClick={() => setHideUncategorized((v) => !v)}>
                    {hideUncategorized ? 'Afficher Sans catégorie' : 'Masquer Sans catégorie'}
                  </Button>
                )}
                styles={{ body: { padding: 16 } }}
              >
                {loading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : topCategoriesUi.length > 0 ? (
                  <div className="flex flex-col lg:flex-row gap-4 items-center">
                    <div className="w-full lg:w-56 h-56 shrink-0">
                      <Pie
                        data={topCategoriesUi.map((c) => ({ type: c.label, value: c.qty }))}
                        angleField="value"
                        colorField="type"
                        radius={1}
                        innerRadius={0.6}
                        legend={{ position: 'right', layout: 'vertical' }}
                        tooltip={{ channel: 'y', valueFormatter: (v: number) => `${v} unités` }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <Table
                        size="small"
                        rowKey="key"
                        pagination={false}
                        dataSource={topCategoriesUi}
                        scroll={{ x: true }}
                        columns={[
                          {
                            title: 'Catégorie',
                            dataIndex: 'label',
                            render: (v: any) => {
                              const s = String(v || '—');
                              if (s.trim().toLowerCase() === 'sans catégorie') return <Tag color="default">Sans catégorie</Tag>;
                              return <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{s}</span>;
                            },
                          },
                          { title: 'Qté', dataIndex: 'qty', width: 70, align: 'right' },
                          { title: 'Part', dataIndex: 'shareQty', width: 70, align: 'right', render: (v: number) => `${Math.round(Number(v || 0) * 1000) / 10}%` },
                          { title: 'Montant', dataIndex: 'amount', width: 120, align: 'right', render: (v: number) => `${Math.round(Number(v || 0)).toLocaleString()} FCFA` },
                        ]}
                        onRow={(r) => ({ onClick: () => drilldownToOrders(r.label), style: { cursor: 'pointer' } })}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'block', padding: '16px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Aucune catégorie avec ventes</div>
                )}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Drawer
        open={!!selectedOrder}
        title={selectedOrderTitle}
        onClose={() => setSelectedOrder(null)}
        size="large"
        extra={(
          <Space>
            <Button
              onClick={() => {
                if (!selectedOrder) return;
                try {
                  navigator.clipboard.writeText(selectedOrder.order_number || selectedOrder.id);
                } catch {}
              }}
            >
              Copier
            </Button>
            <Button type="primary" onClick={() => setSelectedOrder(null)}>Fermer</Button>
          </Space>
        )}
      >
        {!selectedOrder ? null : (
          <div className="space-y-4">
            {drawerError && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Typography.Text type="danger">{drawerError}</Typography.Text>
                  <Button onClick={() => loadOrderDetails(selectedOrder.id)} loading={drawerLoading}>Réessayer</Button>
                </div>
              </Card>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-heading)' }}>{drawerTotal.toLocaleString()} FCFA</div>
              </div>
              <Space size={8} wrap>
                {statusTag(drawerOrderDetails?.status ?? selectedOrder.status)}
                <Tag color="geekblue">{paymentLabel}</Tag>
              </Space>
            </div>

            <Row gutter={[12, 12]}>
              <Col span={12}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Client</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{drawerOrderDetails?.customer_name ?? selectedOrder.customer_name ?? '—'}</div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Téléphone</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{drawerContact || '—'}</div>
                </div>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col span={12}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Créée le</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{dayjs(drawerOrderDetails?.created_at ?? selectedOrder.created_at).format('DD/MM/YYYY HH:mm:ss')}</div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Paiement</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{paymentLabel}</div>
                    {drawerOrderDetails?.paid_at ? (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Payé: {dayjs(drawerOrderDetails.paid_at).format('DD/MM HH:mm')}</div>
                    ) : null}
                  </div>
                </div>
              </Col>
            </Row>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Adresse</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{drawerAddressLabel || '—'}</div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-heading)', margin: 0 }}>Suivi</div>
              <div style={{ marginTop: 10 }}>
                <Steps size="small" current={timeline.current} items={timeline.items} />
              </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-heading)', margin: 0 }}>Actions</div>
              <div style={{ marginTop: 10 }} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Statut</div>
                  <Select
                    value={String(drawerOrderDetails?.status ?? selectedOrder.status ?? 'pending')}
                    style={{ width: '100%' }}
                    disabled={drawerActionLoading}
                    options={ORDER_STATUS_OPTIONS}
                    onChange={(v) => updateOrderPatch({ status: v })}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Livreur</div>
                  <Select
                    allowClear
                    placeholder="Assigner un livreur"
                    value={drawerOrderDetails?.driver_id ?? null}
                    style={{ width: '100%' }}
                    disabled={drawerActionLoading}
                    options={drivers}
                    onChange={(v) => updateOrderPatch({ driver_id: v ?? null })}
                  />
                </div>
              </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div className="flex items-center justify-between">
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-heading)', margin: 0 }}>Articles</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{drawerItems.length} article(s)</div>
            </div>

            {drawerLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Table
                size="small"
                rowKey={(r) => r.id || `${r.product_id}-${r.product_name}`}
                pagination={false}
                dataSource={drawerItems}
                locale={{ emptyText: 'Aucun article' }}
                scroll={{ x: true }}
                columns={[
                  {
                    title: 'Produit',
                    dataIndex: 'product_name',
                    render: (v: any, r: DrawerOrderItemRow) => {
                      const label = v || r.product_id || '—';
                      const canPreview = !!r.product_image;
                      return (
                        <Tooltip title={label}>
                          <div className="flex items-center gap-2">
                            <Avatar
                              shape="square"
                              size={34}
                              src={r.product_image || undefined}
                              style={{ background: 'rgba(0,0,0,0.06)' }}
                            >
                              {String(label).slice(0, 1).toUpperCase()}
                            </Avatar>
                            <span style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                            {canPreview ? (
                              <Tooltip title="Voir l'image">
                                <Image
                                  src={r.product_image as string}
                                  alt={String(label)}
                                  width={18}
                                  height={18}
                                  preview
                                  style={{ borderRadius: 6, cursor: 'pointer' }}
                                  placeholder={<EyeOutlined />}
                                />
                              </Tooltip>
                            ) : null}
                          </div>
                        </Tooltip>
                      );
                    },
                  },
                  { title: 'Qté', dataIndex: 'quantity', width: 70, align: 'right' },
                  { title: 'PU', dataIndex: 'unit_price', width: 110, align: 'right', render: (v) => `${Math.round(Number(v || 0)).toLocaleString()} FCFA` },
                  { title: 'Total', dataIndex: 'total_price', width: 120, align: 'right', render: (v, r) => `${Math.round(Number(v ?? (Number(r.unit_price || 0) * Number(r.quantity || 0)))).toLocaleString()} FCFA` },
                ]}
              />
            )}

            <Divider style={{ margin: '12px 0' }} />

            <div className="flex items-center justify-between">
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Sous-total items</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{Math.round(drawerItemsSubtotal).toLocaleString()} FCFA</div>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Total commande</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{Math.round(drawerTotal).toLocaleString()} FCFA</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Identifiant</div>
              <code style={{ fontSize: 12, padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: 4, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{selectedOrder.id}</code>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        open={productOpen}
        title={productRow?.name || (productLoading ? 'Chargement…' : 'Produit')}
        onClose={() => {
          setProductOpen(false);
          setProductRow(null);
          setProductError(null);
        }}
        size="large"
        extra={(
          <Space>
            {productRow?.id ? (
              <Button onClick={() => router.push(`/products?search=${encodeURIComponent(productRow.id)}`)}>
                Ouvrir dans Produits
              </Button>
            ) : null}
            <Button type="primary" onClick={() => setProductOpen(false)}>Fermer</Button>
          </Space>
        )}
      >
        {productLoading ? (
          <div className="py-10 flex justify-center"><Skeleton active paragraph={{ rows: 6 }} /></div>
        ) : productError ? (
          <Card>
            <div style={{ color: '#EF4444', fontSize: 14 }}>{productError}</div>
          </Card>
        ) : productRow ? (
          <div className="space-y-3">
            <Card styles={{ body: { padding: 14 } }}>
              <div className="flex flex-col md:flex-row gap-3">
                <div style={{ width: 180, height: 180, borderRadius: 16, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                  {(() => {
                    const imgs = Array.isArray(productRow.images) ? productRow.images : [];
                    const src = productRow.main_image || imgs[0] || null;
                    return src ? (
                      <Image src={src} alt="" width={180} height={180} preview={false} style={{ objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <EyeOutlined style={{ fontSize: 44, opacity: 0.25, color: 'var(--text-3)' }} />
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-heading)', margin: 0 }}>{productRow.name || '—'}</div>
                  <div style={{ marginTop: 6 }}>
                    <Space wrap size={8}>
                      {productRow.sku ? <Tag>SKU: {productRow.sku}</Tag> : null}
                      <Tag color={Number(productRow.quantity || 0) > 10 ? 'green' : Number(productRow.quantity || 0) > 0 ? 'gold' : 'red'}>
                        Stock: {Number(productRow.quantity || 0)}
                      </Tag>
                      <Tag color="blue">Prix: {Number(productRow.price || 0).toLocaleString('fr-FR')} FCFA</Tag>
                    </Space>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    {(() => {
                      const c = productRow.categories;
                      const cat = Array.isArray(c) ? (c[0] || null) : (c || null);
                      return <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Catégorie: {cat?.name || '—'}</div>;
                    })()}
                  </div>

                  {productRow.description ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Description</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{productRow.description}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <Empty description="Produit introuvable" />
        )}
      </Drawer>
    </div>
  );
}
