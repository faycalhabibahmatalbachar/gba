'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Avatar, Button, Card, Dropdown, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CopyOutlined, EyeOutlined, MoreOutlined, UserOutlined, TeamOutlined, CarOutlined, CrownOutlined,
  LockOutlined, UnlockOutlined, KeyOutlined, SwapOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import type { ProfileRow } from '@/lib/services/users';
import { fetchUsers, fetchUsersKpis, type UsersKpis } from '@/lib/services/users';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '@/components/ui/PageHeader';

const EMPTY = 'Non renseigné';
const NA = 'Non applicable';

export default function UsersPage() {
  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<UsersKpis | null>(null);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkRole, setBulkRole] = useState<'user' | 'driver' | 'admin'>('user');
  const [bulkAvail, setBulkAvail] = useState<boolean>(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, k] = await Promise.all([fetchUsers({ page, pageSize, search, role }), fetchUsersKpis()]);
      setRows(res.data);
      setTotal(res.count);
      setKpis(k);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, role, message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSelectedRowKeys([]);
  }, [role, search]);

  const doBulkUpdate = async (patch: { role?: string; is_available?: boolean }, successMsg: string) => {
    const ids = selectedRowKeys.map(String).filter(Boolean);
    if (!ids.length) return;

    modal.confirm({
      title: 'Confirmer l\'action',
      content: `Appliquer cette action à ${ids.length} utilisateur(s) ?`,
      okText: 'Appliquer',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          const { error } = await supabase.from('profiles').update(patch).in('id', ids);
          if (error) throw error;
          message.success(successMsg);
          setSelectedRowKeys([]);
          void load();
        } catch (e: any) {
          message.error(e?.message || 'Erreur');
        }
      },
    });
  };

  const copyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    message.success('Téléphone copié');
  };

  // ── Per-row actions ───────────────────────────────────────────────
  const handleRowChangeRole = useCallback((r: ProfileRow) => {
    let newRole = r.role || 'user';
    modal.confirm({
      title: `Changer le rôle de ${r.first_name || r.email || 'cet utilisateur'}`,
      icon: <SwapOutlined />,
      content: (
        <div style={{ marginTop: 12 }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Rôle actuel : <Tag color={r.role === 'admin' ? 'purple' : r.role === 'driver' ? 'blue' : 'default'}>{r.role || 'user'}</Tag>
          </Typography.Text>
          <Select
            defaultValue={r.role || 'user'}
            onChange={(v) => { newRole = v; }}
            style={{ width: '100%' }}
            options={[
              { value: 'user', label: '👤 Client' },
              { value: 'driver', label: '🚗 Livreur' },
              { value: 'admin', label: '👑 Administrateur' },
            ]}
          />
        </div>
      ),
      okText: 'Appliquer',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', r.id);
          if (error) throw error;
          message.success(`Rôle mis à jour → ${newRole}`);
          void load();
        } catch (e: any) {
          message.error(e?.message || 'Erreur');
          throw e;
        }
      },
    });
  }, [message, load]);

  const handleRowSuspend = useCallback((r: ProfileRow) => {
    if (r.is_suspended) {
      modal.confirm({
        title: 'Réactiver cet utilisateur ?',
        content: 'Le compte sera réactivé immédiatement.',
        okText: 'Réactiver',
        cancelText: 'Annuler',
        onOk: async () => {
          try {
            const { error } = await supabase.from('profiles').update({
              is_suspended: false,
              suspended_at: null,
              suspended_by: null,
              suspension_reason: null,
            }).eq('id', r.id);
            if (error) throw error;
            message.success('Compte réactivé');
            void load();
          } catch (e: any) {
            message.error(e?.message || 'Erreur');
            throw e;
          }
        },
      });
    } else {
      modal.confirm({
        title: 'Suspendre cet utilisateur ?',
        icon: <LockOutlined />,
        content: "L'utilisateur sera bloqué et ne pourra plus utiliser l'application.",
        okText: 'Suspendre',
        okType: 'danger',
        cancelText: 'Annuler',
        onOk: async () => {
          try {
            const { data: { user: adminUser } } = await supabase.auth.getUser();
            const { error } = await supabase.from('profiles').update({
              is_suspended: true,
              suspended_at: new Date().toISOString(),
              suspended_by: adminUser?.id || null,
              suspension_reason: 'Suspension par administrateur',
            }).eq('id', r.id);
            if (error) throw error;
            message.success('Utilisateur suspendu');
            void load();
          } catch (e: any) {
            message.error(e?.message || 'Erreur');
            throw e;
          }
        },
      });
    }
  }, [message, load]);

  const handleRowPasswordReset = useCallback((r: ProfileRow) => {
    if (!r.email) {
      message.error('Aucun email associé à cet utilisateur');
      return;
    }
    modal.confirm({
      title: 'Réinitialiser le mot de passe',
      icon: <KeyOutlined />,
      content: (
        <div>
          <p>Envoyer un lien de réinitialisation à :</p>
          <Typography.Text strong>{r.email}</Typography.Text>
        </div>
      ),
      okText: 'Envoyer',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(r.email!, {
            redirectTo: `${window.location.origin}/login`,
          });
          if (error) throw error;
          message.success('Email de réinitialisation envoyé');
        } catch (e: any) {
          message.error(e?.message || 'Erreur');
          throw e;
        }
      },
    });
  }, [message]);

  const roleLabel = (r?: string | null) => {
    const v = (r || 'user').toLowerCase();
    if (v === 'admin') return 'Administrateur';
    if (v === 'driver') return 'Livreur';
    return 'Client';
  };

  const roleColor = (r?: string | null) => {
    const v = (r || 'user').toLowerCase();
    if (v === 'admin') return 'purple';
    if (v === 'driver') return 'blue';
    return 'default';
  };

  const statusLabel = (r?: ProfileRow) => {
    if (r?.is_suspended) return { label: 'Suspendu', color: 'orange' };
    return { label: 'Actif', color: 'green' };
  };

  const columns: ColumnsType<ProfileRow> = [
    {
      title: 'Utilisateur',
      key: 'user',
      width: 260,
      render: (_v, r) => {
        const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || EMPTY;
        return (
          <div className="flex items-center gap-3">
            <Avatar size={40} src={r.avatar_url || undefined} className="shrink-0">
              {String(name).slice(0, 1).toUpperCase() || <UserOutlined />}
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold truncate">{name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{r.email || EMPTY}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Contact',
      key: 'phone',
      width: 160,
      responsive: ['md'],
      render: (_v, r) => (
        <div className="flex items-center gap-2">
          <span className="text-sm">{r.phone || EMPTY}</span>
          {r.phone && (
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyPhone(r.phone!)} title="Copier" />
          )}
        </div>
      ),
    },
    {
      title: 'Ville',
      dataIndex: 'city',
      key: 'city',
      width: 140,
      responsive: ['lg'],
      render: (v) => <span className="text-sm text-gray-600 dark:text-gray-400">{v || EMPTY}</span>,
    },
    {
      title: 'Rôle',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (v) => <Tag color={roleColor(v)}>{roleLabel(v)}</Tag>,
    },
    {
      title: 'Disponibilité',
      key: 'avail',
      width: 140,
      responsive: ['lg'],
      render: (_v, r) =>
        r.role === 'driver' ? (
          r.is_available ? (
            <Tag color="green">Disponible</Tag>
          ) : (
            <Tag color="default">En livraison</Tag>
          )
        ) : (
          <span className="text-sm text-gray-400">{NA}</span>
        ),
    },
    {
      title: 'Présence',
      key: 'presence',
      width: 140,
      responsive: ['xl'],
      render: (_v, r) => {
        const now = Date.now();
        const lastSeen = r.last_seen_at ? new Date(r.last_seen_at).getTime() : null;
        const diffMin = lastSeen ? Math.round((now - lastSeen) / 60000) : null;

        if (lastSeen && diffMin !== null && diffMin < 2) {
          return (
            <Tooltip title={`Vu il y a ${diffMin}min`}>
              <span className="flex items-center gap-1.5">
                <span className="presence-badge-online" />
                <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>En ligne</span>
              </span>
            </Tooltip>
          );
        }
        if (lastSeen && diffMin !== null && diffMin < 15) {
          return (
            <Tooltip title={`Vu il y a ${diffMin}min`}>
              <span className="flex items-center gap-1.5">
                <span className="presence-badge-away" />
                <span style={{ fontSize: 12, color: '#f59e0b' }}>Absent</span>
              </span>
            </Tooltip>
          );
        }
        if (r.last_seen_at) {
          return (
            <Tooltip title={`Vu le ${new Date(r.last_seen_at).toLocaleString('fr-FR')}`}>
              <span className="flex items-center gap-1.5">
                <span className="presence-badge-offline" />
                <span style={{ fontSize: 11, opacity: 0.6 }}>Hors ligne</span>
              </span>
            </Tooltip>
          );
        }
        return <span style={{ fontSize: 11, opacity: 0.4 }}>—</span>;
      },
    },
    {
      title: 'Statut',
      key: 'status',
      width: 120,
      render: (_v, r) => {
        const s = statusLabel(r);
        return (
          <Tooltip title={r?.is_suspended ? 'Compte suspendu' : 'Compte actif'}>
            <Tag color={s.color}>{s.label}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_v, r) => (
        <Space>
          <Link href={`/users/${encodeURIComponent(r.id)}`}>
            <Button type="text" size="small" icon={<EyeOutlined />} title="Voir la fiche" />
          </Link>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'view',
                  label: 'Voir la fiche',
                  icon: <EyeOutlined />,
                  onClick: () => (window.location.href = `/users/${r.id}`),
                },
                {
                  key: 'role',
                  label: 'Changer le rôle',
                  icon: <SwapOutlined />,
                  onClick: () => handleRowChangeRole(r),
                },
                { type: 'divider' as const },
                {
                  key: 'suspend',
                  label: r.is_suspended ? 'Réactiver le compte' : 'Suspendre',
                  icon: r.is_suspended ? <UnlockOutlined /> : <LockOutlined />,
                  danger: !r.is_suspended,
                  onClick: () => handleRowSuspend(r),
                },
                {
                  key: 'reset',
                  label: 'Réinitialiser mot de passe',
                  icon: <KeyOutlined />,
                  onClick: () => handleRowPasswordReset(r),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Utilisateurs" subtitle="Gestion des comptes & rôles" />

      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card size="small" className="dashboard-card-glass">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                <TeamOutlined style={{ fontSize: 20 }} />
              </div>
              <div>
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-xl font-bold">{kpis.total}</div>
              </div>
            </div>
          </Card>
          <Card size="small" className="dashboard-card-glass">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <UserOutlined style={{ fontSize: 20 }} />
              </div>
              <div>
                <div className="text-xs text-gray-500">Clients</div>
                <div className="text-xl font-bold">{kpis.clients}</div>
              </div>
            </div>
          </Card>
          <Card size="small" className="dashboard-card-glass">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <CarOutlined style={{ fontSize: 20 }} />
              </div>
              <div>
                <div className="text-xs text-gray-500">Livreurs</div>
                <div className="text-xl font-bold">{kpis.drivers}</div>
              </div>
            </div>
          </Card>
          <Card size="small" className="dashboard-card-glass">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                <CrownOutlined style={{ fontSize: 20 }} />
              </div>
              <div>
                <div className="text-xs text-gray-500">Administrateurs</div>
                <div className="text-xl font-bold">{kpis.admins}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Input
              placeholder="Rechercher (nom, email, téléphone)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              className="sm:max-w-xs"
            />
            <Select
              value={role}
              style={{ minWidth: 180 }}
              onChange={setRole}
              options={[
                { value: 'all', label: 'Tous les rôles' },
                { value: 'user', label: 'Client' },
                { value: 'driver', label: 'Livreur' },
                { value: 'admin', label: 'Administrateur' },
              ]}
            />
          </div>

          {selectedRowKeys.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <span className="font-medium">{selectedRowKeys.length} sélectionné(s)</span>
              <Space wrap>
                <Select
                  value={bulkRole}
                  onChange={setBulkRole}
                  style={{ minWidth: 160 }}
                  options={[
                    { value: 'user', label: 'Définir rôle: Client' },
                    { value: 'driver', label: 'Définir rôle: Livreur' },
                    { value: 'admin', label: 'Définir rôle: Administrateur' },
                  ]}
                />
                <Button
                  disabled={!selectedRowKeys.length}
                  onClick={() => void doBulkUpdate({ role: bulkRole }, 'Rôle mis à jour')}
                >
                  Appliquer rôle
                </Button>
                <Select
                  value={bulkAvail ? 'on' : 'off'}
                  onChange={(v) => setBulkAvail(v === 'on')}
                  style={{ minWidth: 180 }}
                  options={[
                    { value: 'on', label: 'Disponibilité: Disponible' },
                    { value: 'off', label: 'Disponibilité: Indisponible' },
                  ]}
                />
                <Button
                  disabled={!selectedRowKeys.length}
                  onClick={() => void doBulkUpdate({ is_available: bulkAvail }, 'Disponibilité mise à jour')}
                >
                  Appliquer disponibilité
                </Button>
                <Button onClick={() => setSelectedRowKeys([])}>Annuler</Button>
              </Space>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} utilisateur(s)`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps ?? 20);
            },
          }}
          scroll={{ x: 1100 }}
          className="dashboard-orders-table"
        />
      </Card>
    </div>
  );
}
