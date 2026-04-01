'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Drawer, Input, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, PhoneOutlined, EyeOutlined, EnvironmentOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '@/components/ui/PageHeader';
import { translateOrderStatus } from '@/lib/i18n/translations';

type DriverRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  city?: string | null;
  is_available?: boolean | null;
};

export default function DriversPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', city: '' });
  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [driverOrders, setDriverOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', city: '' });

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('profiles')
        .select('id, email, first_name, last_name, phone, city, is_available')
        .eq('role', 'driver')
        .order('created_at', { ascending: false })
        .limit(200);

      if (search.trim()) {
        const s = search.trim();
        q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setRows((data || []) as DriverRow[]);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const loadDriverOrders = async (driverId: string) => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, customer_name, created_at')
        .eq('driver_id', driverId)
        .in('status', ['confirmed', 'processing', 'shipped'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDriverOrders(data || []);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement commandes');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleEdit = (driver: DriverRow) => {
    setSelectedDriver(driver);
    setEditForm({
      firstName: driver.first_name || '',
      lastName: driver.last_name || '',
      phone: driver.phone || '',
      city: driver.city || '',
    });
    setEditOpen(true);
  };

  const handleDelete = (driver: DriverRow) => {
    Modal.confirm({
      title: 'Confirmer la suppression',
      content: `Êtes-vous sûr de vouloir supprimer le livreur ${driver.first_name || ''} ${driver.last_name || ''} ?`,
      okText: 'Supprimer',
      okType: 'danger',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          const { error } = await supabase.from('profiles').delete().eq('id', driver.id);
          if (error) throw error;
          message.success('Livreur supprimé');
          void load();
        } catch (e: any) {
          message.error(e?.message || 'Erreur lors de la suppression');
        }
      },
    });
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const columns: ColumnsType<DriverRow> = useMemo(() => [
    {
      title: 'Livreur',
      key: 'driver',
      render: (_v, r) => {
        const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—';
        return (
          <div style={{ maxWidth: 280 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.email || ''}</div>
          </div>
        );
      },
    },
    {
      title: 'Téléphone',
      dataIndex: 'phone',
      key: 'phone',
      width: 160,
      responsive: ['md'],
      render: (v) => <span style={{ fontSize: 12, opacity: 0.85 }}>{v || '—'}</span>,
    },
    {
      title: 'Ville',
      dataIndex: 'city',
      key: 'city',
      width: 140,
      responsive: ['lg'],
      render: (v) => <span style={{ fontSize: 12, opacity: 0.85 }}>{v || '—'}</span>,
    },
    {
      title: 'Disponibilité',
      key: 'avail',
      width: 160,
      render: (_v, r) => (
        <Space>
          <Switch
            checked={!!r.is_available}
            onChange={async (checked) => {
              try {
                const { error } = await supabase
                  .from('profiles')
                  .update({ is_available: checked })
                  .eq('id', r.id);
                if (error) throw error;
                setRows(prev => prev.map(x => x.id === r.id ? { ...x, is_available: checked } : x));
              } catch (e: any) {
                message.error(e?.message || 'Erreur');
              }
            }}
          />
          {r.is_available ? <Tag color="green">Disponible</Tag> : <Tag>Indispo</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_v, r) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => {
              setSelectedDriver(r);
              setDetailsOpen(true);
            }}
          >
            Détails
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(r)}
          >
            Modifier
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleDelete(r)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ], [rows]);

  useEffect(() => {
    if (selectedDriver && detailsOpen) {
      void loadDriverOrders(selectedDriver.id);
    }
  }, [selectedDriver, detailsOpen]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Livreurs"
        subtitle="Gestion des livreurs"
        extra={
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateOpen(true)}>Créer</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button>
          </Space>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <Card styles={{ body: { padding: 16 } }}>
          <div className="flex items-center gap-2">
            <TeamOutlined style={{ fontSize: 24, color: '#6366F1' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Total livreurs</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-heading)' }}>{rows.length}</div>
            </div>
          </div>
        </Card>
        <Card styles={{ body: { padding: 16 } }}>
          <div className="flex items-center gap-2">
            <CheckCircleOutlined style={{ fontSize: 24, color: '#10B981' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Disponibles</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#10B981', fontFamily: 'var(--font-heading)' }}>{rows.filter(r => r.is_available).length}</div>
            </div>
          </div>
        </Card>
        <Card styles={{ body: { padding: 16 } }}>
          <div className="flex items-center gap-2">
            <CloseCircleOutlined style={{ fontSize: 24, color: '#EF4444' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Indisponibles</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#EF4444', fontFamily: 'var(--font-heading)' }}>{rows.filter(r => !r.is_available).length}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <Input placeholder="Rechercher (nom, email, téléphone)" value={search} onChange={e => setSearch(e.target.value)} allowClear />
      </Card>

      <Card>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 20 }} scroll={{ x: 900 }} />
      </Card>

      <Modal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        title="Créer un livreur"
        okText="Créer"
        cancelText="Annuler"
        confirmLoading={creating}
        onOk={async () => {
          setCreating(true);
          try {
            // Validate required fields
            if (!form.email || !form.password) {
              message.error('Email et mot de passe sont requis');
              setCreating(false);
              return;
            }

            if (form.password.length < 6) {
              message.error('Le mot de passe doit contenir au moins 6 caractères');
              setCreating(false);
              return;
            }

            // Save admin session before signUp (signUp switches active session)
            const { data: { session: adminSession } } = await supabase.auth.getSession();

            // Create auth user with signUp
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: form.email,
              password: form.password,
              options: {
                data: {
                  first_name: form.firstName,
                  last_name: form.lastName,
                  role: 'driver',
                },
              },
            });

            if (authError) throw authError;

            const userId = authData?.user?.id;

            // Upsert profile BEFORE restoring admin session
            // The driver's freshly created JWT is active — they can write their own profile row
            if (userId) {
              await new Promise(r => setTimeout(r, 200)); // let Supabase process the new user
              const { error: upsertError } = await supabase.from('profiles').upsert({
                id: userId,
                email: form.email,
                first_name: form.firstName,
                last_name: form.lastName,
                phone: form.phone,
                city: form.city,
                role: 'driver',
                is_available: true,
              });
              if (upsertError) console.warn('Profile upsert warning:', upsertError.message);
            }

            // Restore admin session AFTER profile upsert
            if (adminSession) {
              await supabase.auth.setSession({
                access_token: adminSession.access_token,
                refresh_token: adminSession.refresh_token,
              });
            }

            message.success('Livreur créé avec succès');
            setCreateOpen(false);
            setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', city: '' });
            void load();
          } catch (e: any) {
            console.error('Create driver error:', e);
            message.error(e?.message || 'Erreur lors de la création');
            // Try to restore admin session on error too
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) window.location.reload();
            } catch (_) {}
          } finally {
            setCreating(false);
          }
        }}
      >
        <div className="space-y-3">
          <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input.Password placeholder="Mot de passe" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <Input placeholder="Prénom" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          <Input placeholder="Nom" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          <Input placeholder="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input placeholder="Ville" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        </div>
      </Modal>
      <Modal
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        title="Modifier le livreur"
        okText="Enregistrer"
        cancelText="Annuler"
        confirmLoading={editLoading}
        onOk={async () => {
          if (!selectedDriver) return;
          setEditLoading(true);
          try {
            const { error } = await supabase
              .from('profiles')
              .update({
                first_name: editForm.firstName,
                last_name: editForm.lastName,
                phone: editForm.phone,
                city: editForm.city,
              })
              .eq('id', selectedDriver.id);
            if (error) throw error;
            message.success('Livreur mis à jour');
            setEditOpen(false);
            void load();
          } catch (e: any) {
            message.error(e?.message || 'Erreur lors de la mise à jour');
          } finally {
            setEditLoading(false);
          }
        }}
      >
        <div className="space-y-3">
          <Input placeholder="Prénom" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
          <Input placeholder="Nom" value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
          <Input placeholder="Téléphone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          <Input placeholder="Ville" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
        </div>
      </Modal>

      <Drawer
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={selectedDriver ? `${selectedDriver.first_name || ''} ${selectedDriver.last_name || ''}`.trim() || 'Détails livreur' : 'Détails'}
        size="large"
      >
        {selectedDriver && (
          <div className="space-y-4">
            <Card>
              <div className="space-y-2">
                <div style={{ fontSize: 14, color: 'var(--text-1)' }}><span style={{ fontWeight: 600 }}>Email:</span> {selectedDriver.email || '—'}</div>
                <div style={{ fontSize: 14, color: 'var(--text-1)' }}><span style={{ fontWeight: 600 }}>Téléphone:</span> {selectedDriver.phone || '—'}</div>
                <div style={{ fontSize: 14, color: 'var(--text-1)' }}><span style={{ fontWeight: 600 }}>Ville:</span> {selectedDriver.city || '—'}</div>
                <div style={{ fontSize: 14, color: 'var(--text-1)' }}>
                  <span style={{ fontWeight: 600 }}>Disponibilité:</span>{' '}
                  {selectedDriver.is_available ? (
                    <Tag color="green">Disponible</Tag>
                  ) : (
                    <Tag>Indisponible</Tag>
                  )}
                </div>
              </div>
            </Card>

            <Card title={<span style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>Commandes actives</span>} loading={loadingOrders}>
              {driverOrders.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Aucune commande active</div>
              ) : (
                <div className="space-y-2">
                  {driverOrders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center p-2 rounded" style={{ background: 'var(--bg-elevated)' }}>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-1)' }}>{order.order_number || order.id.slice(0, 8)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{order.customer_name || '—'}</div>
                      </div>
                      <Space>
                        <Tag color={order.status === 'shipped' ? 'blue' : order.status === 'confirmed' ? 'green' : 'orange'}>
                          {translateOrderStatus(order.status)}
                        </Tag>
                        <Link href={`/orders?open=${order.id}`}>
                          <Button size="small" icon={<EyeOutlined />}>Voir</Button>
                        </Link>
                      </Space>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Space wrap>
              <Link href={`/delivery-tracking?driverId=${selectedDriver.id}`}>
                <Button type="primary" icon={<EnvironmentOutlined />}>Tracker en temps réel</Button>
              </Link>
              {selectedDriver.phone && (
                <a href={`tel:${selectedDriver.phone}`}>
                  <Button icon={<PhoneOutlined />}>Appeler</Button>
                </a>
              )}
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  );
}
