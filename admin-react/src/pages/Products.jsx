import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Eye, RefreshCw, LayoutGrid, List, ImageOff, Loader2, AlertCircle, X, Scan } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase, AdminProductService } from '../services/supabaseService';
import ProductForm from '../components/ProductForm';
import { useDark } from '../components/Layout';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';

const PAGE_SIZE = 24;

function Products() {
  const { dark } = useDark();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [scanning, setScanning]           = useState(false);
  const [scanResult, setScanResult]       = useState(null);
  const enqueueSnackbar = useCallback((msg, { variant } = {}) => { variant === 'error' ? toast.error(msg) : variant === 'warning' ? toast(msg) : toast.success(msg); }, []);
  const searchTimer = useRef(null);

  // Debounce de la recherche (350ms)
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPage(1);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchText]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('products')
        .select('*, category:categories(id, name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (debouncedSearch.trim()) {
        query = query.ilike('name', `%${debouncedSearch.trim()}%`);
      }
      const { data, error: fetchErr, count } = await query;
      if (fetchErr) throw fetchErr;
      const transformed = (data || []).map(p => ({
        ...p,
        stock: p.quantity,
        status: p.quantity > 10 ? 'active' : p.quantity > 0 ? 'low-stock' : 'out-of-stock',
        category: p.category?.name || 'Non catégorisé',
        image: p.main_image || p.images?.[0] || null,
      }));
      setProducts(transformed);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err.message);
      enqueueSnackbar(`Erreur: ${err.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, enqueueSnackbar]);

  // Chargement des catégories (une seule fois)
  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => {
      setCategories(data || []);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime chirurgical — pas de rechargement complet
  useEffect(() => {
    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, () => {
        if (page === 1) loadData(); else setPage(1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(prev => prev.map(p =>
          p.id === payload.new.id
            ? { ...p, ...payload.new,
                stock: payload.new.quantity,
                status: payload.new.quantity > 10 ? 'active' : payload.new.quantity > 0 ? 'low-stock' : 'out-of-stock',
                image: payload.new.main_image || payload.new.images?.[0] || null }
            : p
        ));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(prev => prev.filter(p => p.id !== payload.old.id));
        setTotalCount(prev => Math.max(0, prev - 1));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [page, loadData]);

  const handleAddProduct = () => { setSelectedProduct(null); setDialogOpen(true); };
  const handleEditProduct = (product) => { setSelectedProduct(product); setDialogOpen(true); };
  const handleViewProduct = (product) => { setViewProduct(product); setViewDialogOpen(true); };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Supprimer ce produit ?')) return;
    try {
      const result = await AdminProductService.delete(id);
      if (!result.success) throw new Error(result.error);
      setProducts(prev => prev.filter(p => p.id !== id));
      setTotalCount(prev => Math.max(0, prev - 1));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      enqueueSnackbar('Produit supprimé', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(`Erreur: ${err.message}`, { variant: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Supprimer ${selectedIds.size} produit(s) sélectionné(s) ?`)) return;
    setBulkDeleting(true);
    let count = 0;
    for (const id of selectedIds) {
      try { const r = await AdminProductService.delete(id); if (r.success) count++; } catch (_) {}
    }
    await loadData();
    setSelectedIds(new Set());
    setBulkDeleting(false);
    enqueueSnackbar(`${count} produit(s) supprimé(s)`, { variant: 'success' });
  };

  const handleDeleteNoImage = async () => {
    if (!window.confirm('Supprimer tous les produits sans image ?')) return;
    setBulkDeleting(true);
    try {
      const { data: noImg } = await supabase.from('products').select('id').is('main_image', null);
      if (!noImg?.length) { enqueueSnackbar('Aucun produit sans image', { variant: 'info' }); return; }
      const ids = noImg.map(p => p.id);
      await supabase.from('products').delete().in('id', ids);
      await loadData();
      enqueueSnackbar(`${ids.length} produit(s) sans image supprimé(s)`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(`Erreur: ${err.message}`, { variant: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleScanImages = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const { data: allProds } = await supabase
        .from('products').select('id, name, main_image').not('main_image', 'is', null);
      if (!allProds?.length) {
        enqueueSnackbar('Aucun produit avec image à scanner', { variant: 'info' });
        return;
      }
      let invalid = [];
      const CONC = 5;
      for (let i = 0; i < allProds.length; i += CONC) {
        const batch = allProds.slice(i, i + CONC);
        await Promise.all(batch.map(async (prod) => {
          try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 7000);
            const res = await fetch(prod.main_image, { method: 'HEAD', signal: ctrl.signal });
            clearTimeout(tid);
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            const cl = parseInt(res.headers.get('content-length') || '0', 10);
            if (res.status !== 200 || !ct.startsWith('image/') || (cl > 0 && cl < 10240)) {
              invalid.push({ ...prod, reason: !ct.startsWith('image/') ? `Content-Type: ${ct || 'absent'}` : res.status !== 200 ? `HTTP ${res.status}` : `Trop petite (${cl}B)` });
            }
          } catch (e) {
            invalid.push({ ...prod, reason: e.name === 'AbortError' ? 'Timeout' : 'Erreur réseau' });
          }
        }));
      }
      setScanResult({ total: allProds.length, invalid });
      if (invalid.length === 0) {
        enqueueSnackbar(`✅ ${allProds.length} images valides`, { variant: 'success' });
      } else {
        enqueueSnackbar(`⚠️ ${invalid.length} image(s) invalide(s) détectée(s)`, { variant: 'warning' });
      }
    } catch (err) {
      enqueueSnackbar(`Erreur scan: ${err.message}`, { variant: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const handleNullifyInvalidImages = async () => {
    if (!scanResult?.invalid?.length) return;
    if (!window.confirm(`Nullifier les images de ${scanResult.invalid.length} produit(s) invalide(s) ?`)) return;
    const ids = scanResult.invalid.map(p => p.id);
    await supabase.from('products').update({ main_image: null }).in('id', ids);
    setScanResult(null);
    await loadData();
    enqueueSnackbar(`${ids.length} image(s) invalidée(s)`, { variant: 'success' });
  };

  const handleSaveProduct = async (productData) => {
    try {
      const supabaseData = {
        sku: productData.sku || `SKU-${Date.now()}`,
        name: productData.name,
        description: productData.description || productData.short_description || '',
        category_id: productData.category_id,
        brand: productData.brand,
        price: parseFloat(productData.price) || 0,
        compare_at_price: productData.compare_at_price ? parseFloat(productData.compare_at_price) : null,
        quantity: parseInt(productData.quantity) || 0,
        images: productData.images || [],
        main_image: productData.main_image || productData.images?.[0] || null,
        specifications: productData.specifications || {},
        tags: productData.tags
          ? (typeof productData.tags === 'string'
            ? productData.tags.split(',').map(t => t.trim()).filter(Boolean)
            : productData.tags)
          : [],
        is_featured: productData.is_featured || false,
        is_active: productData.is_active !== false,
      };
      if (selectedProduct) {
        const result = await AdminProductService.update(selectedProduct.id, supabaseData);
        if (!result.success) throw new Error(result.error);
        enqueueSnackbar('Produit mis à jour', { variant: 'success' });
      } else {
        const result = await AdminProductService.create(supabaseData);
        if (!result.success) throw new Error(result.error);
        enqueueSnackbar('Produit créé', { variant: 'success' });
      }
      setDialogOpen(false);
      setSelectedProduct(null);
      await loadData();
    } catch (err) {
      enqueueSnackbar(`Erreur: ${err.message}`, { variant: 'error' });
    }
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {error && (
        <div className={`flex items-start gap-3 p-4 rounded-xl text-sm ${dark ? 'bg-red-900/30 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Gestion des produits</h1>
            <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Gérez votre inventaire de produits</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw size={14} /> Rafraîchir</Button>
            <Button variant="outline" size="sm" onClick={handleDeleteNoImage} disabled={bulkDeleting}><ImageOff size={14} /> <span className="hidden sm:inline">Sans image</span></Button>
            <Button variant="outline" size="sm" onClick={handleScanImages} disabled={scanning || loading}>
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Scan size={14} />} {scanning ? 'Scan…' : 'Scanner'}
            </Button>
            {scanResult?.invalid?.length > 0 && (
              <Button variant="warning" size="sm" onClick={handleNullifyInvalidImages}>Nettoyer {scanResult.invalid.length}</Button>
            )}
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer ({selectedIds.size})
              </Button>
            )}
            <Button size="sm" onClick={handleAddProduct}><Plus size={15} /> Ajouter</Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: totalCount, bg: 'bg-indigo-50 dark:bg-indigo-900/30', color: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Actifs', value: products.filter(p => p.status === 'active').length, bg: 'bg-green-50 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
          { label: 'Stock faible', value: products.filter(p => p.status === 'low-stock').length, bg: 'bg-amber-50 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Rupture', value: products.filter(p => p.status === 'out-of-stock').length, bg: 'bg-red-50 dark:bg-red-900/30', color: 'text-red-500 dark:text-red-400' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <p className={`text-3xl font-extrabold ${s.color}`}>{loading ? '…' : s.value}</p>
            <p className={`text-xs font-semibold mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs w-full">
          <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
          <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Rechercher des produits..." className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setViewMode('grid')} className={`p-2 border rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-indigo-500 border-indigo-500 text-white' : dark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><LayoutGrid size={16} /></button>
          <button onClick={() => setViewMode('table')} className={`p-2 border rounded-xl transition-colors ${viewMode === 'table' ? 'bg-indigo-500 border-indigo-500 text-white' : dark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><List size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
      ) : products.length === 0 ? (
        <div className={`flex flex-col items-center py-20 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
          <span className="text-5xl mb-3">📦</span>
          <p className="text-base font-medium mb-4">Aucun produit trouvé</p>
          <Button size="sm" onClick={handleAddProduct}><Plus size={15} /> Créer un produit</Button>
        </div>
      ) : viewMode === 'table' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={dark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-50/80 border-b border-gray-100'}>
                  <th className="px-3 py-2.5 w-10"><input type="checkbox" checked={products.length > 0 && selectedIds.size === products.length} onChange={toggleSelectAll} className="rounded" /></th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Produit</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Prix</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Catégorie</th>
                  <th className={`px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Stock</th>
                  <th className={`px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-50'}>
                {products.map(p => (
                  <tr key={p.id} className={`transition-colors ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-2.5"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {p.image ? <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" onError={e => { e.target.style.display='none'; }} /> : <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}><ImageOff size={14} className={dark ? 'text-slate-500' : 'text-gray-300'} /></div>}
                        <span className={`text-xs font-medium truncate max-w-[180px] ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-xs text-indigo-500 whitespace-nowrap">{Number(p.price || 0).toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-3 py-2.5 hidden md:table-cell"><Badge variant="default" className="text-[10px]">{p.category}</Badge></td>
                    <td className="px-3 py-2.5 text-center"><Badge variant={p.stock > 10 ? 'success' : p.stock > 0 ? 'warning' : 'destructive'} className="text-[10px]">{p.stock}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => handleEditProduct(p)} className={`p-1.5 rounded-lg text-indigo-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`}><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteProduct(p.id)} className={`p-1.5 rounded-lg text-red-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}><Trash2 size={14} /></button>
                        <button onClick={() => handleViewProduct(p)} className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}><Eye size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(product => (
            <motion.div key={product.id} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <Card className={`overflow-hidden flex flex-col h-full ${selectedIds.has(product.id) ? 'ring-2 ring-indigo-400' : ''}`}>
                <div className={`aspect-[4/3] relative overflow-hidden ${dark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                  {product.image
                    ? <img src={product.image} alt={product.name} loading="lazy" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                    : <div className="h-full flex items-center justify-center"><ImageOff size={40} className={dark ? 'text-slate-600' : 'text-gray-200'} /></div>}
                  <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelect(product.id)} className="absolute top-2 left-2 rounded bg-white/90 shadow-sm" />
                  {product.is_featured && <span className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow">Featured</span>}
                  {product.stock === 0 && <div className="absolute bottom-0 inset-x-0 bg-red-500/85 text-white text-[11px] font-bold text-center py-1">Rupture de stock</div>}
                </div>
                <CardContent className="p-3 flex flex-col flex-1">
                  <p className={`text-sm font-bold truncate mb-1 ${dark ? 'text-slate-100' : 'text-gray-800'}`} title={product.name}>{product.name}</p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-sm font-extrabold text-indigo-500">{Number(product.price || 0).toLocaleString('fr-FR')} FCFA</span>
                    {product.compare_at_price > product.price && <span className={`text-[11px] line-through ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{Number(product.compare_at_price).toLocaleString('fr-FR')}</span>}
                  </div>
                  <div className="flex gap-1 flex-wrap mb-3">
                    <Badge variant="default" className="text-[10px]">{product.category}</Badge>
                    <Badge variant={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'destructive'} className="text-[10px]">Stock: {product.stock}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex gap-1">
                      <button onClick={() => handleEditProduct(product)} className={`p-1.5 rounded-lg text-indigo-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`}><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteProduct(product.id)} className={`p-1.5 rounded-lg text-red-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}><Trash2 size={13} /></button>
                    </div>
                    <button onClick={() => handleViewProduct(product)} className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}><Eye size={13} /></button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <span className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{totalCount} produit(s) — page {page}/{totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(n => (
              <Button key={n} variant={n === page ? 'default' : 'outline'} size="icon-sm" onClick={() => setPage(n)}>{n}</Button>
            ))}
            <Button variant="outline" size="icon-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</Button>
          </div>
        </div>
      )}

      <ProductForm open={dialogOpen} onClose={() => { setDialogOpen(false); setSelectedProduct(null); }} product={selectedProduct} categories={categories} onSave={handleSaveProduct} />

      {viewDialogOpen && viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Détails du produit</h2>
              <button onClick={() => { setViewDialogOpen(false); setViewProduct(null); }} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3 flex-1">
              {viewProduct.image && <img src={viewProduct.image} alt={viewProduct.name} className={`w-full h-52 object-contain rounded-xl ${dark ? 'bg-slate-700' : 'bg-gray-50'}`} />}
              <h3 className={`font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>{viewProduct.name}</h3>
              <p className="text-lg font-extrabold text-indigo-500">{Number(viewProduct.price || 0).toLocaleString('fr-FR')} FCFA</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="default">{viewProduct.category}</Badge>
                <Badge variant={viewProduct.stock > 10 ? 'success' : 'warning'}>Stock: {viewProduct.stock}</Badge>
              </div>
              {viewProduct.brand && <p className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-600'}`}>Marque: <span className="font-medium">{viewProduct.brand}</span></p>}
              {viewProduct.sku && <p className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-600'}`}>SKU: <span className="font-medium">{viewProduct.sku}</span></p>}
              {viewProduct.description && <p className={`text-sm mt-2 ${dark ? 'text-slate-300' : 'text-gray-600'}`}>{viewProduct.description}</p>}
            </div>
            <div className={`px-5 py-4 border-t flex justify-end ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <Button variant="outline" size="sm" onClick={() => { setViewDialogOpen(false); setViewProduct(null); }}>Fermer</Button>
            </div>
          </motion.div>
        </div>
      )}

      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleAddProduct}
        className="fixed bottom-6 right-6 w-14 h-14 flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-40">
        <Plus size={22} />
      </motion.button>
    </div>
  );
}

export default Products;
