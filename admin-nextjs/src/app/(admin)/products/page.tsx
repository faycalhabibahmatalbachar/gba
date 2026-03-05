
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { App, Button, Card, Checkbox, Collapse, Divider, Drawer, Empty, Image as AntdImage, Input, InputNumber, Select, Skeleton, Space, Switch, Table, Tag, Tooltip, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AppstoreOutlined, DeleteOutlined, EditOutlined, EyeOutlined, ReloadOutlined, TableOutlined } from '@ant-design/icons';
import type { ProductRow } from '@/lib/services/products';
import { deleteProduct, fetchProducts } from '@/lib/services/products';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '@/components/ui/PageHeader';

type StockFilter = 'all' | 'out' | 'low' | 'in';
type ImageFilter = 'all' | 'missing';

type ProductDetailsRow = {
  id: string;
  name: string | null;
  sku?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  cost_price?: number | null;
  quantity?: number | null;
  low_stock_threshold?: number | null;
  unit?: string | null;
  weight?: number | null;
  dimensions?: any;
  main_image?: string | null;
  images?: string[] | null;
  description?: string | null;
  short_description?: string | null;
  brand?: string | null;
  model?: string | null;
  barcode?: string | null;
  slug?: string | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  status?: string | null;
  track_quantity?: boolean | null;
  tags?: string[] | null;
  specifications?: any;
  metadata?: any;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[] | null;
  categories?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type ProductAnalytics30d = {
  views30d: number;
  ordersCount30d: number;
  qtySold30d: number;
  revenue30d: number;
  viewsPrev30d: number;
  ordersCountPrev30d: number;
  qtySoldPrev30d: number;
  revenuePrev30d: number;
  viewsSeries: Array<{ day: string; value: number }>;
  ordersSeries: Array<{ day: string; value: number }>;
  revenueSeries: Array<{ day: string; value: number }>;
};

type ProductEditPatch = {
  name?: string | null;
  sku?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  cost_price?: number | null;
  quantity?: number | null;
  low_stock_threshold?: number | null;
  unit?: string | null;
  weight?: number | null;
  dimensions?: any;
  category_id?: string | null;
  description?: string | null;
  short_description?: string | null;
  brand?: string | null;
  model?: string | null;
  barcode?: string | null;
  main_image?: string | null;
  images?: string[] | null;
  slug?: string | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  status?: string | null;
  track_quantity?: boolean | null;
  tags?: string[] | null;
  specifications?: any;
  metadata?: any;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[] | null;
};

export default function ProductsPage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [imageFilter, setImageFilter] = useState<ImageFilter>('all');
  const [categoryId, setCategoryId] = useState<string>('all');

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerProduct, setDrawerProduct] = useState<ProductDetailsRow | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<ProductEditPatch>({});
  const [tagsText, setTagsText] = useState('');
  const [imagesText, setImagesText] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [dimensionsText, setDimensionsText] = useState('');
  const [specificationsText, setSpecificationsText] = useState('');
  const [metaKeywordsText, setMetaKeywordsText] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [analytics, setAnalytics] = useState<ProductAnalytics30d | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsProductId, setAnalyticsProductId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Array<{ label: string; value: string }>>([{ label: 'Toutes catégories', value: 'all' }]);

  const reloadTimer = useRef<any>(null);

  const pageSize = 24;

  const load = async (opts?: { page?: number; search?: string }) => {
    setLoading(true);
    try {
      const nextPage = opts?.page ?? page;
      const nextSearch = opts?.search ?? search;

      const res = await fetchProducts({ page: nextPage, pageSize, search: nextSearch });
      let rows = res.data;

      // Client-side enterprise filters (safe with current service contract)
      if (categoryId !== 'all') rows = rows.filter((r) => String(r.category?.id || '') === categoryId);
      if (imageFilter === 'missing') rows = rows.filter((r) => !r.main_image);
      if (stockFilter === 'out') rows = rows.filter((r) => Number(r.quantity || 0) <= 0);
      if (stockFilter === 'low') rows = rows.filter((r) => {
        const q = Number(r.quantity || 0);
        return q > 0 && q <= 10;
      });
      if (stockFilter === 'in') rows = rows.filter((r) => Number(r.quantity || 0) > 0);

      setItems(rows);
      setTotal(res.count);
    } catch (e: any) {
      message.error(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async (productId: string) => {
    setAnalyticsLoading(true);
    setAnalytics(null);
    setAnalyticsProductId(productId);
    try {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const from30d = new Date(now - 30 * dayMs).toISOString();
      const from60d = new Date(now - 60 * dayMs).toISOString();
      const fromPrevStart = new Date(now - 60 * dayMs).toISOString();
      const fromPrevEnd = new Date(now - 30 * dayMs).toISOString();

      const [{ data: items, error: itemsErr }, { data: acts, error: actsErr }] = await Promise.all([
        supabase
          .from('order_items')
          .select('quantity, unit_price, order_id, created_at')
          .eq('product_id', productId)
          .gte('created_at', from60d)
          .limit(50000),
        supabase
          .from('user_activities')
          .select('action_type, entity_id, created_at')
          .eq('action_type', 'product_view')
          .eq('entity_id', productId)
          .gte('created_at', from60d)
          .limit(100000),
      ]);

      if (itemsErr) throw itemsErr;
      if (actsErr) throw actsErr;

      const dayKey = (iso: string) => {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
      };

      const makeDays = (days: number) => {
        const out: string[] = [];
        for (let i = days - 1; i >= 0; i--) {
          out.push(dayKey(new Date(now - i * dayMs).toISOString()));
        }
        return out;
      };

      const days30 = makeDays(30);
      const viewsByDay: Record<string, number> = Object.fromEntries(days30.map((d) => [d, 0]));
      for (const a of (acts || []) as Array<{ created_at?: string | null }>) {
        const ca = a.created_at ? String(a.created_at) : '';
        if (!ca) continue;
        if (ca < from30d) continue;
        const k = dayKey(ca);
        if (k in viewsByDay) viewsByDay[k] += 1;
      }

      const list = (items || []) as Array<{ quantity?: number | null; unit_price?: number | null; order_id?: string | null; created_at?: string | null }>;
      const orders30 = new Set<string>();
      const ordersPrev = new Set<string>();
      let qtySold30d = 0;
      let qtySoldPrev30d = 0;
      let revenue30d = 0;
      let revenuePrev30d = 0;
      const ordersByDay: Record<string, number> = Object.fromEntries(days30.map((d) => [d, 0]));
      const revenueByDay: Record<string, number> = Object.fromEntries(days30.map((d) => [d, 0]));

      for (const it of list) {
        const ca = it.created_at ? String(it.created_at) : '';
        if (!ca) continue;
        const q = Number(it.quantity || 0);
        const unit = Number(it.unit_price || 0);
        const amount = q * unit;
        const oid = it.order_id ? String(it.order_id) : null;

        if (ca >= from30d) {
          qtySold30d += q;
          revenue30d += amount;
          if (oid) orders30.add(oid);
          const k = dayKey(ca);
          if (k in revenueByDay) revenueByDay[k] += amount;
        } else if (ca >= fromPrevStart && ca < fromPrevEnd) {
          qtySoldPrev30d += q;
          revenuePrev30d += amount;
          if (oid) ordersPrev.add(oid);
        }
      }

      // Build orders series from distinct orders per day (approx by first item day)
      const orderFirstDay: Record<string, string> = {};
      for (const it of list) {
        const ca = it.created_at ? String(it.created_at) : '';
        const oid = it.order_id ? String(it.order_id) : '';
        if (!ca || !oid) continue;
        if (ca < from30d) continue;
        if (orderFirstDay[oid]) continue;
        const k = dayKey(ca);
        orderFirstDay[oid] = k;
      }
      for (const oid of Object.keys(orderFirstDay)) {
        const k = orderFirstDay[oid];
        if (k in ordersByDay) ordersByDay[k] += 1;
      }

      const views30d = (acts || []).filter((a: any) => String(a?.created_at || '') >= from30d).length;
      const viewsPrev30d = (acts || []).filter((a: any) => {
        const ca = String(a?.created_at || '');
        return ca >= fromPrevStart && ca < fromPrevEnd;
      }).length;

      setAnalytics({
        views30d,
        ordersCount30d: orders30.size,
        qtySold30d,
        revenue30d,
        viewsPrev30d,
        ordersCountPrev30d: ordersPrev.size,
        qtySoldPrev30d,
        revenuePrev30d,
        viewsSeries: days30.map((d) => ({ day: d, value: viewsByDay[d] || 0 })),
        ordersSeries: days30.map((d) => ({ day: d, value: ordersByDay[d] || 0 })),
        revenueSeries: days30.map((d) => ({ day: d, value: revenueByDay[d] || 0 })),
      });
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadProductForEdit = async (productId: string) => {
    setEditError(null);
    setEditSaving(false);
    setEditOpen(true);
    setEditPatch({});
    setTagsText('');
    setImagesText('');
    setMetadataText('');
    setDimensionsText('');
    setSpecificationsText('');
    setMetaKeywordsText('');
    setDrawerProduct(null);
    setDrawerError(null);
    setDrawerLoading(true);
    setAnalytics(null);
    setAnalyticsProductId(null);
    try {
      const selectWide = 'id, name, sku, price, compare_at_price, cost_price, quantity, low_stock_threshold, unit, weight, dimensions, category_id, brand, model, main_image, images, specifications, tags, barcode, is_featured, is_active, status, description, short_description, slug, track_quantity, metadata, meta_title, meta_description, meta_keywords, categories(id,name)';
      const selectNarrow = 'id, name, sku, price, quantity, main_image, images, description, categories(id,name)';

      const wide = await supabase.from('products').select(selectWide).eq('id', productId).maybeSingle();
      if (!wide.error) {
        const row = (wide.data as unknown as ProductDetailsRow) || null;
        setDrawerProduct(row);
        if (row) beginEdit(row);
      } else {
        const msg = String((wide.error as any)?.message || '').toLowerCase();
        const isColumnIssue = msg.includes('does not exist') || msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find');
        if (!isColumnIssue) throw wide.error;
        const narrow = await supabase.from('products').select(selectNarrow).eq('id', productId).maybeSingle();
        if (narrow.error) throw narrow.error;
        const row = (narrow.data as unknown as ProductDetailsRow) || null;
        setDrawerProduct(row);
        if (row) beginEdit(row);
      }
    } catch (e: any) {
      setEditError(e?.message || 'Impossible de charger le produit');
    } finally {
      setDrawerLoading(false);
    }
  };

  const loadProductDetails = async (productId: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerProduct(null);
    setAnalytics(null);
    setAnalyticsProductId(null);
    try {
      const selectWide = 'id, name, sku, price, compare_at_price, cost_price, quantity, low_stock_threshold, unit, weight, dimensions, category_id, brand, model, main_image, images, specifications, tags, barcode, is_featured, is_active, status, description, short_description, slug, track_quantity, metadata, meta_title, meta_description, meta_keywords, categories(id,name)';
      const selectNarrow = 'id, name, sku, price, quantity, main_image, images, description, categories(id,name)';

      const wide = await supabase.from('products').select(selectWide).eq('id', productId).maybeSingle();
      if (!wide.error) {
        setDrawerProduct((wide.data as unknown as ProductDetailsRow) || null);
      } else {
        const msg = String((wide.error as any)?.message || '').toLowerCase();
        const isColumnIssue = msg.includes('does not exist') || msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find');
        if (!isColumnIssue) throw wide.error;
        const narrow = await supabase.from('products').select(selectNarrow).eq('id', productId).maybeSingle();
        if (narrow.error) throw narrow.error;
        setDrawerProduct((narrow.data as unknown as ProductDetailsRow) || null);
      }
      // Auto-load analytics for the opened product
      void loadAnalytics(productId);
    } catch (e: any) {
      setDrawerError(e?.message || 'Impossible de charger le produit');
    } finally {
      setDrawerLoading(false);
    }
  };

  const beginEdit = (p: ProductDetailsRow) => {
    const c = p.categories;
    const cat = Array.isArray(c) ? (c[0] || null) : (c || null);
    setEditPatch({
      name: p.name ?? '',
      sku: p.sku ?? '',
      price: p.price ?? 0,
      compare_at_price: p.compare_at_price ?? null,
      cost_price: p.cost_price ?? null,
      quantity: p.quantity ?? 0,
      low_stock_threshold: p.low_stock_threshold ?? 10,
      unit: p.unit ?? 'pièce',
      weight: p.weight ?? null,
      dimensions: p.dimensions ?? null,
      category_id: cat?.id || null,
      description: p.description ?? '',
      short_description: p.short_description ?? '',
      brand: p.brand ?? '',
      model: p.model ?? '',
      barcode: p.barcode ?? '',
      main_image: p.main_image ?? '',
      images: Array.isArray(p.images) ? p.images : null,
      slug: p.slug ?? '',
      is_active: p.is_active ?? true,
      is_featured: p.is_featured ?? false,
      status: p.status ?? 'available',
      track_quantity: p.track_quantity ?? true,
      tags: Array.isArray(p.tags) ? p.tags : null,
      specifications: p.specifications ?? null,
      metadata: p.metadata ?? null,
      meta_title: p.meta_title ?? '',
      meta_description: p.meta_description ?? '',
      meta_keywords: Array.isArray(p.meta_keywords) ? p.meta_keywords : null,
    });

    setTagsText(Array.isArray(p.tags) ? p.tags.join(', ') : '');
    setImagesText(Array.isArray(p.images) ? JSON.stringify(p.images, null, 2) : '');
    setMetadataText(p.metadata != null ? JSON.stringify(p.metadata, null, 2) : '');
    setDimensionsText(p.dimensions != null ? JSON.stringify(p.dimensions, null, 2) : '');
    setSpecificationsText(p.specifications != null ? JSON.stringify(p.specifications, null, 2) : '');
    setMetaKeywordsText(Array.isArray(p.meta_keywords) ? p.meta_keywords.join(', ') : '');
    setEditError(null);
    setEditOpen(true);
  };

  const uploadMainImage = async (file: File) => {
    if (!drawerProduct?.id) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const safeName = String(file.name || 'image').replaceAll(' ', '_');
      const ext = safeName.includes('.') ? safeName.split('.').pop() : 'jpg';
      const path = `${drawerProduct.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase
        .storage
        .from('products')
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;

      setUploadProgress(80);

      const { data } = supabase.storage.from('products').getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('URL publique introuvable');

      setEditPatch((p) => ({ ...p, main_image: publicUrl }));

      // Update preview in details drawer immediately
      setDrawerProduct((p) => (p ? { ...p, main_image: publicUrl } : p));

      setUploadProgress(100);
      message.success('Image uploadée avec succès');
    } catch (e: any) {
      message.error(e?.message || 'Upload impossible');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 800);
    }
  };

  const saveEdit = async () => {
    if (!drawerProduct?.id) return;
    setEditSaving(true);
    setEditError(null);
    try {
      let parsedImages: string[] | null | undefined = editPatch.images;
      if (imagesText.trim()) {
        try {
          const arr = JSON.parse(imagesText);
          parsedImages = Array.isArray(arr) ? arr.map(String) : null;
        } catch {
          throw new Error('Images: JSON invalide (attendu: liste ["url", ...])');
        }
      }

      let parsedMetadata: any = editPatch.metadata;
      if (metadataText.trim()) {
        try {
          parsedMetadata = JSON.parse(metadataText);
        } catch {
          throw new Error('Métadonnées: JSON invalide');
        }
      }

      let parsedDimensions: any = editPatch.dimensions;
      if (dimensionsText.trim()) {
        try {
          parsedDimensions = JSON.parse(dimensionsText);
        } catch {
          throw new Error('Dimensions: JSON invalide');
        }
      }

      let parsedSpecifications: any = editPatch.specifications;
      if (specificationsText.trim()) {
        try {
          parsedSpecifications = JSON.parse(specificationsText);
        } catch {
          throw new Error('Spécifications: JSON invalide');
        }
      }

      const parsedMetaKeywords = metaKeywordsText.trim()
        ? metaKeywordsText.split(',').map((s) => s.trim()).filter(Boolean)
        : null;

      const parsedTags = tagsText.trim()
        ? tagsText.split(',').map((s) => s.trim()).filter(Boolean)
        : null;

      const payload: ProductEditPatch = {
        name: editPatch.name ?? null,
        sku: editPatch.sku ?? null,
        price: editPatch.price != null ? Number(editPatch.price) : null,
        compare_at_price: editPatch.compare_at_price != null ? Number(editPatch.compare_at_price) : null,
        cost_price: editPatch.cost_price != null ? Number(editPatch.cost_price) : null,
        quantity: editPatch.quantity != null ? Number(editPatch.quantity) : null,
        low_stock_threshold: editPatch.low_stock_threshold != null ? Number(editPatch.low_stock_threshold) : null,
        unit: editPatch.unit ?? null,
        weight: editPatch.weight != null ? Number(editPatch.weight) : null,
        dimensions: parsedDimensions ?? null,
        category_id: editPatch.category_id ?? null,
        description: editPatch.description ?? null,
        short_description: editPatch.short_description ?? null,
        brand: editPatch.brand ?? null,
        model: editPatch.model ?? null,
        barcode: editPatch.barcode ?? null,
        main_image: editPatch.main_image ?? null,
        images: parsedImages ?? null,
        slug: editPatch.slug ?? null,
        is_active: editPatch.is_active ?? null,
        is_featured: editPatch.is_featured ?? null,
        status: editPatch.status ?? null,
        track_quantity: editPatch.track_quantity ?? null,
        tags: parsedTags,
        specifications: parsedSpecifications ?? null,
        metadata: parsedMetadata ?? null,
        meta_title: editPatch.meta_title ?? null,
        meta_description: editPatch.meta_description ?? null,
        meta_keywords: parsedMetaKeywords,
      };

      const wide = await supabase.from('products').update(payload).eq('id', drawerProduct.id);
      if (wide.error) {
        const msg = String((wide.error as any)?.message || '').toLowerCase();
        const isColumnIssue = msg.includes('does not exist') || msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find');
        if (!isColumnIssue) throw wide.error;
        const safe: ProductEditPatch = {
          name: payload.name,
          sku: payload.sku,
          price: payload.price,
          quantity: payload.quantity,
          category_id: payload.category_id,
          description: payload.description,
          main_image: payload.main_image,
          images: payload.images,
          tags: payload.tags,
        };
        const narrow = await supabase.from('products').update(safe).eq('id', drawerProduct.id);
        if (narrow.error) throw narrow.error;
      }

      message.success('Produit mis à jour');
      setEditOpen(false);
      await load({ page, search });
      await loadProductDetails(drawerProduct.id);
    } catch (e: any) {
      setEditError(e?.message || 'Erreur lors de la mise à jour');
    } finally {
      setEditSaving(false);
    }
  };

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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load({ page: 1, search });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelectedRowKeys([]);
    void load({ page: 1, search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockFilter, imageFilter, categoryId]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('categories')
      .select('id, name')
      .order('name', { ascending: true })
      .limit(2000)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) return;
        const opts = (data || []).map((c: any) => ({ label: c.name || c.id, value: c.id }));
        setCategories([{ label: 'Toutes catégories', value: 'all' }, ...opts]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => {
        void load();
      }, 600);
    };

    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, scheduleReload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, scheduleReload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'products' }, scheduleReload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const columns: ColumnsType<ProductRow> = useMemo(() => [
    {
      title: 'Produit',
      key: 'name',
      render: (_v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.main_image ? (
            <Image
              src={r.main_image}
              alt={String(r.name || 'Produit')}
              width={36}
              height={36}
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6' }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
              {r.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{r.sku || r.id.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Prix',
      dataIndex: 'price',
      key: 'price',
      width: 140,
      render: (v) => <span style={{ fontWeight: 800, color: '#4f46e5' }}>{Number(v || 0).toLocaleString('fr-FR')} FCFA</span>,
    },
    {
      title: 'Catégorie',
      key: 'category',
      render: (_v, r) => <Tag>{r.category?.name || 'Non catégorisé'}</Tag>,
      responsive: ['md'],
    },
    {
      title: 'Stock',
      key: 'stock',
      width: 110,
      align: 'center',
      render: (_v, r) => {
        const q = Number(r.quantity || 0);
        const color = q > 10 ? 'green' : q > 0 ? 'gold' : 'red';
        return <Tag color={color}>{q}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_v, r) => (
        <Space>
          <Tooltip title="Voir le produit">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                void loadProductDetails(r.id);
              }}
            />
          </Tooltip>
          <Tooltip title="Modifier">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={async () => {
                void loadProductForEdit(r.id);
              }}
            />
          </Tooltip>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={async () => {
              try {
                await deleteProduct(r.id);
                message.success('Supprimé');
                void load();
              } catch (e: any) {
                message.error(e?.message || 'Erreur');
              }
            }}
          />
        </Space>
      ),
    },
  ], [items]);

  const kpis = useMemo(() => {
    const totalShown = items.length;
    const out = items.filter((p) => Number(p.quantity || 0) <= 0).length;
    const low = items.filter((p) => {
      const q = Number(p.quantity || 0);
      return q > 0 && q <= 10;
    }).length;
    const noImg = items.filter((p) => !p.main_image).length;
    return { totalShown, out, low, noImg };
  }, [items]);

  const doBulkDelete = async () => {
    const ids = selectedRowKeys.map(String).filter(Boolean);
    if (!ids.length) return;
    modal.confirm({
      title: 'Confirmer la suppression',
      content: `Supprimer ${ids.length} produit(s) ?`,
      okText: 'Supprimer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          const { error } = await supabase.from('products').delete().in('id', ids);
          if (error) throw error;
          message.success('Produits supprimés');
          setSelectedRowKeys([]);
          void load();
        } catch (e: any) {
          message.error(e?.message || 'Erreur');
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Produits"
        subtitle="Catalogue et stock"
        extra={
          <Space>
            <Button
              onClick={() => {
                exportCsv(
                  'products_export.csv',
                  ['id', 'sku', 'name', 'category', 'price', 'quantity', 'has_image'],
                  items.map((p) => [
                    p.id,
                    p.sku || '',
                    p.name,
                    p.category?.name || '',
                    Number(p.price || 0),
                    Number(p.quantity || 0),
                    p.main_image ? 1 : 0,
                  ]),
                );
              }}
            >
              Exporter CSV
            </Button>
            <Button icon={viewMode === 'table' ? <AppstoreOutlined /> : <TableOutlined />} onClick={() => setViewMode(v => v === 'table' ? 'grid' : 'table')}>
              {viewMode === 'table' ? 'Grille' : 'Table'}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button>
          </Space>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><div className="text-xs text-gray-500">Produits (page)</div><div className="text-2xl font-extrabold">{kpis.totalShown}</div></Card>
        <Card><div className="text-xs text-gray-500">Ruptures</div><div className="text-2xl font-extrabold">{kpis.out}</div></Card>
        <Card><div className="text-xs text-gray-500">Stock faible (≤10)</div><div className="text-2xl font-extrabold">{kpis.low}</div></Card>
        <Card><div className="text-xs text-gray-500">Sans image</div><div className="text-2xl font-extrabold">{kpis.noImg}</div></Card>
      </div>

      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <Input placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)} allowClear />
          <Select value={categoryId} onChange={setCategoryId} options={categories} />
          <Select
            value={stockFilter}
            onChange={setStockFilter}
            options={[
              { value: 'all', label: 'Stock: Tous' },
              { value: 'out', label: 'Stock: Rupture (0)' },
              { value: 'low', label: 'Stock: Faible (≤10)' },
              { value: 'in', label: 'Stock: En stock' },
            ]}
          />
          <Select
            value={imageFilter}
            onChange={setImageFilter}
            options={[
              { value: 'all', label: 'Images: Toutes' },
              { value: 'missing', label: 'Images: Sans image' },
            ]}
          />
        </div>
      </Card>

      {viewMode === 'table' ? (
        <Card>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {selectedRowKeys.length ? `${selectedRowKeys.length} sélectionné(s)` : 'Aucune sélection'}
            </div>
            <Space wrap>
              <Button danger disabled={!selectedRowKeys.length} onClick={() => void doBulkDelete()} icon={<DeleteOutlined />}>Supprimer</Button>
            </Space>
          </div>

          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p) => setPage(p),
              showSizeChanger: false,
            }}
            scroll={{ x: 900 }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {selectedRowKeys.length ? `${selectedRowKeys.length} sélectionné(s)` : 'Aucune sélection'}
              </div>
              <Space wrap>
                <Button danger disabled={!selectedRowKeys.length} onClick={() => void doBulkDelete()} icon={<DeleteOutlined />}>Supprimer</Button>
              </Space>
            </div>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((p) => (
            <Card key={p.id} hoverable styles={{ body: { padding: 12 } }}>
              <div className="space-y-2">
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
                    <Checkbox
                      checked={selectedRowKeys.includes(p.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedRowKeys((prev) => {
                          const set = new Set(prev.map(String));
                          if (checked) set.add(String(p.id));
                          else set.delete(String(p.id));
                          return Array.from(set);
                        });
                      }}
                    />
                  </div>
                  <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.main_image ? (
                      <Image
                        src={p.main_image}
                        alt={String(p.name || 'Produit')}
                        width={800}
                        height={800}
                        sizes="(max-width: 768px) 50vw, 25vw"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Empty description={false} />
                    )}
                  </div>

                  <div className="opacity-0 hover:opacity-100 transition-opacity" style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Space size={6}>
                      <Tooltip title="Voir">
                        <Button size="small" icon={<EyeOutlined />} onClick={(e) => {
                          e.stopPropagation();
                          void loadProductDetails(p.id);
                        }} />
                      </Tooltip>
                      <Tooltip title="Modifier">
                        <Button size="small" icon={<EditOutlined />} onClick={(e) => {
                          e.stopPropagation();
                          void loadProductForEdit(p.id);
                        }} />
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await deleteProduct(p.id);
                            message.success('Supprimé');
                            void load();
                          } catch (e: any) {
                            message.error(e?.message || 'Erreur');
                          }
                        }} />
                      </Tooltip>
                    </Space>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 truncate">{p.sku || p.id.slice(0, 8)}</div>
                  </div>
                  <Tag color={Number(p.quantity || 0) > 10 ? 'green' : Number(p.quantity || 0) > 0 ? 'gold' : 'red'}>{Number(p.quantity || 0)}</Tag>
                </div>

                <div className="text-xs text-gray-500 truncate">{p.category?.name || 'Non catégorisé'}</div>

                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-indigo-600 text-sm">{Number(p.price || 0).toLocaleString('fr-FR')} FCFA</div>
                  <div className="flex gap-1">
                    <Tag color={(p as any).is_active === false ? 'default' : 'blue'}>{(p as any).is_active === false ? 'Inactif' : 'Actif'}</Tag>
                  </div>
                </div>

                <div className="flex justify-end lg:hidden">
                  <Button size="small" icon={<EyeOutlined />} onClick={(e) => {
                    e.stopPropagation();
                    void loadProductDetails(p.id);
                  }}>Voir</Button>
                  <Button size="small" icon={<EditOutlined />} style={{ marginLeft: 8 }} onClick={(e) => {
                    e.stopPropagation();
                    void loadProductForEdit(p.id);
                  }}>Modifier</Button>
                </div>
              </div>
            </Card>
          ))}
          </div>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        title={drawerProduct?.name || (drawerLoading ? 'Chargement…' : 'Produit')}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerProduct(null);
          setDrawerError(null);
        }}
        size="large"
        extra={drawerProduct ? (
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => void loadAnalytics(drawerProduct.id)}>Analyse 30j</Button>
            <Button icon={<EditOutlined />} onClick={() => void loadProductForEdit(drawerProduct.id)}>Modifier</Button>
          </Space>
        ) : null}
      >
        {drawerLoading ? (
          <div className="py-10 flex justify-center"><Skeleton active paragraph={{ rows: 6 }} /></div>
        ) : drawerError ? (
          <Card>
            <Typography.Text type="danger">{drawerError}</Typography.Text>
          </Card>
        ) : drawerProduct ? (
          <div className="space-y-3">
            <Card styles={{ body: { padding: 14 } }}>
              <div className="flex flex-col md:flex-row gap-3">
                <div style={{ width: 180, height: 180, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.04)' }}>
                  {(() => {
                    const imgs = Array.isArray(drawerProduct.images) ? drawerProduct.images : [];
                    const src = drawerProduct.main_image || imgs[0] || null;
                    return src ? (
                      <AntdImage src={src} alt="" width={180} height={180} preview={false} style={{ objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Empty description={false} />
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-1 min-w-0">
                  <Typography.Title level={4} style={{ margin: 0 }}>{drawerProduct.name || '—'}</Typography.Title>
                  <div style={{ marginTop: 6 }}>
                    <Space wrap size={8}>
                      {drawerProduct.sku ? <Tag>SKU: {drawerProduct.sku}</Tag> : null}
                      <Tag color={Number(drawerProduct.quantity || 0) > 10 ? 'green' : Number(drawerProduct.quantity || 0) > 0 ? 'gold' : 'red'}>
                        Stock: {Number(drawerProduct.quantity || 0)}
                      </Tag>
                      <Tag color="blue">Prix: {Number(drawerProduct.price || 0).toLocaleString('fr-FR')} FCFA</Tag>
                    </Space>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    {(() => {
                      const c = drawerProduct.categories;
                      const cat = Array.isArray(c) ? (c[0] || null) : (c || null);
                      return cat?.name ? <Typography.Text type="secondary">Catégorie: {cat.name}</Typography.Text> : <Typography.Text type="secondary">Catégorie: —</Typography.Text>;
                    })()}
                  </div>

                  {drawerProduct.description ? (
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text type="secondary">Description</Typography.Text>
                      <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{drawerProduct.description}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card title="Analyse (30 jours)" styles={{ body: { padding: 14 } }}>
              {analyticsLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (analyticsProductId && drawerProduct?.id && analyticsProductId !== drawerProduct.id) ? (
                <Typography.Text type="secondary">Chargement…</Typography.Text>
              ) : analytics ? (
                (() => {
                  const pct = (cur: number, prev: number) => {
                    if (!prev && !cur) return 0;
                    if (!prev) return 100;
                    return ((cur - prev) / prev) * 100;
                  };
                  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`;
                  const badgeColor = (v: number) => (v >= 0 ? 'green' : 'red');
                  const seriesBar = (series: Array<{ day: string; value: number }>, color: string) => {
                    const max = Math.max(1, ...series.map((s) => s.value));
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${series.length}, 1fr)`, gap: 2, height: 34, alignItems: 'end' }}>
                        {series.map((s) => (
                          <div key={s.day} title={`${s.day}: ${Math.round(s.value)}`} style={{ height: `${Math.max(2, (s.value / max) * 34)}px`, background: color, borderRadius: 3, opacity: 0.9 }} />
                        ))}
                      </div>
                    );
                  };

                  const vViews = pct(analytics.views30d, analytics.viewsPrev30d);
                  const vOrders = pct(analytics.ordersCount30d, analytics.ordersCountPrev30d);
                  const vQty = pct(analytics.qtySold30d, analytics.qtySoldPrev30d);
                  const vRev = pct(analytics.revenue30d, analytics.revenuePrev30d);

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Card>
                          <div className="text-xs text-gray-500">Vues</div>
                          <div className="text-2xl font-extrabold">{analytics.views30d}</div>
                          <div style={{ marginTop: 6 }}><Tag color={badgeColor(vViews)}>{fmtPct(vViews)}</Tag><Typography.Text type="secondary"> vs 30j préc.</Typography.Text></div>
                        </Card>
                        <Card>
                          <div className="text-xs text-gray-500">Commandes</div>
                          <div className="text-2xl font-extrabold">{analytics.ordersCount30d}</div>
                          <div style={{ marginTop: 6 }}><Tag color={badgeColor(vOrders)}>{fmtPct(vOrders)}</Tag><Typography.Text type="secondary"> vs 30j préc.</Typography.Text></div>
                        </Card>
                        <Card>
                          <div className="text-xs text-gray-500">Qté vendue</div>
                          <div className="text-2xl font-extrabold">{analytics.qtySold30d}</div>
                          <div style={{ marginTop: 6 }}><Tag color={badgeColor(vQty)}>{fmtPct(vQty)}</Tag><Typography.Text type="secondary"> vs 30j préc.</Typography.Text></div>
                        </Card>
                        <Card>
                          <div className="text-xs text-gray-500">CA</div>
                          <div className="text-2xl font-extrabold">{Math.round(analytics.revenue30d).toLocaleString('fr-FR')} FCFA</div>
                          <div style={{ marginTop: 6 }}><Tag color={badgeColor(vRev)}>{fmtPct(vRev)}</Tag><Typography.Text type="secondary"> vs 30j préc.</Typography.Text></div>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <Card title="Vues (jour par jour)" styles={{ body: { padding: 12 } }}>
                          {seriesBar(analytics.viewsSeries, '#4f46e5')}
                        </Card>
                        <Card title="Commandes (jour par jour)" styles={{ body: { padding: 12 } }}>
                          {seriesBar(analytics.ordersSeries, '#16a34a')}
                        </Card>
                        <Card title="CA (jour par jour)" styles={{ body: { padding: 12 } }}>
                          {seriesBar(analytics.revenueSeries, '#f59e0b')}
                        </Card>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <Typography.Text type="secondary">Aucune donnée disponible (ou accès refusé par RLS)</Typography.Text>
              )}
            </Card>
          </div>
        ) : (
          <Empty description="Produit introuvable" />
        )}
      </Drawer>

      <Drawer
        open={editOpen}
        title="Modifier le produit"
        onClose={() => setEditOpen(false)}
        size="large"
        extra={(
          <Space>
            <Button onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button type="primary" loading={editSaving} onClick={() => void saveEdit()}>Enregistrer</Button>
          </Space>
        )}
      >
        {editError ? (
          <Card>
            <Typography.Text type="danger">{editError}</Typography.Text>
          </Card>
        ) : null}

        <div className="space-y-3">
          <Card title="Identité" styles={{ body: { padding: 14 } }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <Typography.Text type="secondary">Nom</Typography.Text>
                <Input value={String(editPatch.name ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Typography.Text type="secondary">SKU</Typography.Text>
                <Input value={String(editPatch.sku ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, sku: e.target.value }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Slug</Typography.Text>
                <Input value={String(editPatch.slug ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, slug: e.target.value }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Catégorie</Typography.Text>
                <Select
                  value={(editPatch.category_id as any) ?? null}
                  onChange={(v) => setEditPatch((p) => ({ ...p, category_id: v }))}
                  options={categories.filter((c) => c.value !== 'all')}
                  allowClear
                  placeholder="Choisir une catégorie"
                />
              </div>
              <div>
                <Typography.Text type="secondary">Marque</Typography.Text>
                <Input value={String(editPatch.brand ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, brand: e.target.value }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Modèle</Typography.Text>
                <Input value={String(editPatch.model ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, model: e.target.value }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Code-barres</Typography.Text>
                <Input value={String(editPatch.barcode ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, barcode: e.target.value }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Statut</Typography.Text>
                <Select
                  value={String(editPatch.status ?? 'available')}
                  onChange={(v) => setEditPatch((p) => ({ ...p, status: v }))}
                  options={[
                    { value: 'available', label: 'Disponible' },
                    { value: 'out_of_stock', label: 'Rupture' },
                    { value: 'discontinued', label: 'Arrêté' },
                  ]}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Actif</Typography.Text>
                <div style={{ marginTop: 6 }}>
                  <Switch checked={editPatch.is_active !== false} onChange={(v) => setEditPatch((p) => ({ ...p, is_active: v }))} />
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">En vedette</Typography.Text>
                <div style={{ marginTop: 6 }}>
                  <Switch checked={!!editPatch.is_featured} onChange={(v) => setEditPatch((p) => ({ ...p, is_featured: v }))} />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Prix" styles={{ body: { padding: 14 } }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div>
                <Typography.Text type="secondary">Prix (FCFA)</Typography.Text>
                <InputNumber style={{ width: '100%' }} min={0} value={Number(editPatch.price || 0)} onChange={(v) => setEditPatch((p) => ({ ...p, price: Number(v || 0) }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Prix barré (FCFA)</Typography.Text>
                <InputNumber style={{ width: '100%' }} min={0} value={editPatch.compare_at_price == null ? null : Number(editPatch.compare_at_price)} onChange={(v) => setEditPatch((p) => ({ ...p, compare_at_price: v == null ? null : Number(v) }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Prix de revient (FCFA)</Typography.Text>
                <InputNumber style={{ width: '100%' }} min={0} value={editPatch.cost_price == null ? null : Number(editPatch.cost_price)} onChange={(v) => setEditPatch((p) => ({ ...p, cost_price: v == null ? null : Number(v) }))} />
              </div>
            </div>
          </Card>

          <Card title="Stock" styles={{ body: { padding: 14 } }}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div>
                <Typography.Text type="secondary">Suivi de stock</Typography.Text>
                <div style={{ marginTop: 6 }}>
                  <Switch checked={editPatch.track_quantity !== false} onChange={(v) => setEditPatch((p) => ({ ...p, track_quantity: v }))} />
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">Stock</Typography.Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  disabled={editPatch.track_quantity === false}
                  value={Number(editPatch.quantity || 0)}
                  onChange={(v) => setEditPatch((p) => ({ ...p, quantity: Number(v || 0) }))}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Seuil stock faible</Typography.Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  disabled={editPatch.track_quantity === false}
                  value={Number(editPatch.low_stock_threshold || 0)}
                  onChange={(v) => setEditPatch((p) => ({ ...p, low_stock_threshold: Number(v || 0) }))}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Unité</Typography.Text>
                <Input value={String(editPatch.unit ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, unit: e.target.value }))} placeholder="pièce" />
              </div>
              <div>
                <Typography.Text type="secondary">Poids</Typography.Text>
                <InputNumber style={{ width: '100%' }} min={0} value={editPatch.weight == null ? null : Number(editPatch.weight)} onChange={(v) => setEditPatch((p) => ({ ...p, weight: v == null ? null : Number(v) }))} />
              </div>
            </div>
          </Card>

          <Card title="Médias" styles={{ body: { padding: 14 } }}>
            <div className="flex flex-col lg:flex-row gap-3">
              <div style={{ width: 220, height: 220, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.04)' }}>
                {editPatch.main_image ? (
                  <AntdImage src={String(editPatch.main_image)} alt="" width={220} height={220} preview={false} style={{ objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Empty description={false} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Typography.Text type="secondary">Image principale (URL)</Typography.Text>
                <Input value={String(editPatch.main_image ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, main_image: e.target.value }))} />
                <div style={{ marginTop: 8 }}>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void uploadMainImage(file as any as File);
                      return false;
                    }}
                  >
                    <Button loading={uploading}>
                      Uploader depuis le PC{uploadProgress != null ? ` (${uploadProgress}%)` : ''}
                    </Button>
                  </Upload>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Contenu" styles={{ body: { padding: 14 } }}>
            <div className="space-y-3">
              <div>
                <Typography.Text type="secondary">Description courte</Typography.Text>
                <Input.TextArea
                  value={String(editPatch.short_description ?? '')}
                  onChange={(e) => setEditPatch((p) => ({ ...p, short_description: e.target.value }))}
                  autoSize={{ minRows: 2, maxRows: 5 }}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Description</Typography.Text>
                <Input.TextArea
                  value={String(editPatch.description ?? '')}
                  onChange={(e) => setEditPatch((p) => ({ ...p, description: e.target.value }))}
                  autoSize={{ minRows: 4, maxRows: 10 }}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Tags (séparés par virgule)</Typography.Text>
                <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="ex: textile, sneakers, cuir" />
              </div>
            </div>
          </Card>

          <Card title="SEO" styles={{ body: { padding: 14 } }}>
            <div className="space-y-3">
              <div>
                <Typography.Text type="secondary">Meta title</Typography.Text>
                <Input value={String(editPatch.meta_title ?? '')} onChange={(e) => setEditPatch((p) => ({ ...p, meta_title: e.target.value }))} />
              </div>
              <div>
                <Typography.Text type="secondary">Meta description</Typography.Text>
                <Input.TextArea
                  value={String(editPatch.meta_description ?? '')}
                  onChange={(e) => setEditPatch((p) => ({ ...p, meta_description: e.target.value }))}
                  autoSize={{ minRows: 2, maxRows: 5 }}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Meta keywords (séparés par virgule)</Typography.Text>
                <Input value={metaKeywordsText} onChange={(e) => setMetaKeywordsText(e.target.value)} placeholder="ex: chaussures, kappa, sneakers" />
              </div>
            </div>
          </Card>

          <Collapse
            items={[
              {
                key: 'advanced',
                label: 'Avancé (JSON)',
                children: (
                  <div className="space-y-3">
                    <div>
                      <Typography.Text type="secondary">Images (JSON)</Typography.Text>
                      <Input.TextArea
                        value={imagesText}
                        onChange={(e) => setImagesText(e.target.value)}
                        placeholder='["https://...", "https://..."]'
                        autoSize={{ minRows: 4, maxRows: 10 }}
                      />
                    </div>
                    <div>
                      <Typography.Text type="secondary">Dimensions (JSON)</Typography.Text>
                      <Input.TextArea
                        value={dimensionsText}
                        onChange={(e) => setDimensionsText(e.target.value)}
                        placeholder='{"length":0,"width":0,"height":0}'
                        autoSize={{ minRows: 3, maxRows: 10 }}
                      />
                    </div>
                    <div>
                      <Typography.Text type="secondary">Spécifications (JSON)</Typography.Text>
                      <Input.TextArea
                        value={specificationsText}
                        onChange={(e) => setSpecificationsText(e.target.value)}
                        placeholder='{"color":"rouge","size":"XL"}'
                        autoSize={{ minRows: 3, maxRows: 10 }}
                      />
                    </div>
                    <div>
                      <Typography.Text type="secondary">Métadonnées (JSON)</Typography.Text>
                      <Input.TextArea
                        value={metadataText}
                        onChange={(e) => setMetadataText(e.target.value)}
                        placeholder='{"material":"cuir"}'
                        autoSize={{ minRows: 4, maxRows: 10 }}
                      />
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Drawer>
    </div>
  );
}
