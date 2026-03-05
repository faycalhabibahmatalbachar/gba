'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { App, Badge, Button, Card, Col, DatePicker, Drawer, Input, Popconfirm, Row, Select, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExportOutlined, EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase/client';
import type { DeliveryOrderRow } from '@/lib/services/deliveries';
import {
  assignDriver,
  bulkAssignDriver,
  bulkUpdateDeliveryStatus,
  buildDestinationAddress,
  buildGoogleMapsDirectionsUrl,
  buildOsmUrl,
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
        const g = buildGoogleMapsDirectionsUrl(r);
        const o = buildOsmUrl(r);
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

            <Tooltip title="OSM">
              <Button size="small" disabled={!o} onClick={() => o && window.open(o, '_blank', 'noopener')}>
                OSM
              </Button>
            </Tooltip>

            <Tooltip title="Google Maps">
              <Button size="small" disabled={!g} onClick={() => g && window.open(g, '_blank', 'noopener')}>
                Maps
              </Button>
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
        title={active ? `Commande ${active.order_number || active.id.slice(0, 8)}` : 'Détails'}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setActive(null);
        }}
        size="large"
        styles={{ body: { padding: 16 } }}
      >
        {active ? (
          <div className="space-y-3">
            <Card size="small" title="Client">
              <div className="font-semibold">{active.customer_name || '—'}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{active.customer_phone_profile || active.customer_phone || '—'}</div>
            </Card>
            <Card size="small" title="Livraison">
              <div className="flex items-center justify-between">
                <div>Statut</div>
                <Tag color={statusColor(String(active.status || 'pending'))}>{STATUS_LABELS[String((active.status || 'pending')).toLowerCase()] || String(active.status || 'pending')}</Tag>
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                <div>Total</div>
                <div style={{ fontWeight: 800 }}>{Number(active.total_amount || 0).toFixed(0)} FCFA</div>
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                <div>Paiement</div>
                <div>{paymentBadge(active)}</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>{buildDestinationAddress(active) || '—'}</div>
            </Card>
            <Card size="small" title="Livreur">
              <div className="font-semibold">{active.driver_name || 'Non assigné'}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{active.driver_phone || ''}</div>
            </Card>
            <Card size="small" title="Articles">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.85, margin: 0 }}>{JSON.stringify(active.items || [], null, 2)}</pre>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
