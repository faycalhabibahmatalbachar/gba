'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App, Button, Card, Input, Modal, Select, Space, Switch,
  Table, Tag, Typography, Tooltip, Popconfirm, Segmented,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  PictureOutlined, CheckCircleOutlined, CloseCircleOutlined,
  AppstoreOutlined, UnorderedListOutlined, InboxOutlined,
  UploadOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '@/components/ui/PageHeader';

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  icon?: string | null;
  image_url?: string | null;
  is_active: boolean;
  display_order?: number | null;
  parent_id?: string | null;
  link_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  image_url: string;
  is_active: boolean;
  display_order: number;
  parent_id: string;
  link_url: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const slugify = (s = '') =>
  s.toLowerCase()
    .replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[ùûü]/g,'u')
    .replace(/[ôö]/g,'o').replace(/[ïî]/g,'i').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const ICONS = [
  '📱','💻','🖥️','⌚','📷','🎮','🎧','📺','🔌','🔋',
  '👕','👗','👔','👠','👟','🧣','👜','💍','🧴','💄',
  '🏠','🛋️','🪴','🍳','🪑','🛏️','🧹','💡','🚿','🔑',
  '🏋️','⚽','🏀','🎾','🏊','🚴','🤸','🥊','🎿','🏄',
  '🍎','🥦','🥩','🍞','🧀','🍫','☕','🍷','🧃','🧁',
  '📚','🎨','🎭','🎵','📖','✏️','🖌️','🎬','📝','🗺️',
  '💊','🏥','🌿','💆','🧘','🩺','🔬','🧪','🩹','❤️',
  '🚗','✈️','🚢','🚲','🛵','🏕️','🧳','🚀','⛽','🌍',
  '🌟','💎','🏆','🎁','🎉','🛒','🏷️','💰','🤝','✨',
];

function suggestIcon(name = '') {
  const n = name.toLowerCase();
  if (/électronique|elec|téléphone|phone|tech|informatique|ordinateur/.test(n)) return '📱';
  if (/vêtement|mode|habit|robe|chemise|fashion/.test(n)) return '👕';
  if (/maison|mobilier|décor|meuble|cuisine/.test(n)) return '🏠';
  if (/sport|fitness|gym|foot|basket/.test(n)) return '🏋️';
  if (/alimenta|nourriture|food|boisson|épicerie/.test(n)) return '🍎';
  if (/livre|éducation|école|book|papeterie/.test(n)) return '📚';
  if (/santé|médic|pharma|beauté|cosmétique/.test(n)) return '💊';
  if (/auto|voiture|moto|véhicule|transport/.test(n)) return '🚗';
  if (/jouet|enfant|bébé|jeu/.test(n)) return '🎮';
  if (/bijoux|montre|accessoire|sac/.test(n)) return '💍';
  return '🛒';
}

