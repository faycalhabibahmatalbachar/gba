'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { App, Badge, Button, Card, Col, DatePicker, Divider, Drawer, Input, Popconfirm, Row, Select, Skeleton, Space, Table, Tag, Timeline, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExportOutlined, EnvironmentOutlined, PhoneOutlined, ReloadOutlined, ShoppingOutlined, UserOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, DollarOutlined, CarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase/client';
import type { DeliveryOrderRow } from '@/lib/services/deliveries';
import {
  assignDriver,
  bulkAssignDriver,
  bulkUpdateDeliveryStatus,
  buildDestinationAddress,
  fetchDeliveries,
  fetchDeliveryKpis,
  updateDeliveryStatus,
} from '@/lib/services/deliveries';
import PageHeader from '@/components/ui/PageHeader';

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'Préparation',
  shipped: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

type DriverOption = { label: string; value: string };

function statusColor(v: string) {
  const s = (v || '').toLowerCase();
  if (s === 'delivered') return 'green';
  if (s === 'cancelled') return 'red';
  if (s === 'shipped') return 'blue';
  if (s === 'processing') return 'gold';
  if (s === 'confirmed') return 'cyan';
  return 'default';
}

function paymentBadge(o: DeliveryOrderRow) {
  if (o.paid_at) return <Tag color="green">Payé</Tag>;
  return <Tag>Non payé</Tag>;
}

