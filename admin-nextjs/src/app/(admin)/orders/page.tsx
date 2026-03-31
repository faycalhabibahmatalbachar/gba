'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  ExportOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase/client';
import type { OrderDetailsRow, OrderRow } from '@/lib/services/orders';
import {
  assignOrderDriver,
  bulkAssignDriver,
  bulkUpdateOrderStatus,
  fetchOrderDetails,
  fetchOrders,
  fetchOrdersKpis,
  updateOrderStatus,
} from '@/lib/services/orders';
import type { OrdersKpis } from '@/lib/services/orders';
import PageHeader from '@/components/ui/PageHeader';
import { OrderStatusBadge, ORDER_STATUS_OPTIONS } from '@/components/orders/OrderStatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { translatePaymentMethod } from '@/lib/i18n/translations';

const { RangePicker } = DatePicker;

type DriverOption = { label: string; value: string };

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date (récent)' },
  { value: 'created_at_asc', label: 'Date (ancien)' },
  { value: 'total_amount', label: 'Montant (décroissant)' },
  { value: 'total_amount_asc', label: 'Montant (croissant)' },
  { value: 'status', label: 'Statut' },
];

function KpiCard({
  title,
  value,
  sub,
  icon,
  tooltip,
  className = '',
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tooltip?: string;
  className?: string;
}) {
  const content = (
    <Card 
      className={`glass-card transition-all duration-200 hover:shadow-lg border ${className}`} 
      styles={{ body: { padding: 20 } }}
      style={{ borderColor: 'var(--card-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>{title}</div>
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{value}</div>
          {sub != null && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
          {icon}
        </div>
      </div>
    </Card>
  );
  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
}

function formatPaymentMethod(method: string | null | undefined): string {
  return translatePaymentMethod(method);
}

function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve(ok);
}

export default function OrdersPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpis, setKpis] = useState<OrdersKpis>({
    totalOrders: 0,
    revenue: 0,
    avgBasket: 0,
    pendingCount: 0,
    deliveredCount: 0,
    deliveryRate: 0,
  });
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [amountMin, setAmountMin] = useState<number | null>(null);
  const [amountMax, setAmountMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetailsRow | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignDriverId, setAssignDriverId] = useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reloadRef = useRef<(() => void) | undefined>(undefined);
  const statusChangeRef = useRef<number>(0);

  const fetchParams = useMemo(() => {
    const [dateFrom, dateTo] = dateRange ?? [null, null];
    let orderBy = sortBy;
    let order: 'asc' | 'desc' = sortOrder;
    if (sortBy === 'created_at_asc') {
      orderBy = 'created_at';
      order = 'asc';
    } else if (sortBy === 'total_amount_asc') {
      orderBy = 'total_amount';
      order = 'asc';
    } else if (sortBy === 'total_amount') {
      orderBy = 'total_amount';
      order = 'desc';
    }
    return {
      page,
      pageSize,
      search: search.trim() || undefined,
      status: status === 'all' ? undefined : status,
      driverId: driverId || undefined,
      dateFrom: dateFrom ? dateFrom.startOf('day').toISOString() : undefined,
      dateTo: dateTo ? dateTo.endOf('day').toISOString() : undefined,
      amountMin: amountMin ?? undefined,
      amountMax: amountMax ?? undefined,
      sortBy: orderBy,
      sortOrder: order,
    };
  }, [page, pageSize, search, status, driverId, dateRange, amountMin, amountMax, sortBy, sortOrder]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOrders(fetchParams);
      setOrders(res.data);
      setTotal(res.count);
    } catch (e: any) {
      message.error(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [fetchParams, message]);

  const loadKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const data = await fetchOrdersKpis({
        search: fetchParams.search,
        status: fetchParams.status,
        driverId: fetchParams.driverId,
        dateFrom: fetchParams.dateFrom,
        dateTo: fetchParams.dateTo,
        amountMin: fetchParams.amountMin,
        amountMax: fetchParams.amountMax,
      });
      setKpis(data);
    } catch {
      setKpis((prev) => prev);
    } finally {
      setKpisLoading(false);
    }
  }, [fetchParams.search, fetchParams.status, fetchParams.driverId, fetchParams.dateFrom, fetchParams.dateTo, fetchParams.amountMin, fetchParams.amountMax]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      void load();
      void loadKpis();
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, driverId, dateRange, amountMin, amountMax]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('role', 'driver')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted || error) return;
        setDrivers(
          (data || []).map((d: any) => ({
            value: d.id,
            label: `${[d.first_name, d.last_name].filter(Boolean).join(' ')}`.trim() || d.email || d.id,
          })),
        );
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
          void load();
          void loadKpis();
        }, 600);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [load, loadKpis]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setOpenOrderId(params.get('open'));
  }, []);

  useEffect(() => {
    if (!openOrderId || !orders.length || detailsOpen) return;
    const order = orders.find((o) => o.id === openOrderId);
    if (order) {
      setSelected(order);
      setDetailsOpen(true);
      void loadOrderDetails(order.id);
    }
  }, [openOrderId, orders, detailsOpen]);

  reloadRef.current = load;

  const loadOrderDetails = async (orderId: string) => {
    setDetailsLoading(true);
    try {
      const details = await fetchOrderDetails(orderId);
      setOrderDetails(details);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement détails');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setStatusUpdating(true);
    setUpdatingOrderId(orderId);
    statusChangeRef.current = Date.now();
    try {
      await updateOrderStatus(orderId, newStatus);
      message.success('Statut mis à jour');
      void load();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setStatusUpdating(false);
      setUpdatingOrderId(null);
    }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatusValue || selectedRowKeys.length === 0) return;
    setBulkActionLoading(true);
    try {
      await bulkUpdateOrderStatus(selectedRowKeys as string[], bulkStatusValue);
      message.success(`${selectedRowKeys.length} commande(s) mise(s) à jour`);
      setSelectedRowKeys([]);
      setBulkStatusOpen(false);
      setBulkStatusValue(null);
      void load();
      void loadKpis();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedRowKeys.length === 0) return;
    setBulkActionLoading(true);
    try {
      await bulkAssignDriver(selectedRowKeys as string[], assignDriverId);
      message.success('Livreur assigné');
      setSelectedRowKeys([]);
      setAssignOpen(false);
      void load();
      void loadKpis();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId) return;
    setStatusUpdating(true);
    try {
      await updateOrderStatus(cancelOrderId, 'cancelled');
      message.success('Commande annulée');
      setCancelConfirmOpen(false);
      setCancelOrderId(null);
      if (selected?.id === cancelOrderId) await loadOrderDetails(cancelOrderId);
      void load();
      void loadKpis();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setStatusUpdating(false);
    }
  };

  const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const blob = new Blob(['\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedOrders = useMemo(() => orders.filter((o) => selectedRowKeys.includes(o.id)), [orders, selectedRowKeys]);

  const columns: ColumnsType<OrderRow> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'order_number',
        key: 'id',
        width: 120,
        render: (v, r) => (
          <div>
            <span className="font-semibold">{v || r.id.slice(0, 8)}</span>
            <div className="text-xs text-slate-500">{dayjs(r.created_at).format('DD/MM/YYYY HH:mm')}</div>
          </div>
        ),
      },
      {
        title: 'Client',
        key: 'client',
        width: 180,
        render: (_, r) => (
          <div className="truncate">
            <div className="font-medium truncate">{r.customer_name || '—'}</div>
            <div className="text-xs text-slate-500 truncate">{r.customer_phone_profile || r.customer_phone || '—'}</div>
          </div>
        ),
      },
      {
        title: 'Total',
        dataIndex: 'total_amount',
        width: 120,
        align: 'right',
        render: (v) => <span className="font-semibold text-indigo-600 dark:text-indigo-400">{Number(v || 0).toLocaleString('fr-FR')} FCFA</span>,
      },
      {
        title: 'Paiement',
        dataIndex: 'payment_method',
        width: 150,
        render: (v) => <span className="text-xs">{formatPaymentMethod(v)}</span>,
      },
      {
        title: 'Statut',
        dataIndex: 'status',
        width: 130,
        render: (v, r) => (
          <Select
            size="small"
            value={(v || 'pending').toLowerCase()}
            style={{ width: 120 }}
            options={ORDER_STATUS_OPTIONS}
            onChange={(next) => handleStatusChange(r.id, next)}
            disabled={statusUpdating}
          />
        ),
      },
      {
        title: 'Livreur',
        dataIndex: 'driver_name',
        width: 140,
        render: (v, r) => (v ? <span className="text-sm">{v}</span> : r.driver_id ? <span className="text-slate-500">Assigné</span> : '—'),
      },
      {
        title: 'Date',
        dataIndex: 'created_at',
        width: 100,
        render: (v) => dayjs(v).format('DD/MM HH:mm'),
      },
      {
        title: '',
        key: 'actions',
        width: 120,
        align: 'right',
        render: (_, r) => (
          <Space size={4}>
            <Tooltip title="Détails">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelected(r);
                  setDetailsOpen(true);
                  void loadOrderDetails(r.id);
                }}
              />
            </Tooltip>
            <Tooltip title="Assigner livreur">
              <Button
                type="text"
                size="small"
                icon={<UserOutlined />}
                onClick={() => {
                  setSelected(r);
                  setAssignDriverId(r.driver_id || null);
                  setAssignOpen(true);
                }}
              />
            </Tooltip>
            <Tooltip title="Supprimer">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setCancelOrderId(r.id);
                  setCancelConfirmOpen(true);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [statusUpdating],
  );

  const hasFilters = status !== 'all' || driverId || dateRange?.some(Boolean) || amountMin != null || amountMax != null || (search?.trim() && search.trim().length > 0);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Commandes"
        subtitle="Centre de gestion des commandes — suivi et actions"
        extra={
          <Space wrap>
            <Button icon={<ExportOutlined />} onClick={() => exportCsv(`orders_${dayjs().format('YYYYMMDD_HHmm')}.csv`, ['id', 'order_number', 'created_at', 'customer_name', 'customer_phone', 'status', 'total_amount', 'driver_id'], orders.map((o) => [o.id, o.order_number || '', o.created_at, o.customer_name || '', o.customer_phone_profile || o.customer_phone || '', o.status || '', Number(o.total_amount || 0), o.driver_id || '']))}>
              Exporter CSV
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { void load(); void loadKpis(); }} loading={loading}>
              Actualiser
            </Button>
          </Space>
        }
      />

      {/* Sticky KPI Header */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800 mb-4">
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={4}>
            {kpisLoading ? <Skeleton.Input active size="small" className="w-full" /> : <KpiCard title="Total commandes" value={kpis.totalOrders} icon={<span className="text-lg">📋</span>} tooltip="Nombre total (filtres appliqués)" />}
          </Col>
          <Col xs={12} sm={8} md={4}>
            {kpisLoading ? <Skeleton.Input active size="small" className="w-full" /> : <KpiCard title="Revenus" value={`${Math.round(kpis.revenue).toLocaleString('fr-FR')} FCFA`} icon={<span className="text-lg">💰</span>} tooltip="Somme des commandes (jusqu'à 5000)" />}
          </Col>
          <Col xs={12} sm={8} md={4}>
            {kpisLoading ? <Skeleton.Input active size="small" className="w-full" /> : <KpiCard title="Panier moyen" value={`${Math.round(kpis.avgBasket).toLocaleString('fr-FR')} FCFA`} icon={<span className="text-lg">🛒</span>} />}
          </Col>
          <Col xs={12} sm={8} md={4}>
            {kpisLoading ? <Skeleton.Input active size="small" className="w-full" /> : <KpiCard title="En attente" value={kpis.pendingCount} icon={<span className="text-lg">⏳</span>} />}
          </Col>
          <Col xs={12} sm={8} md={4}>
            {kpisLoading ? <Skeleton.Input active size="small" className="w-full" /> : <KpiCard title="Livrées" value={kpis.deliveredCount} sub={`${Math.round(kpis.deliveryRate)}% taux`} icon={<span className="text-lg">✅</span>} />}
          </Col>
        </Row>
      </div>

      {/* Filters */}
      <Card size="small" className="shadow-sm">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Rechercher (ID, client, tél.)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              className="w-full"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select 
              value="normal" 
              onChange={(v) => {
                if (v === 'special') {
                  message.info('Les commandes spéciales sont dans une table séparée. Fonctionnalité à venir.');
                }
              }} 
              options={[
                { value: 'normal', label: 'Normales' },
                { value: 'special', label: 'Spéciales' }
              ]} 
              className="w-full" 
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'Tous statuts' }, ...ORDER_STATUS_OPTIONS]} className="w-full" />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select allowClear placeholder="Livreur" value={driverId} onChange={setDriverId} options={drivers} className="w-full" />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker value={dateRange} onChange={(v) => setDateRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)} className="w-full" />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <InputNumber placeholder="Min FCFA" min={0} value={amountMin} onChange={(v) => setAmountMin(v ?? null)} className="w-full" />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <InputNumber placeholder="Max FCFA" min={0} value={amountMax} onChange={(v) => setAmountMax(v ?? null)} className="w-full" />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} className="w-full" />
          </Col>
        </Row>
      </Card>

      {/* Bulk actions */}
      {selectedRowKeys.length > 0 && (
        <Card size="small" className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
          <Space wrap>
            <Typography.Text strong>{selectedRowKeys.length} sélectionnée(s)</Typography.Text>
            <Button size="small" icon={<TeamOutlined />} onClick={() => setAssignOpen(true)}>Assigner livreur</Button>
            <Button size="small" icon={<DeleteOutlined />} onClick={() => { setBulkStatusOpen(true); setBulkStatusValue('cancelled'); }}>Changer statut</Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>Annuler</Button>
          </Space>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {loading && orders.length === 0 ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : orders.length === 0 ? (
          <EmptyState icon="orders" title="Aucune commande" description={hasFilters ? 'Aucun résultat pour les filtres appliqués.' : 'Aucune commande pour le moment.'} actionLabel={hasFilters ? 'Réinitialiser' : undefined} onAction={hasFilters ? () => { setStatus('all'); setDriverId(null); setDateRange(null); setAmountMin(null); setAmountMax(null); setSearch(''); setPage(1); void load(); } : undefined} />
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={orders}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `${t} commande(s)`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps ?? 20);
              },
            }}
            scroll={{ x: 1000 }}
            onRow={(r) => ({
              onClick: (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('.ant-checkbox-wrapper') || target.closest('input[type=checkbox]') || target.closest('.ant-select')) return;
                if (updatingOrderId === r.id) return;
                if (Date.now() - statusChangeRef.current < 1500) return;
                setSelected(r);
                setDetailsOpen(true);
                void loadOrderDetails(r.id);
              },
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </Card>

      {/* Detail Drawer 80% */}
      <Drawer
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelected(null);
          setOrderDetails(null);
          // Clear URL parameter if present
          if (typeof window !== 'undefined' && window.location.search.includes('open=')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('open');
            window.history.replaceState({}, '', url.pathname);
          }
        }}
        title={selected ? `Commande ${selected.order_number || selected.id.slice(0, 8)}` : 'Détails'}
        size="large"
        styles={{ body: { paddingBottom: 80 } }}
        footer={
          orderDetails && orderDetails.status !== 'cancelled' ? (
            <Space wrap>
              <Button danger onClick={() => { setCancelOrderId(orderDetails.id); setCancelConfirmOpen(true); }} loading={statusUpdating}>Annuler la commande</Button>
              {orderDetails.status === 'pending' && <Button type="primary" onClick={() => handleStatusChange(orderDetails.id, 'confirmed')} loading={statusUpdating}>Confirmer</Button>}
              {orderDetails.status === 'confirmed' && <Button type="primary" onClick={() => handleStatusChange(orderDetails.id, 'processing')} loading={statusUpdating}>Préparation</Button>}
              {orderDetails.status === 'processing' && <Button type="primary" onClick={() => handleStatusChange(orderDetails.id, 'shipped')} loading={statusUpdating}>Expédier</Button>}
              {orderDetails.status === 'shipped' && <Button type="primary" onClick={() => handleStatusChange(orderDetails.id, 'delivered')} loading={statusUpdating}>Marquer livrée</Button>}
              <Button onClick={() => { setAssignDriverId(orderDetails.driver_id || null); setAssignOpen(true); }} icon={<TeamOutlined />}>Livreur</Button>
            </Space>
          ) : null
        }
      >
        {detailsLoading && !orderDetails ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : orderDetails ? (
          <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <OrderStatusBadge status={orderDetails.status} className="text-sm px-3 py-1" />
                <div className="text-slate-500 text-sm mt-1">Créée le {dayjs(orderDetails.created_at).format('DD/MM/YYYY HH:mm')}</div>
              </div>
              <Button icon={<CopyOutlined />} onClick={async () => { const ok = await copyToClipboard(orderDetails.id); message[ok ? 'success' : 'error'](ok ? 'ID copié' : 'Copie impossible'); }}>Copier ID</Button>
            </div>

            <Card size="small" title="Client & contact">
              <div className="font-semibold">{orderDetails.customer_name || '—'}</div>
              <div className="mt-1">{(orderDetails.customer_phone_profile || orderDetails.customer_phone) && <a href={`tel:${orderDetails.customer_phone_profile || orderDetails.customer_phone}`} className="text-indigo-600">{orderDetails.customer_phone_profile || orderDetails.customer_phone}</a>}</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {(() => {
                  const a = orderDetails.shipping_address;
                  if (typeof a === 'string') return a;
                  if (a && typeof a === 'object') {
                    return [a.street || a.address, a.district, a.city, orderDetails.shipping_country].filter(Boolean).join(', ');
                  }
                  return [orderDetails.shipping_city, orderDetails.shipping_district, orderDetails.shipping_country].filter(Boolean).join(', ') || '—';
                })()}
              </div>
            </Card>

            <Card size="small" title="Paiement">
              <Row gutter={[16, 8]}>
                <Col span={12}><span className="text-slate-500">Total</span><div className="font-bold text-lg">{Math.round(orderDetails.total_amount || 0).toLocaleString('fr-FR')} FCFA</div></Col>
                <Col span={12}><span className="text-slate-500">Méthode</span><div>{formatPaymentMethod((orderDetails as any).payment_method)}</div></Col>
                <Col span={12}><span className="text-slate-500">Statut paiement</span><div>{orderDetails.paid_at ? 'Payé' : 'En attente'}</div></Col>
              </Row>
            </Card>

            <Card size="small" title="Articles">
              {(() => {
                const items = orderDetails.order_items || (Array.isArray(orderDetails.items) ? orderDetails.items : []);
                if (!items.length) return <Typography.Text type="secondary">Aucun article</Typography.Text>;
                return (
                  <div className="space-y-3">
                    {items.map((item: any, idx: number) => (
                      <div key={item.id || idx} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                        <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                          {item.product_image ? <Image src={item.product_image} alt="" width={56} height={56} className="object-cover w-full h-full" /> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.product_name || `Article ${idx + 1}`}</div>
                          <div className="text-sm text-slate-500">× {item.quantity || 1} — {Math.round(Number(item.unit_price || 0)).toLocaleString('fr-FR')} FCFA/u</div>
                        </div>
                        <div className="font-semibold text-indigo-600">{Math.round(Number(item.total_price || (item.quantity || 1) * (item.unit_price || 0))).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                    ))}
                    <div className="pt-2 text-right font-bold">Total: {Math.round(orderDetails.total_amount || 0).toLocaleString('fr-FR')} FCFA</div>
                  </div>
                );
              })()}
            </Card>

            <Card size="small" title="Livraison">
              <div>{orderDetails.driver_name || orderDetails.driver_id ? `Livreur: ${orderDetails.driver_name || orderDetails.driver_id}` : 'Aucun livreur assigné'}</div>
              <div className="mt-2 text-sm text-slate-500">
                {orderDetails.paid_at && <div>Payé: {dayjs(orderDetails.paid_at).format('DD/MM HH:mm')}</div>}
                {(orderDetails as any).delivered_at && <div>Livrée: {dayjs((orderDetails as any).delivered_at).format('DD/MM HH:mm')}</div>}
                {(orderDetails as any).cancelled_at && <div className="text-red-600">Annulée: {dayjs((orderDetails as any).cancelled_at).format('DD/MM HH:mm')}</div>}
              </div>
            </Card>

            <Card size="small" title="Historique">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Créée</span><span className="text-slate-500">{dayjs(orderDetails.created_at).format('DD/MM/YYYY HH:mm:ss')}</span></div>
                {orderDetails.updated_at && <div className="flex justify-between"><span>Modifiée</span><span className="text-slate-500">{dayjs(orderDetails.updated_at).format('DD/MM/YYYY HH:mm:ss')}</span></div>}
                {orderDetails.paid_at && <div className="flex justify-between"><span>Payée</span><span className="text-green-600">{dayjs(orderDetails.paid_at).format('DD/MM/YYYY HH:mm:ss')}</span></div>}
                {(orderDetails as any).delivered_at && <div className="flex justify-between"><span>Livrée</span><span className="text-green-600">{dayjs((orderDetails as any).delivered_at).format('DD/MM/YYYY HH:mm:ss')}</span></div>}
                {(orderDetails as any).cancelled_at && <div className="flex justify-between"><span>Annulée</span><span className="text-red-600">{dayjs((orderDetails as any).cancelled_at).format('DD/MM/YYYY HH:mm:ss')}</span></div>}
              </div>
            </Card>
          </div>
        ) : null}
      </Drawer>

      {/* Assign driver modal (single or bulk) */}
      <Modal
        open={assignOpen}
        onCancel={() => { setAssignOpen(false); if (!selectedRowKeys.length) setSelected(null); }}
        title={selectedRowKeys.length > 0 ? `Assigner un livreur (${selectedRowKeys.length} commande(s))` : 'Assigner un livreur'}
        okText="Enregistrer"
        onOk={selectedRowKeys.length > 0 ? handleBulkAssign : async () => {
          if (!selected?.id) return;
          setAssigning(true);
          try {
            await assignOrderDriver(selected.id, assignDriverId);
            message.success('Livreur assigné');
            setAssignOpen(false);
            await loadOrderDetails(selected.id);
            void load();
          } catch (e: any) {
            message.error(e?.message || 'Erreur');
          } finally {
            setAssigning(false);
          }
        }}
        confirmLoading={assigning || bulkActionLoading}
      >
        <Select allowClear placeholder="Choisir un livreur" value={selectedRowKeys.length ? assignDriverId : (selected?.driver_id || assignDriverId)} onChange={setAssignDriverId} options={drivers} style={{ width: '100%' }} />
      </Modal>

      {/* Bulk status */}
      <Modal open={bulkStatusOpen} onCancel={() => { setBulkStatusOpen(false); setBulkStatusValue(null); }} title="Changer le statut" okText="Appliquer" onOk={handleBulkStatus} confirmLoading={bulkActionLoading}>
        <Select value={bulkStatusValue} onChange={setBulkStatusValue} options={ORDER_STATUS_OPTIONS} style={{ width: '100%' }} placeholder="Nouveau statut" />
      </Modal>

      {/* Cancel confirmation */}
      <Modal open={cancelConfirmOpen} onCancel={() => { setCancelConfirmOpen(false); setCancelOrderId(null); }} title="Annuler la commande" okText="Oui, annuler" onOk={handleCancelOrder} okButtonProps={{ danger: true }} confirmLoading={statusUpdating}>
        Êtes-vous sûr de vouloir annuler cette commande ?
      </Modal>

      <Modal open={!!imagePreview} onCancel={() => setImagePreview(null)} footer={null} title="Image" centered>
        {imagePreview && <Image src={imagePreview} alt="" width={800} height={600} className="w-full h-auto rounded" />}
      </Modal>
    </div>
  );
}