// ─── Image Upload Zone ────────────────────────────────────────────────────────
function ImageUploadZone({ value, onChange, uploading, onUploading }: {
  value: string; onChange: (url: string) => void;
  uploading: boolean; onUploading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    onUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `categories/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
      onChange(publicUrl);
    } catch (e: any) {
      console.error('[CATEGORY IMAGE UPLOAD]', e);
    } finally {
      onUploading(false);
    }
  };

  if (value) {
    return (
      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', height: 100 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Button size="small" icon={<UploadOutlined />} onClick={() => inputRef.current?.click()} style={{ background: 'rgba(255,255,255,.9)', border: 'none' }}>Changer</Button>
          <Button size="small" danger onClick={() => onChange('')} style={{ background: 'rgba(239,68,68,.9)', border: 'none', color: 'white' }}>Suppr.</Button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
      style={{
        border: `2px dashed ${drag ? '#4f46e5' : '#d1d5db'}`,
        borderRadius: 10, height: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: 'pointer', background: drag ? 'rgba(79,70,229,.04)' : '#fafafa', transition: 'all .2s',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      <InboxOutlined style={{ fontSize: 20, color: drag ? '#4f46e5' : '#9ca3af' }} />
      <span style={{ fontSize: 12, color: '#6b7280' }}>
        {uploading ? 'Upload…' : 'Cliquer ou déposer une image'}
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const { message, modal } = App.useApp();
  const [categories, setCategories]       = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [viewMode, setViewMode]           = useState<'table' | 'grid'>('table');

  const [open, setOpen]                   = useState(false);
  const [saving, setSaving]               = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [form, setForm]                   = useState<FormState>({
    name: '', slug: '', description: '', icon: '',
    image_url: '', is_active: true, display_order: 0, parent_id: '', link_url: '',
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({
    ...f, [k]: v,
    ...(k === 'name' ? { slug: slugify(v as string) } : {}),
  }));

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('display_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('products').select('category_id').eq('is_active', true),
      ]);
      if (catRes.error) throw catRes.error;
      setCategories((catRes.data || []) as Category[]);
      const counts: Record<string, number> = {};
      (prodRes.data || []).forEach((p: any) => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
      setProductCounts(counts);
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { void load(); }, [load]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    categories.length,
    active:   categories.filter(c => c.is_active).length,
    inactive: categories.filter(c => !c.is_active).length,
    roots:    categories.filter(c => !c.parent_id).length,
    subs:     categories.filter(c => !!c.parent_id).length,
  }), [categories]);

  const filtered = useMemo(() =>
    categories.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
    ),
  [categories, search]);

  const parentName = useCallback((cat: Category) => {
    if (!cat.parent_id) return null;
    return categories.find(c => c.id === cat.parent_id)?.name || null;
  }, [categories]);

  // ── Open ──────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', slug: '', description: '', icon: '', image_url: '', is_active: true, display_order: stats.roots, parent_id: '', link_url: '' });
    setOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({
      name:          c.name,
      slug:          c.slug          || slugify(c.name),
      description:   c.description   || '',
      icon:          c.icon          || '',
      image_url:     c.image_url     || '',
      is_active:     c.is_active,
      display_order: c.display_order ?? 0,
      parent_id:     c.parent_id     || '',
      link_url:      c.link_url      || '',
    });
    setOpen(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { message.error('Le nom est obligatoire'); return; }
    setSaving(true);
    try {
      const payload = {
        name:          form.name.trim(),
        slug:          form.slug || slugify(form.name),
        description:   form.description.trim() || null,
        icon:          form.icon || null,
        image_url:     form.image_url || null,
        is_active:     form.is_active,
        display_order: Number(form.display_order) || 0,
        parent_id:     form.parent_id || null,
        link_url:      form.link_url.trim() || null,
        updated_at:    new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editingId);
        if (error) throw error;
        message.success('✅ Catégorie mise à jour');
      } else {
        const { error } = await supabase.from('categories').insert([payload]);
        if (error) throw error;
        message.success('✅ Catégorie créée');
      }
      setOpen(false);
      void load();
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (cat: Category) => {
    const children = categories.filter(c => c.parent_id === cat.id);
    if (children.length > 0) {
      message.error(`Impossible : ${children.length} sous-catégorie(s). Supprimez-les d'abord.`);
      return;
    }
    const prodCount = productCounts[cat.id] || 0;
    if (prodCount > 0) {
      message.error(`Impossible : ${prodCount} produit(s) lié(s). Déplacez-les d'abord.`);
      return;
    }
    modal.confirm({
      title: `Supprimer "${cat.name}" ?`,
      content: 'Cette action est irréversible.',
      okText: 'Supprimer', okType: 'danger', cancelText: 'Annuler',
      onOk: async () => {
        const { error } = await supabase.from('categories').delete().eq('id', cat.id);
        if (error) { message.error(error.message); return; }
        message.success('Catégorie supprimée');
        void load();
      },
    });
  };

  const handleToggle = async (cat: Category) => {
    const { error } = await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    if (error) { message.error(error.message); return; }
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<Category> = useMemo(() => [
    {
      title: '#',
      dataIndex: 'display_order',
      key: 'order',
      width: 56,
      render: v => <Tag color="blue">{v ?? 0}</Tag>,
    },
    {
      title: 'Catégorie',
      key: 'cat',
      render: (_v, c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {c.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {c.icon || suggestIcon(c.name)}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{c.name}</div>
            {c.slug && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>/{c.slug}</div>}
            {c.description && <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{c.description}</div>}
          </div>
        </div>
      ),
    },
    {
      title: 'Parent',
      key: 'parent',
      width: 140,
      render: (_v, c) => {
        const pname = parentName(c);
        return pname
          ? <Tag icon={<ApartmentOutlined />} color="purple">{pname}</Tag>
          : <span style={{ opacity: .4, fontSize: 12 }}>Racine</span>;
      },
    },
    {
      title: 'Produits',
      key: 'products',
      width: 90,
      render: (_v, c) => {
        const count = productCounts[c.id] || 0;
        return <Tag color={count > 0 ? 'geekblue' : 'default'}>{count}</Tag>;
      },
    },
    {
      title: 'Statut',
      key: 'status',
      width: 120,
      render: (_v, c) => (
        <Space size={4}>
          <Switch size="small" checked={c.is_active} onChange={() => handleToggle(c)} />
          <Tag color={c.is_active ? 'green' : 'default'}>{c.is_active ? 'Actif' : 'Inactif'}</Tag>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_v, c) => (
        <Space size={4}>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(c)}>Modifier</Button>
          <Tooltip title="Supprimer">
            <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(c)} />
          </Tooltip>
        </Space>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [categories, productCounts, parentName]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHeader title="🗂️ Gestion des Catégories" subtitle="Catalogue hiérarchique des catégories produits" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total',          value: stats.total,    color: '#4f46e5', icon: '🗂️'  },
          { label: 'Actives',        value: stats.active,   color: '#22c55e', icon: '✅'  },
          { label: 'Inactives',      value: stats.inactive, color: '#ef4444', icon: '❌'  },
          { label: 'Racines',        value: stats.roots,    color: '#f97316', icon: '📁'  },
          { label: 'Sous-catégories',value: stats.subs,     color: '#8b5cf6', icon: '📂'  },
        ].map(({ label, value, color, icon }) => (
          <Card key={label} className="hover:shadow-md transition-shadow">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Input
            placeholder="Rechercher nom, slug, description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Segmented
            value={viewMode}
            onChange={v => setViewMode(v as 'table' | 'grid')}
            options={[
              { label: '', value: 'table', icon: <UnorderedListOutlined /> },
              { label: '', value: 'grid',  icon: <AppstoreOutlined />      },
            ]}
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}>
            Nouvelle catégorie
          </Button>
        </Space>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 25, showSizeChanger: true, showTotal: t => `${t} catégorie(s)` }}
            scroll={{ x: 800 }}
          />
        </Card>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 16 }}>
          {filtered.map(c => {
            const count = productCounts[c.id] || 0;
            const pname = parentName(c);
            return (
              <Card
                key={c.id}
                hoverable
                style={{ opacity: c.is_active ? 1 : .6, borderRadius: 14, overflow: 'hidden' }}
                styles={{ body: { padding: 0 } }}
              >
                {/* Card top */}
                <div style={{
                  height: 90,
                  background: c.image_url ? `url(${c.image_url}) center/cover` : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {!c.image_url && <span style={{ fontSize: 36 }}>{c.icon || suggestIcon(c.name)}</span>}
                  <div style={{ position: 'absolute', top: 6, left: 6 }}>
                    <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>#{c.display_order ?? 0}</Tag>
                  </div>
                  {!c.is_active && (
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      <Tag color="red" style={{ fontSize: 9, margin: 0 }}>Inactif</Tag>
                    </div>
                  )}
                  {pname && (
                    <div style={{ position: 'absolute', bottom: 4, left: 6 }}>
                      <Tag color="purple" style={{ fontSize: 9, margin: 0 }}>↳ {pname}</Tag>
                    </div>
                  )}
                </div>
                {/* Card body */}
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  {c.slug && <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9ca3af', marginTop: 2 }}>/{c.slug}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Tag color={count > 0 ? 'geekblue' : 'default'} style={{ fontSize: 10, margin: 0 }}>📦 {count}</Tag>
                    <Space size={4}>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(c)} style={{ padding: '0 6px', fontSize: 11, height: 24 }} />
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(c)} style={{ padding: '0 6px', fontSize: 11, height: 24 }} />
                    </Space>
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🗂️</div>
              <div>Aucune catégorie trouvée</div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={open}
        onCancel={() => { setOpen(false); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ApartmentOutlined style={{ color: 'white', fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>{editingId ? editingId.slice(0, 8) + '…' : 'Remplissez les informations'}</div>
            </div>
          </div>
        }
        footer={
          <Space>
            <Button onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button
              type="primary"
              loading={saving || uploading}
              onClick={handleSave}
              disabled={!form.name.trim()}
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', minWidth: 120 }}
            >
              {saving ? 'Sauvegarde…' : editingId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </Space>
        }
        width={600}
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>

          {/* Nom + slug */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Nom <span style={{ color: '#ef4444' }}>*</span></div>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Électronique, Mode femme…" />
          </div>

          {/* Slug preview */}
          {form.slug && (
            <div style={{ padding: '6px 12px', background: '#f3f4f6', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', color: '#4f46e5' }}>
              🔗 /{form.slug}
            </div>
          )}

          {/* Description */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</div>
            <Input.TextArea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Description de la catégorie"
            />
          </div>

          {/* Parent */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Catégorie parente</div>
            <Select
              value={form.parent_id || ''}
              onChange={v => setForm(f => ({ ...f, parent_id: v }))}
              style={{ width: '100%' }}
              placeholder="— Catégorie racine —"
              allowClear
              onClear={() => setForm(f => ({ ...f, parent_id: '' }))}
            >
              <Select.Option value="">— Catégorie racine —</Select.Option>
              {categories
                .filter(c => !c.parent_id && (!editingId || c.id !== editingId))
                .map(c => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.icon || suggestIcon(c.name)} {c.name}
                  </Select.Option>
                ))}
            </Select>
          </div>

          {/* Icon picker */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Icône emoji</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 120, overflowY: 'auto', padding: '8px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}>
              {ICONS.map(ico => (
                <button
                  key={ico}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, icon: ico }))}
                  style={{
                    fontSize: 20, padding: 4, borderRadius: 8, border: 'none',
                    background: form.icon === ico ? '#ede9fe' : 'transparent',
                    outline: form.icon === ico ? '2px solid #4f46e5' : 'none',
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  {ico}
                </button>
              ))}
            </div>
          </div>

          {/* Image */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Image de couverture</div>
            <ImageUploadZone
              value={form.image_url}
              onChange={url => set('image_url', url)}
              uploading={uploading}
              onUploading={setUploading}
            />
          </div>

          {/* Order + Active */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ordre d&apos;affichage</div>
              <Input
                type="number" min={0}
                value={form.display_order}
                onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Visibilité</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa' }}>
                <Switch checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{form.is_active ? 'Visible' : 'Masquée'}</span>
              </div>
            </div>
          </div>

          {/* SEO Preview */}
          {form.name && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#1d4ed8', marginBottom: 6 }}>🔍 Aperçu SEO</div>
              <div style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 14 }}>{form.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>gba.app/categories/{form.slug || '…'}</div>
              {form.description && <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>{form.description.slice(0, 140)}</div>}
            </div>
          )}

        </div>
      </Modal>
    </div>
  );
}