export default function DeliveriesPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [rows, setRows] = useState<DeliveryOrderRow[]>([]);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [driverId, setDriverId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkDriverId, setBulkDriverId] = useState<string | undefined>(undefined);
  const [bulkStatus, setBulkStatus] = useState<string | undefined>(undefined);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [active, setActive] = useState<DeliveryOrderRow | null>(null);

  const [kpis, setKpis] = useState({ today: 0, inProgress: 0, late: 0, delivered: 0, cancelled: 0 });

  const dateFromIso = useMemo(() => (dateRange[0] ? dateRange[0].startOf('day').toISOString() : undefined), [dateRange]);
  const dateToIso = useMemo(() => (dateRange[1] ? dateRange[1].endOf('day').toISOString() : undefined), [dateRange]);

  const load = async (opts?: { resetPage?: boolean }) => {
    setLoading(true);
    try {
      const nextPage = opts?.resetPage ? 1 : page;
      const res = await fetchDeliveries({
        page: nextPage,
        pageSize,
        status,
        search,
        driverId,
        dateFrom: dateFromIso,
        dateTo: dateToIso,
      });
      setRows(res.data);
      setTotal(res.count);
      if (opts?.resetPage) setPage(1);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const loadKpis = async () => {
    setKpiLoading(true);
    try {
      const res = await fetchDeliveryKpis({ dateFrom: dateFromIso, dateTo: dateToIso, lateHours: 6 });
      setKpis(res);
    } catch (e: any) {
      message.error(e?.message || 'Erreur KPI');
    } finally {
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    void load({ resetPage: true });
    void loadKpis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, driverId, dateFromIso, dateToIso, pageSize]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load({ resetPage: true });
      void loadKpis();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('role', 'driver')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return;
        const opts = (data || []).map((d: any) => {
          const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email || d.id;
          return { value: d.id, label: name };
        });
        setDrivers(opts);
      });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('deliveries-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const next: any = payload.new;
        const id = String(next?.id || '');
        if (!id) return;
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.id === id);
          if (idx === -1) return prev;
          const patched = { ...prev[idx], ...next };
          const out = [...prev];
          out[idx] = patched;
          return out;
        });
        void loadKpis();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        void load({ resetPage: true });
        void loadKpis();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, driverId, dateFromIso, dateToIso]);

  const columns: ColumnsType<DeliveryOrderRow> = [
    {
      title: 'Commande',
      key: 'order',
      width: 130,
      render: (_v, r) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.order_number || r.id.slice(0, 8)}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</div>
        </div>
      ),
    },
    {
      title: 'Client',
      key: 'client',
      render: (_v, r) => (
        <div style={{ maxWidth: 220 }}>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.customer_name || '—'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.customer_phone_profile || r.customer_phone || ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Adresse',
      key: 'addr',
      responsive: ['lg'],
      render: (_v, r) => (
        <span style={{ fontSize: 12, opacity: 0.8 }}>{buildDestinationAddress(r) || '—'}</span>
      ),
    },
    {
      title: 'Paiement',
      key: 'payment',
      width: 160,
      responsive: ['md'],
      render: (_v, r) => (
        <div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{r.payment_provider || '—'}</div>
          <div>{paymentBadge(r)}</div>
        </div>
      ),
    },
    {
      title: 'Livreur',
      key: 'driver',
      width: 170,
      render: (_v, r) => (
        <Select
          size="small"
          value={r.driver_id || undefined}
          allowClear
          placeholder="Non assigné"
          style={{ width: 160 }}
          options={drivers}
          onChange={async (v) => {
            const prev = r.driver_id;
            setRows((cur) => cur.map((it) => (it.id === r.id ? { ...it, driver_id: v || null } : it)));
            try {
              await assignDriver(r.id, v || null);
              message.success('Assigné');
              void loadKpis();
            } catch (e: any) {
              setRows((cur) => cur.map((it) => (it.id === r.id ? { ...it, driver_id: prev } : it)));
              message.error(e?.message || 'Erreur');
            }
          }}
        />
      ),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 150,
      render: (_v, r) => {
        const v = (r.status || 'pending').toLowerCase();
        return (
          <div>
            <Tag color={statusColor(v)} style={{ marginBottom: 6 }}>{STATUS_LABELS[v] || v}</Tag>
          <Select
            size="small"
            value={v}
            style={{ width: 130 }}
            options={Object.keys(STATUS_LABELS).map((k) => ({ value: k, label: STATUS_LABELS[k] }))}
            onChange={async (next) => {
              const prev = r.status;
              setRows((cur) => cur.map((it) => (it.id === r.id ? { ...it, status: next } : it)));
              try {
                await updateDeliveryStatus(r.id, next);
                message.success('Statut mis à jour');
                void loadKpis();
              } catch (e: any) {
                setRows((cur) => cur.map((it) => (it.id === r.id ? { ...it, status: prev } : it)));
                message.error(e?.message || 'Erreur');
              }
            }}
          />
          </div>
        );
      },
    },
    {
      title: 'Total',
      key: 'total',
      align: 'right',
      width: 140,
      render: (_v, r) => (
        <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{Number(r.total_amount || 0).toFixed(0)} FCFA</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 200,
      render: (_v, r) => {
        const trackUrl = `/delivery-tracking?driverId=${encodeURIComponent(String(r.driver_id || ''))}&orderId=${encodeURIComponent(String(r.id || ''))}`;
        const canTrack = !!r.id && !!r.driver_id;
        return (
          <Space>
            <Tooltip title={canTrack ? 'Suivi GPS' : 'Assigner un livreur pour activer le suivi'}>
              <Button
                size="small"
                icon={<EnvironmentOutlined />}
                disabled={!canTrack}
                onClick={() => {
                  if (!canTrack) return;
                  window.location.href = trackUrl;
                }}
              />
            </Tooltip>

            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={() => {
                setActive(r);
                setDetailsOpen(true);
              }}
            />
          </Space>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const selectedIds = useMemo(() => selectedRowKeys.map((k) => String(k)), [selectedRowKeys]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Livraisons"
        subtitle="Suivi et assignation"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            Actualiser
          </Button>
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={5}>
          <Card>
            {kpiLoading ? <Skeleton active paragraph={false} /> : (
              <>
                <div className="text-xs text-gray-500">Livraisons aujourd’hui</div>
                <div className="text-2xl font-extrabold">{kpis.today}</div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card>
            {kpiLoading ? <Skeleton active paragraph={false} /> : (
              <>
                <div className="text-xs text-gray-500">En cours</div>
                <div className="text-2xl font-extrabold">{kpis.inProgress}</div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card>
            {kpiLoading ? <Skeleton active paragraph={false} /> : (
              <>
                <div className="text-xs text-gray-500">Retards</div>
                <div className="text-2xl font-extrabold">{kpis.late}</div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card>
            {kpiLoading ? <Skeleton active paragraph={false} /> : (
              <>
                <div className="text-xs text-gray-500">Livrées</div>
                <div className="text-2xl font-extrabold">{kpis.delivered}</div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card>
            {kpiLoading ? <Skeleton active paragraph={false} /> : (
              <>
                <div className="text-xs text-gray-500">Annulées</div>
                <div className="text-2xl font-extrabold">{kpis.cancelled}</div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
          <Input placeholder="Rechercher (numéro / client)" value={search} onChange={e => setSearch(e.target.value)} allowClear />
          <Select
            value={status}
            style={{ minWidth: 200 }}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              ...Object.keys(STATUS_LABELS).map((k) => ({ value: k, label: STATUS_LABELS[k] })),
            ]}
          />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={driverId}
              allowClear
              placeholder="Filtrer par livreur"
              style={{ minWidth: 240 }}
              options={drivers}
              onChange={(v) => setDriverId(v)}
            />
            <DatePicker.RangePicker
              value={dateRange as any}
              onChange={(v) => setDateRange((v || [null, null]) as any)}
              style={{ minWidth: 260 }}
              allowClear
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            <Badge count={selectedRowKeys.length} showZero /> sélection(s)
          </div>
          <Space wrap>
            <Select
              value={bulkStatus}
              allowClear
              placeholder="Action: changer statut"
              style={{ width: 220 }}
              options={Object.keys(STATUS_LABELS).map((k) => ({ value: k, label: STATUS_LABELS[k] }))}
              onChange={(v) => setBulkStatus(v)}
            />
            <Popconfirm
              title="Appliquer le statut aux livraisons sélectionnées ?"
              okText="Appliquer"
              cancelText="Annuler"
              onConfirm={async () => {
                if (!bulkStatus || !selectedIds.length) return;
                const prev = rows;
                setRows((cur) => cur.map((it) => (selectedIds.includes(it.id) ? { ...it, status: bulkStatus } : it)));
                try {
                  await bulkUpdateDeliveryStatus(selectedIds, bulkStatus);
                  message.success('Statut appliqué');
                  setSelectedRowKeys([]);
                  void loadKpis();
                } catch (e: any) {
                  setRows(prev);
                  message.error(e?.message || 'Erreur');
                }
              }}
              disabled={!bulkStatus || !selectedIds.length}
            >
              <Button disabled={!bulkStatus || !selectedIds.length}>Appliquer statut</Button>
            </Popconfirm>

            <Select
              value={bulkDriverId}
              allowClear
              placeholder="Action: réassigner livreur"
              style={{ width: 240 }}
              options={drivers}
              onChange={(v) => setBulkDriverId(v)}
            />
            <Popconfirm
              title="Réassigner le livreur pour les livraisons sélectionnées ?"
              okText="Réassigner"
              cancelText="Annuler"
              onConfirm={async () => {
                if (!selectedIds.length) return;
                const prev = rows;
                setRows((cur) => cur.map((it) => (selectedIds.includes(it.id) ? { ...it, driver_id: bulkDriverId || null } : it)));
                try {
                  await bulkAssignDriver(selectedIds, bulkDriverId || null);
                  message.success('Livreur réassigné');
                  setSelectedRowKeys([]);
                  void loadKpis();
                } catch (e: any) {
                  setRows(prev);
                  message.error(e?.message || 'Erreur');
                }
              }}
              disabled={!selectedIds.length}
            >
              <Button disabled={!selectedIds.length}>Réassigner</Button>
            </Popconfirm>
          </Space>
        </div>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={rowSelection as any}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              if (ps !== pageSize) setPageSize(ps);
            },
            showSizeChanger: true,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Drawer
        title={null}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setActive(null);
        }}
        size="large"
        styles={{ body: { padding: 0 } }}
      >
        {active ? (
          <div>
            {/* Header with gradient */}
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white/70 text-xs font-medium">Commande</div>
                  <div className="text-white text-xl font-bold mt-0.5">{active.order_number || active.id.slice(0, 8)}</div>
                  <div className="text-white/60 text-xs mt-1">{dayjs(active.created_at).format('DD/MM/YYYY à HH:mm')}</div>
                </div>
                <Tag
                  color={statusColor(String(active.status || 'pending'))}
                  style={{ fontSize: 13, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}
                >
                  {STATUS_LABELS[String((active.status || 'pending')).toLowerCase()] || String(active.status || 'pending')}
                </Tag>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="bg-white/15 rounded-xl px-4 py-2">
                  <div className="text-white/60 text-xs">Total</div>
                  <div className="text-white font-bold text-lg">{Number(active.total_amount || 0).toLocaleString('fr-FR')} FCFA</div>
                </div>
                <div className="bg-white/15 rounded-xl px-4 py-2">
                  <div className="text-white/60 text-xs">Paiement</div>
                  <div className="text-white font-semibold">{active.paid_at ? '✓ Payé' : 'Non payé'}</div>
                </div>
                <div className="bg-white/15 rounded-xl px-4 py-2">
                  <div className="text-white/60 text-xs">Articles</div>
                  <div className="text-white font-semibold">{active.total_items ?? (Array.isArray(active.items) ? active.items.length : 0)}</div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Client */}
              <Card
                size="small"
                styles={{ body: { padding: 16 } }}
                title={<span className="flex items-center gap-2"><UserOutlined className="text-indigo-500" /> Client</span>}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-base">{active.customer_name || '—'}</div>
                    {(active.customer_phone_profile || active.customer_phone) && (
                      <a
                        href={`tel:${active.customer_phone_profile || active.customer_phone}`}
                        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 mt-1 text-sm"
                      >
                        <PhoneOutlined /> {active.customer_phone_profile || active.customer_phone}
                      </a>
                    )}
                  </div>
                </div>
                {buildDestinationAddress(active) && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-slate-500">
                    <EnvironmentOutlined className="mt-0.5 text-slate-400" />
                    <span>{buildDestinationAddress(active)}</span>
                  </div>
                )}
              </Card>

              {/* Driver */}
              <Card
                size="small"
                styles={{ body: { padding: 16 } }}
                title={<span className="flex items-center gap-2"><CarOutlined className="text-indigo-500" /> Livreur</span>}
              >
                {active.driver_name ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{active.driver_name}</div>
                      {active.driver_phone && (
                        <a
                          href={`tel:${active.driver_phone}`}
                          className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 mt-1 text-sm"
                        >
                          <PhoneOutlined /> {active.driver_phone}
                        </a>
                      )}
                    </div>
                    <Tag color="blue">Assigné</Tag>
                  </div>
                ) : (
                  <div className="text-slate-400 italic">Aucun livreur assigné</div>
                )}
              </Card>

              {/* Payment */}
              <Card
                size="small"
                styles={{ body: { padding: 16 } }}
                title={<span className="flex items-center gap-2"><DollarOutlined className="text-indigo-500" /> Paiement</span>}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="font-bold text-lg">{Number(active.total_amount || 0).toLocaleString('fr-FR')} FCFA</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Méthode</div>
                    <div className="font-medium">{active.payment_provider || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Statut</div>
                    <div>{active.paid_at ? <Tag color="green">Payé</Tag> : <Tag color="orange">Non payé</Tag>}</div>
                  </div>
                  {active.paid_at && (
                    <div>
                      <div className="text-xs text-slate-500">Payé le</div>
                      <div className="text-sm">{dayjs(active.paid_at).format('DD/MM/YYYY HH:mm')}</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Articles */}
              <Card
                size="small"
                styles={{ body: { padding: 16 } }}
                title={<span className="flex items-center gap-2"><ShoppingOutlined className="text-indigo-500" /> Articles</span>}
              >
                {(() => {
                  const items = Array.isArray(active.items) ? active.items : [];
                  if (!items.length) return <Typography.Text type="secondary">Aucun article</Typography.Text>;
                  return (
                    <div className="space-y-3">
                      {items.map((item: any, idx: number) => (
                        <div key={item.id || idx} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                            {item.product_image ? (
                              <Image src={item.product_image} alt="" width={56} height={56} className="object-cover w-full h-full" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.product_name || `Article ${idx + 1}`}</div>
                            <div className="text-sm text-slate-500">× {item.quantity || 1} — {Math.round(Number(item.unit_price || 0)).toLocaleString('fr-FR')} FCFA/u</div>
                          </div>
                          <div className="font-semibold text-indigo-600 whitespace-nowrap">
                            {Math.round(Number(item.total_price || (item.quantity || 1) * (item.unit_price || 0))).toLocaleString('fr-FR')} FCFA
                          </div>
                        </div>
                      ))}
                      <Divider style={{ margin: '8px 0' }} />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{items.reduce((s: number, i: any) => s + Number(i.quantity || 1), 0)} article(s)</span>
                        <span className="font-bold text-base">{Number(active.total_amount || 0).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>
                  );
                })()}
              </Card>

              {/* Timeline */}
              <Card
                size="small"
                styles={{ body: { padding: 16 } }}
                title={<span className="flex items-center gap-2"><ClockCircleOutlined className="text-indigo-500" /> Historique</span>}
              >
                <Timeline
                  items={[
                    ...(active.created_at ? [{
                      color: 'blue' as const,
                      children: (
                        <div className="flex justify-between">
                          <span className="font-medium">Créée</span>
                          <span className="text-slate-500 text-sm">{dayjs(active.created_at).format('DD/MM/YYYY HH:mm:ss')}</span>
                        </div>
                      ),
                    }] : []),
                    ...(active.updated_at && active.updated_at !== active.created_at ? [{
                      color: 'gray' as const,
                      children: (
                        <div className="flex justify-between">
                          <span className="font-medium">Modifiée</span>
                          <span className="text-slate-500 text-sm">{dayjs(active.updated_at).format('DD/MM/YYYY HH:mm:ss')}</span>
                        </div>
                      ),
                    }] : []),
                    ...(active.paid_at ? [{
                      color: 'green' as const,
                      dot: <CheckCircleOutlined />,
                      children: (
                        <div className="flex justify-between">
                          <span className="font-medium text-green-600">Payée</span>
                          <span className="text-slate-500 text-sm">{dayjs(active.paid_at).format('DD/MM/YYYY HH:mm:ss')}</span>
                        </div>
                      ),
                    }] : []),
                    ...(active.delivered_at ? [{
                      color: 'green' as const,
                      dot: <CheckCircleOutlined />,
                      children: (
                        <div className="flex justify-between">
                          <span className="font-medium text-green-600">Livrée</span>
                          <span className="text-slate-500 text-sm">{dayjs(active.delivered_at).format('DD/MM/YYYY HH:mm:ss')}</span>
                        </div>
                      ),
                    }] : []),
                    ...(active.cancelled_at ? [{
                      color: 'red' as const,
                      dot: <CloseCircleOutlined />,
                      children: (
                        <div className="flex justify-between">
                          <span className="font-medium text-red-600">Annulée</span>
                          <span className="text-slate-500 text-sm">{dayjs(active.cancelled_at).format('DD/MM/YYYY HH:mm:ss')}</span>
                        </div>
                      ),
                    }] : []),
                  ]}
                />
              </Card>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
