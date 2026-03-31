'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App, Button, Card, DatePicker, Dropdown, Input, Modal,
  Select, Space, Switch, Table, Tag, Typography, Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  PictureOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FlagOutlined, CopyOutlined, MoreOutlined, ClockCircleOutlined,
  StopOutlined, ClearOutlined, UploadOutlined, InboxOutlined,
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase/client';
import dayjs from 'dayjs';
import PageHeader from '@/components/ui/PageHeader';

// ─── Types ────────────────────────────────────────────────────────────────────
type BannerRow = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  target_route?: string | null;
  link_url?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
};

type FormState = {
  title: string;
  subtitle: string;
  image_url: string;
  image_path: string;
  target_route: string;
  link_url: string;
  is_active: boolean;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

const BUCKET = 'banners';
const MAX_MB  = 5;
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

// ─── Upload helper ────────────────────────────────────────────────────────────
async function uploadToStorage(file: File, bannerId: string): Promise<{ url: string; path: string }> {
  if (!ALLOWED.includes(file.type))
    throw new Error(`Format non supporté (JPG/PNG/WEBP/GIF). Reçu: ${file.type}`);
  if (file.size > MAX_MB * 1024 * 1024)
    throw new Error(`Image trop lourde (max ${MAX_MB} Mo)`);

  const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `${bannerId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type });

  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { url: publicUrl, path: filePath };
}

async function deleteFromStorage(imagePath: string | null | undefined): Promise<void> {
  if (!imagePath) return;
  let path = imagePath;
  if (imagePath.includes('/storage/v1/object/public/banners/'))
    path = imagePath.split('/storage/v1/object/public/banners/')[1];
  await supabase.storage.from(BUCKET).remove([path]);
}

// ─── Status helper ────────────────────────────────────────────────────────────
type Status = 'active' | 'inactive' | 'expired' | 'scheduled';
function getBannerStatus(r: BannerRow): Status {
  const now = dayjs();
  if (!r.is_active) return 'inactive';
  if (r.ends_at && now.isAfter(dayjs(r.ends_at))) return 'expired';
  if (r.starts_at && now.isBefore(dayjs(r.starts_at))) return 'scheduled';
  return 'active';
}

const STATUS_TAG: Record<Status, { color: string; label: string }> = {
  active:    { color: 'green',  label: 'Actif'     },
  inactive:  { color: 'default', label: 'Inactif'  },
  expired:   { color: 'red',    label: 'Expirée'   },
  scheduled: { color: 'orange', label: 'Planifiée' },
};

// ─── UploadZone (drag & drop + click) ────────────────────────────────────────
function UploadZone({
  file, previewUrl, onChange, onClear, uploading,
}: {
  file: File | null;
  previewUrl: string;
  onChange: (f: File) => void;
  onClear: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const src = file ? URL.createObjectURL(file) : previewUrl;

  const pick = (f: File) => {
    if (!ALLOWED.includes(f.type)) return;
    if (f.size > MAX_MB * 1024 * 1024) return;
    onChange(f);
  };

  if (src) {
    return (
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '16/5', background: '#f3f4f6' }}>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.6), transparent)', display: 'flex', alignItems: 'flex-end', padding: 12, gap: 8 }}>
          <Button size="small" icon={<UploadOutlined />} onClick={() => inputRef.current?.click()} disabled={uploading} style={{ background: 'rgba(255,255,255,.9)', border: 'none' }}>Changer</Button>
          <Button size="small" danger onClick={onClear} disabled={uploading} style={{ background: 'rgba(239,68,68,.9)', border: 'none', color: 'white' }}>Supprimer</Button>
          {file && <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.8)', fontSize: 11 }}>{(file.size / 1024 / 1024).toFixed(2)} Mo</span>}
        </div>
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 10, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}>⏳ Upload en cours…</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) pick(f); }}
      style={{
        border: `2px dashed ${drag ? '#4f46e5' : '#d1d5db'}`,
        borderRadius: 12,
        background: drag ? 'rgba(79,70,229,.06)' : '#fafafa',
        aspectRatio: '16/5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: 'pointer',
        transition: 'all .2s',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
      <InboxOutlined style={{ fontSize: 36, color: drag ? '#4f46e5' : '#9ca3af' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600, color: drag ? '#4f46e5' : '#374151' }}>
          {drag ? 'Déposer l\'image ici' : 'Glisser-déposer ou cliquer'}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          JPG, PNG, WEBP, GIF · Max {MAX_MB} Mo · Ratio 16:5 recommandé
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BannersPage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading]           = useState(true);
  const [rows, setRows]                 = useState<BannerRow[]>([]);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal state
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm]           = useState<FormState>({
    title: '', subtitle: '', image_url: '', image_path: '',
    target_route: '', link_url: '',
    is_active: true, display_order: 0,
    starts_at: null, ends_at: null,
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('banners').select('*', { count: 'exact' })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(200);
      if (search.trim()) {
        const s = search.trim();
        q = q.or(`title.ilike.%${s}%,subtitle.ilike.%${s}%,target_route.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setRows((data || []) as BannerRow[]);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [search, message]);

  useEffect(() => { void load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('banners-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     rows.length,
    active:    rows.filter(r => getBannerStatus(r) === 'active').length,
    inactive:  rows.filter(r => getBannerStatus(r) === 'inactive').length,
    expired:   rows.filter(r => getBannerStatus(r) === 'expired').length,
    scheduled: rows.filter(r => getBannerStatus(r) === 'scheduled').length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter(r => getBannerStatus(r) === statusFilter);
  }, [rows, statusFilter]);

  // ── Reset / Open ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ title: '', subtitle: '', image_url: '', image_path: '', target_route: '', link_url: '', is_active: true, display_order: rows.length, starts_at: null, ends_at: null });
    setImageFile(null);
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (b: BannerRow) => {
    setEditingId(b.id);
    setImageFile(null);
    setForm({
      title:         b.title         || '',
      subtitle:      b.subtitle      || '',
      image_url:     b.image_url     || '',
      image_path:    b.image_path    || '',
      target_route:  b.target_route  || '',
      link_url:      b.link_url      || '',
      is_active:     b.is_active     ?? true,
      display_order: b.display_order ?? 0,
      starts_at:     b.starts_at     || null,
      ends_at:       b.ends_at       || null,
    });
    setOpen(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { message.error('Le titre est obligatoire'); return; }
    setSaving(true);
    let uploadedPath: string | null = null;

    try {
      // 1. Check admin rights (softened: only block if explicitly false)
      let isAdm: boolean | null = null;
      try {
        const { data } = await supabase.rpc('is_admin');
        isAdm = data;
      } catch (e) {
        console.warn('is_admin RPC failed, letting RLS decide:', e);
      }
      if (isAdm === false) { 
        message.error('Accès refusé : droits administrateur requis'); 
        setSaving(false);
        return; 
      }

      const payload = {
        title:         form.title.trim(),
        subtitle:      form.subtitle.trim()      || null,
        target_route:  form.target_route.trim()  || null,
        link_url:      form.link_url.trim()      || null,
        is_active:     form.is_active,
        display_order: Number(form.display_order) || 0,
        starts_at:     form.starts_at  || null,
        ends_at:       form.ends_at    || null,
        updated_at:    new Date().toISOString(),
      };

      // 2. DB write first (get bannerId)
      let bannerId = editingId;
      if (editingId) {
        const { error } = await supabase.from('banners').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('banners').insert([payload]).select().single();
        if (error) throw error;
        bannerId = data.id;
      }

      // 3. Upload image if new file selected
      if (imageFile && bannerId) {
        setUploading(true);
        try {
          const { url, path } = await uploadToStorage(imageFile, bannerId);
          uploadedPath = path;

          // Delete old image if editing
          if (editingId && form.image_path && form.image_path !== path)
            await deleteFromStorage(form.image_path);

          // Update DB with new image
          const { error: imgErr } = await supabase
            .from('banners')
            .update({ image_url: url, image_path: path, updated_at: new Date().toISOString() })
            .eq('id', bannerId);
          if (imgErr) throw imgErr;
        } finally {
          setUploading(false);
        }
      }

      message.success(editingId ? '✅ Bannière mise à jour' : '✅ Bannière créée');
      setOpen(false);
      resetForm();
      void load();
    } catch (e: any) {
      setUploading(false);
      // Rollback uploaded file on error
      if (uploadedPath) await deleteFromStorage(uploadedPath);
      message.error(e?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (b: BannerRow) => {
    try {
      const { error } = await supabase.from('banners').delete().eq('id', b.id);
      if (error) throw error;
      if (b.image_path) await deleteFromStorage(b.image_path);
      message.success('Bannière supprimée');
      setRows(prev => prev.filter(x => x.id !== b.id));
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    }
  };

  const handleDuplicate = async (b: BannerRow) => {
    try {
      const { id, created_at, image_url, image_path, ...rest } = b;
      await supabase.from('banners').insert({ ...rest, title: `${b.title || ''} (copie)`, display_order: (b.display_order ?? 0) + 1, image_url: null, image_path: null });
      message.success('Bannière dupliquée (sans image)');
      void load();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    }
  };

  // ── Bulk ──────────────────────────────────────────────────────────────────
  const bulkUpdate = async (patch: Partial<BannerRow>) => {
    const { error } = await supabase.from('banners').update(patch).in('id', selectedRowKeys as string[]);
    if (error) { message.error(error.message); return; }
    setSelectedRowKeys([]);
    void load();
  };

  const bulkDelete = () => modal.confirm({
    title: `Supprimer ${selectedRowKeys.length} bannière(s) ?`,
    okText: 'Supprimer', okType: 'danger', cancelText: 'Annuler',
    onOk: async () => {
      const { error } = await supabase.from('banners').delete().in('id', selectedRowKeys as string[]);
      if (error) { message.error(error.message); return; }
      message.success(`${selectedRowKeys.length} supprimée(s)`);
      setSelectedRowKeys([]);
      void load();
    },
  });

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<BannerRow> = useMemo(() => [
    {
      title: '#',
      dataIndex: 'display_order',
      key: 'pos',
      width: 60,
      render: (v) => <Tag color="geekblue">{v ?? 0}</Tag>,
    },
    {
      title: 'Bannière',
      key: 'banner',
      render: (_v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {r.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image_url} alt="" style={{ width: 120, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
          ) : (
            <div style={{ width: 120, height: 60, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PictureOutlined style={{ fontSize: 24, color: '#9ca3af' }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
              {r.title || '—'}
            </div>
            {r.subtitle && <div style={{ fontSize: 12, opacity: .7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{r.subtitle}</div>}
            {r.target_route && <div style={{ fontSize: 11, color: '#6366f1' }}>{r.target_route}</div>}
          </div>
        </div>
      ),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 130,
      render: (_v, r) => {
        const s = getBannerStatus(r);
        const { color, label } = STATUS_TAG[s];
        return (
          <Space size={4}>
            <Switch
              size="small"
              checked={!!r.is_active}
              onChange={async (checked) => {
                const { error } = await supabase.from('banners').update({ is_active: checked }).eq('id', r.id);
                if (error) { message.error(error.message); return; }
                setRows(prev => prev.map(x => x.id === r.id ? { ...x, is_active: checked } : x));
              }}
            />
            <Tag color={color}>{label}</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Période',
      key: 'period',
      width: 160,
      responsive: ['lg'],
      render: (_v, r) => {
        if (!r.starts_at && !r.ends_at) return <span style={{ opacity: .5, fontSize: 12 }}>Permanent</span>;
        return (
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            {r.starts_at && <div>▶ {dayjs(r.starts_at).format('DD/MM/YY HH:mm')}</div>}
            {r.ends_at   && <div>⏹ {dayjs(r.ends_at).format('DD/MM/YY HH:mm')}</div>}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_v, r) => (
        <Space size={4}>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>Modifier</Button>
          <Dropdown
            menu={{
              items: [
                { key: 'dup', icon: <CopyOutlined />, label: 'Dupliquer', onClick: () => handleDuplicate(r) },
                { type: 'divider' },
                {
                  key: 'del', icon: <DeleteOutlined />, label: 'Supprimer', danger: true,
                  onClick: () => modal.confirm({
                    title: 'Supprimer cette bannière ?', okText: 'Supprimer', okType: 'danger', cancelText: 'Annuler',
                    onOk: () => handleDelete(r),
                  }),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [rows, modal]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHeader title="🖼️ Banner Management" subtitle="Bannières promotionnelles de l'application" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'all',       label: 'Total',       value: stats.total,     color: '#4f46e5', icon: <FlagOutlined />          },
          { key: 'active',    label: 'Actives',      value: stats.active,    color: '#22c55e', icon: <CheckCircleOutlined />   },
          { key: 'inactive',  label: 'Inactives',    value: stats.inactive,  color: '#6b7280', icon: <CloseCircleOutlined />   },
          { key: 'expired',   label: 'Expirées',     value: stats.expired,   color: '#ef4444', icon: <StopOutlined />          },
          { key: 'scheduled', label: 'Planifiées',   value: stats.scheduled, color: '#f97316', icon: <ClockCircleOutlined />   },
        ].map(({ key, label, value, color, icon }) => (
          <Card
            key={key}
            className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === key ? 'ring-2' : ''}`}
            style={{ '--ring-color': color } as React.CSSProperties}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24, color }}>{icon}</div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space wrap>
          {selectedRowKeys.length > 0 && (
            <>
              <Tag color="blue">{selectedRowKeys.length} sélectionnée(s)</Tag>
              <Button size="small" onClick={() => bulkUpdate({ is_active: true })}>Activer</Button>
              <Button size="small" onClick={() => bulkUpdate({ is_active: false })}>Désactiver</Button>
              <Button size="small" danger onClick={bulkDelete}>Supprimer</Button>
              <Button size="small" icon={<ClearOutlined />} onClick={() => setSelectedRowKeys([])}>Effacer</Button>
            </>
          )}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none' }}>
            Créer une bannière
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Card>
        <Space wrap>
          <Input
            placeholder="Rechercher (titre / lien…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 160 }}>
            <Select.Option value="all">Tous les statuts</Select.Option>
            <Select.Option value="active">Actives</Select.Option>
            <Select.Option value="inactive">Inactives</Select.Option>
            <Select.Option value="expired">Expirées</Select.Option>
            <Select.Option value="scheduled">Planifiées</Select.Option>
          </Select>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredRows}
          rowSelection={{ selectedRowKeys, onChange: keys => setSelectedRowKeys(keys) }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} bannière(s)` }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={open}
        onCancel={() => { setOpen(false); resetForm(); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PictureOutlined style={{ color: 'white', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editingId ? 'Modifier la bannière' : 'Nouvelle bannière'}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                {editingId ? 'Mise à jour des informations' : 'Remplissez les informations de la bannière'}
              </div>
            </div>
          </div>
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {imageFile ? `📎 ${imageFile.name} (${(imageFile.size/1024/1024).toFixed(2)} Mo)` : 'Aucune image sélectionnée'}
            </div>
            <Space>
              <Button onClick={() => { setOpen(false); resetForm(); }} disabled={saving || uploading}>Annuler</Button>
              <Button
                type="primary"
                loading={saving || uploading}
                onClick={handleSave}
                disabled={!form.title.trim()}
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', minWidth: 120 }}
              >
                {uploading ? 'Upload…' : saving ? 'Sauvegarde…' : editingId ? 'Mettre à jour' : 'Créer'}
              </Button>
            </Space>
          </div>
        }
        width={640}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8 }}>

          {/* Section 1 — Image */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <UploadOutlined /> Section 1 — Image bannière
            </div>
            <UploadZone
              file={imageFile}
              previewUrl={form.image_url}
              onChange={f => setImageFile(f)}
              onClear={() => { setImageFile(null); set('image_url', ''); set('image_path', ''); }}
              uploading={uploading}
            />
          </div>

          {/* Section 2 — Contenu */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: 12 }}>
              Section 2 — Contenu
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Titre <span style={{ color: '#ef4444' }}>*</span></div>
                <Input
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="Ex: Offre de bienvenue — 50% sur tout"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sous-titre</div>
                <Input
                  value={form.subtitle}
                  onChange={e => set('subtitle', e.target.value)}
                  placeholder="Ex: Valable jusqu'au 31 décembre"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Route cible</div>
                  <Input value={form.target_route} onChange={e => set('target_route', e.target.value)} placeholder="/promotions" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Lien externe</div>
                  <Input value={form.link_url} onChange={e => set('link_url', e.target.value)} placeholder="https://…" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 — Affichage */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b7280', marginBottom: 12 }}>
              Section 3 — Affichage
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Active toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Bannière active</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{form.is_active ? 'Visible dans l\'application' : 'Masquée'}</div>
                </div>
                <Switch checked={form.is_active} onChange={v => set('is_active', v)} />
              </div>
              {/* Position */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Position (ordre d&apos;affichage)</div>
                <Input
                  type="number"
                  min={0}
                  value={form.display_order}
                  onChange={e => set('display_order', parseInt(e.target.value) || 0)}
                />
              </div>
              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date de début</div>
                  <DatePicker
                    style={{ width: '100%' }}
                    showTime
                    placeholder="Dès maintenant"
                    value={form.starts_at ? dayjs(form.starts_at) : null}
                    onChange={d => set('starts_at', d ? d.toISOString() : null)}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date de fin</div>
                  <DatePicker
                    style={{ width: '100%' }}
                    showTime
                    placeholder="Sans expiration"
                    value={form.ends_at ? dayjs(form.ends_at) : null}
                    onChange={d => set('ends_at', d ? d.toISOString() : null)}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </Modal>
    </div>
  );
}
