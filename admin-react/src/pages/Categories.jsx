import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Pencil, Trash2, Plus, LayoutGrid, List, Camera,
  RefreshCw, X, Save, Search, Loader2, AlertCircle,
  Package, ChevronRight, Hash, FolderTree, Layers,
  CheckCircle, XCircle, Eye, BarChart3,
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useDark } from '../components/Layout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import toast from 'react-hot-toast';

// ── Gradient & Icon helpers ───────────────────────────────────────────────────
const CATEGORY_ICONS = [
  '📱','💻','🖥️','⌚','📷','🎮','🎧','📺','🔌','🔋',
  '👕','👗','👔','👠','👟','🧣','👜','💍','🧴','💄',
  '🏠','🛋️','🪴','🍳','🪑','🛏️','🧹','💡','🚿','🔑',
  '🏋️','⚽','🏀','🎾','🏊','🚴','🤸','🥊','🎿','🏄',
  '🍎','🥦','🥩','🍞','🧀','🍫','☕','🍷','🧃','🧁',
  '📚','🎨','🎭','🎵','📖','✏️','🖌️','🎬','📝','🗺️',
  '💊','🏥','🌿','💆','🧘','🩺','🔬','🧪','🩹','❤️‍🔥',
  '🚗','✈️','🚢','🚲','🛵','🏕️','🧳','🗺️','🚀','⛽',
  '🌟','💎','🏆','🎁','🎉','🛒','🏷️','💰','🤝','✨',
];

const GRADIENTS = [
  ['#667eea','#764ba2'],['#f093fb','#f5576c'],['#4facfe','#00f2fe'],
  ['#43e97b','#38f9d7'],['#fa709a','#fee140'],['#30cfd0','#667eea'],
  ['#a18cd1','#fbc2eb'],['#fad961','#f76b1c'],['#89f7fe','#66a6ff'],
  ['#d4fc79','#96e6a1'],['#f6d365','#fda085'],['#fddb92','#d1fdff'],
];

const getGradient = (name, idx) => {
  const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[(h + idx) % GRADIENTS.length];
};

const suggestIcon = (name = '') => {
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
};

const slugify = (str = '') =>
  str.toLowerCase()
    .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ùûü]/g, 'u')
    .replace(/[ôö]/g, 'o').replace(/[ïî]/g, 'i').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Field component ────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

const inputCls = `w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm
  focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
  bg-white dark:bg-slate-700 dark:text-slate-100 transition placeholder-gray-400 dark:placeholder-slate-500`;

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, bg, color, Icon }) {
  return (
    <div className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
      <div className={`p-2.5 rounded-xl bg-white/70 dark:bg-black/20`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className={`text-2xl font-extrabold leading-none ${color}`}>{value}</p>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const Categories = () => {
  const { dark } = useDark();
  const [categories, setCategories]     = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [searchTerm, setSearchTerm]     = useState('');
  const [openDialog, setOpenDialog]     = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [uploadingImage, setUploadingImage]   = useState(false);
  const [viewMode, setViewMode]         = useState('grid');
  const [saving, setSaving]             = useState(false);

  const [formData, setFormData] = useState({
    name:          '',
    description:   '',
    image_url:     '',
    icon:          '',
    is_active:     true,
    display_order: 0,
    parent_id:     '',
    slug:          '',
    link_url:      '',
  });

  const setF = (key, val) => setFormData(p => ({
    ...p,
    [key]: val,
    ...(key === 'name' ? { slug: slugify(val) } : {}),
  }));

  // ── Load categories + product counts ─────────────────────────────────────
  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('display_order').order('name'),
        supabase.from('products').select('category_id').eq('is_active', true),
      ]);

      if (catRes.error) throw catRes.error;

      const cats = (catRes.data || []).filter(c =>
        !c.name?.toLowerCase().includes('__diag')
      );
      setCategories(cats);

      // Build product count map
      const counts = {};
      (prodRes.data || []).forEach(p => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
      setProductCounts(counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const rootCategories  = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const subCategories   = useMemo(() => categories.filter(c => !!c.parent_id), [categories]);

  const stats = useMemo(() => ({
    total:    categories.length,
    active:   categories.filter(c => c.is_active).length,
    inactive: categories.filter(c => !c.is_active).length,
    subs:     subCategories.length,
    withImg:  categories.filter(c => c.image_url).length,
  }), [categories, subCategories]);

  const parentName = useCallback((cat) => {
    if (!cat.parent_id) return null;
    return categories.find(c => c.id === cat.parent_id)?.name || '—';
  }, [categories]);

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `categories/${Date.now()}_${Math.random().toString(36).slice(7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
      setF('image_url', publicUrl);
      toast.success('Image uploadée');
    } catch (err) {
      toast.error(`Erreur upload: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '', description: '', image_url: '', icon: '',
      is_active: true, display_order: rootCategories.length,
      parent_id: '', slug: '', link_url: '',
    });
    setOpenDialog(true);
  };

  const handleEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name:          cat.name || '',
      description:   cat.description || '',
      image_url:     cat.image_url || '',
      icon:          cat.icon || '',
      is_active:     cat.is_active !== false,
      display_order: cat.display_order || 0,
      parent_id:     cat.parent_id || '',
      slug:          cat.slug || slugify(cat.name),
      link_url:      cat.link_url || '',
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    try {
      const dataToSave = {
        name:          formData.name.trim(),
        description:   formData.description?.trim() || null,
        image_url:     formData.image_url || null,
        icon:          formData.icon || null,
        is_active:     !!formData.is_active,
        display_order: Number(formData.display_order) || 0,
        parent_id:     formData.parent_id || null,
        slug:          formData.slug || slugify(formData.name),
        link_url:      formData.link_url?.trim() || null,
        updated_at:    new Date().toISOString(),
      };

      if (editingCategory) {
        const { error } = await supabase.from('categories').update(dataToSave).eq('id', editingCategory.id);
        if (error) throw error;
        toast.success('Catégorie mise à jour');
      } else {
        const { error } = await supabase.from('categories').insert([dataToSave]);
        if (error) throw error;
        toast.success('Catégorie créée');
      }
      setOpenDialog(false);
      loadCategories();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    // Check children
    const children = categories.filter(c => c.parent_id === cat.id);
    if (children.length > 0) {
      toast.error(`Impossible : ${children.length} sous-catégorie(s) dépendante(s). Supprimez-les d'abord.`);
      return;
    }
    // Check products
    if ((productCounts[cat.id] || 0) > 0) {
      toast.error(`Impossible : ${productCounts[cat.id]} produit(s) lié(s). Déplacez-les d'abord.`);
      return;
    }
    if (!window.confirm(`Supprimer "${cat.name}" ?`)) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      if (error) throw error;
      toast.success('Catégorie supprimée');
      loadCategories();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (cat) => {
    try {
      const { error } = await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    categories.filter(c =>
      !searchTerm ||
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [categories, searchTerm]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
        <p className={`text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Chargement des catégories…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-start gap-3 p-4 rounded-2xl text-sm ${dark ? 'bg-red-900/30 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className={`text-2xl font-extrabold tracking-tight ${dark ? 'text-white' : 'bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'}`}>
              🗂️ Gestion des Catégories
            </h1>
            <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
              {stats.total} catégorie{stats.total !== 1 ? 's' : ''} · {stats.active} actives · {stats.subs} sous-catégories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={loadCategories} title="Actualiser">
              <RefreshCw size={15} />
            </Button>
            <button onClick={() => setViewMode('grid')}
              className={`p-2 border rounded-xl transition-colors text-sm ${viewMode === 'grid' ? 'bg-indigo-500 border-indigo-500 text-white' : dark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setViewMode('table')}
              className={`p-2 border rounded-xl transition-colors text-sm ${viewMode === 'table' ? 'bg-indigo-500 border-indigo-500 text-white' : dark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <List size={15} />
            </button>
            <Button size="sm" onClick={handleAdd}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md">
              <Plus size={15} /> Nouvelle catégorie
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',          value: stats.total,    sub: 'catégories',     bg: 'bg-indigo-50 dark:bg-indigo-900/30',  color: 'text-indigo-600 dark:text-indigo-400', Icon: Layers },
          { label: 'Actives',        value: stats.active,   sub: 'visibles',       bg: 'bg-emerald-50 dark:bg-emerald-900/30',color: 'text-emerald-600 dark:text-emerald-400',Icon: CheckCircle },
          { label: 'Inactives',      value: stats.inactive, sub: 'masquées',       bg: 'bg-red-50 dark:bg-red-900/30',        color: 'text-red-500 dark:text-red-400',      Icon: XCircle },
          { label: 'Sous-catégories',value: stats.subs,     sub: 'hiérarchiques',  bg: 'bg-purple-50 dark:bg-purple-900/30',  color: 'text-purple-600 dark:text-purple-400', Icon: FolderTree },
          { label: 'Avec image',     value: stats.withImg,  sub: 'illustrées',     bg: 'bg-amber-50 dark:bg-amber-900/30',    color: 'text-amber-600 dark:text-amber-400',  Icon: Camera },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <KpiCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Rechercher nom, description, slug…" className="pl-9 rounded-xl" />
      </div>

      {/* ── Grid View ── */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((cat, i) => {
            const [g1, g2] = getGradient(cat.name, i);
            const emoji = cat.icon || suggestIcon(cat.name);
            const count = productCounts[cat.id] || 0;
            const parent = parentName(cat);
            return (
              <motion.div key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2, delay: i * 0.025 }}
                className={`rounded-2xl overflow-hidden shadow-sm border transition-all group
                  ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 hover:shadow-md'}
                  ${!cat.is_active ? 'opacity-60' : ''}`}
              >
                {/* Card Image/Gradient */}
                <div className="h-24 flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: cat.image_url
                      ? `url(${cat.image_url}) center/cover`
                      : `linear-gradient(135deg, ${g1}, ${g2})`
                  }}>
                  {!cat.image_url && <span className="text-4xl leading-none select-none">{emoji}</span>}
                  {/* Badges */}
                  <span className={`absolute top-1.5 left-1.5 bg-white/90 dark:bg-black/60 text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${dark ? 'text-slate-200' : 'text-gray-600'}`}>
                    #{cat.display_order ?? 0}
                  </span>
                  {!cat.is_active && (
                    <span className="absolute top-1.5 right-1.5 bg-red-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-lg">
                      Inactif
                    </span>
                  )}
                  {parent && (
                    <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                      <ChevronRight size={8} /> {parent}
                    </span>
                  )}
                </div>
                {/* Card Body */}
                <div className="p-2.5">
                  <p className={`text-xs font-bold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`} title={cat.name}>
                    {cat.name}
                  </p>
                  {cat.slug && (
                    <p className={`text-[10px] truncate font-mono opacity-60 ${dark ? 'text-slate-400' : 'text-gray-400'}`}>
                      /{cat.slug}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[10px] font-semibold flex items-center gap-0.5
                      ${count > 0 ? 'text-indigo-500 dark:text-indigo-400' : dark ? 'text-slate-600' : 'text-gray-300'}`}>
                      <Package size={9} /> {count} produit{count !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(cat)}
                        className="p-1 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-500 hover:text-white text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => handleDelete(cat)}
                        className="p-1 bg-red-50 dark:bg-red-900/30 hover:bg-red-500 hover:text-white text-red-500 dark:text-red-400 rounded-lg transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className={`col-span-full flex flex-col items-center py-16 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
              <span className="text-5xl mb-3">🗂️</span>
              <p className="font-medium">Aucune catégorie trouvée</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Table View ── */
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className={dark ? 'bg-slate-800/70 border-b border-slate-700' : 'bg-gray-50/80 border-b border-gray-100'}>
                  {['Image / Icône', 'Nom & Slug', 'Parent', 'Produits', 'Statut', 'Ordre', 'Actions'].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={dark ? 'divide-y divide-slate-700/40' : 'divide-y divide-gray-50'}>
                {filtered.map((cat, i) => {
                  const count = productCounts[cat.id] || 0;
                  const parent = parentName(cat);
                  return (
                    <motion.tr key={cat.id}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`transition-colors group ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/30'}`}
                    >
                      <td className="px-4 py-3">
                        {cat.image_url
                          ? <img src={cat.image_url} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm ring-1 ring-black/5" />
                          : <span className="text-2xl select-none">{cat.icon || suggestIcon(cat.name)}</span>
                        }
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className={`font-semibold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{cat.name}</p>
                        {cat.slug && <p className={`text-[10px] font-mono truncate mt-0.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>/{cat.slug}</p>}
                      </td>
                      <td className={`px-4 py-3 text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {parent ? (
                          <span className="flex items-center gap-1">
                            <ChevronRight size={12} className="text-indigo-400" /> {parent}
                          </span>
                        ) : <span className={`text-xs ${dark ? 'text-slate-600' : 'text-gray-300'}`}>Racine</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold
                          ${count > 0 ? 'text-indigo-500 dark:text-indigo-400' : dark ? 'text-slate-600' : 'text-gray-300'}`}>
                          <Package size={11} /> {count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold
                            ${cat.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                            {cat.is_active ? 'Actif' : 'Inactif'}
                          </span>
                          <button onClick={() => handleToggle(cat)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {cat.is_active
                              ? <Eye size={13} className="text-emerald-500" />
                              : <Eye size={13} className={dark ? 'text-slate-500' : 'text-gray-400'} />
                            }
                          </button>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center ${dark ? 'text-slate-300' : 'text-gray-600'}`}>
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold
                          ${dark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-600'}`}>
                          {cat.display_order ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleEdit(cat)}
                            className={`p-1.5 rounded-xl transition-colors ${dark ? 'text-indigo-400 hover:bg-slate-700' : 'text-indigo-500 hover:bg-indigo-50'}`}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(cat)}
                            className={`p-1.5 rounded-xl transition-colors ${dark ? 'text-red-400 hover:bg-slate-700' : 'text-red-500 hover:bg-red-50'}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`text-center py-12 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                      Aucune catégorie trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Modal ── */}
      <AnimatePresence>
        {openDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden
                ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Layers size={15} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
                    </h2>
                    <p className="text-xs text-white/70">
                      {editingCategory ? editingCategory.name : 'Remplissez les informations'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setOpenDialog(false)} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto p-5 space-y-4 flex-1">

                {/* Name + Slug */}
                <Field label="Nom" required>
                  <input className={inputCls} value={formData.name}
                    onChange={e => setF('name', e.target.value)}
                    placeholder="Ex: Électronique, Mode femme…" />
                </Field>

                {/* Auto-slug preview */}
                {formData.slug && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${dark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                    <Hash size={11} className="text-indigo-400 shrink-0" />
                    <span className={dark ? 'text-slate-400' : 'text-gray-500'}>Slug auto :</span>
                    <code className="font-mono text-indigo-500">/{formData.slug}</code>
                  </div>
                )}

                {/* Description */}
                <Field label="Description">
                  <textarea className={inputCls + ' resize-none'} rows={2}
                    value={formData.description}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description de la catégorie" />
                </Field>

                {/* Parent category */}
                <Field label="Catégorie parente" hint="Laissez vide pour une catégorie racine">
                  <select className={inputCls} value={formData.parent_id}
                    onChange={e => setFormData(p => ({ ...p, parent_id: e.target.value }))}>
                    <option value="">— Catégorie racine —</option>
                    {categories
                      .filter(c => !c.parent_id && (!editingCategory || c.id !== editingCategory.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>
                      ))
                    }
                  </select>
                </Field>

                {/* Icon picker */}
                <Field label="Icône emoji">
                  <div className={`flex flex-wrap gap-1 max-h-36 overflow-y-auto p-2 rounded-xl border ${dark ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50/80 border-gray-100'}`}>
                    {CATEGORY_ICONS.map(ico => (
                      <button key={ico} type="button"
                        onClick={() => setFormData(p => ({ ...p, icon: ico }))}
                        className={`text-2xl p-1 rounded-lg transition-all ${formData.icon === ico ? 'bg-indigo-100 dark:bg-indigo-900/60 ring-2 ring-indigo-400 scale-110' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                        {ico}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Image upload */}
                <Field label="Image de couverture">
                  <label className={`flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl text-sm cursor-pointer transition-colors
                    ${uploadingImage ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-300 dark:hover:border-indigo-600'}
                    ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700/30' : 'border-gray-200 text-gray-600 hover:bg-indigo-50/30'}`}>
                    {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {uploadingImage ? 'Upload…' : 'Choisir une image'}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                  {formData.image_url && (
                    <div className="relative mt-2">
                      <img src={formData.image_url} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-gray-100 dark:border-slate-700" />
                      <button onClick={() => setFormData(p => ({ ...p, image_url: '' }))}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </Field>

                {/* Display order + Active toggle */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Ordre d'affichage">
                    <input type="number" min="0" className={inputCls}
                      value={formData.display_order}
                      onChange={e => setFormData(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))} />
                  </Field>
                  <Field label="Visibilité">
                    <div className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl ${dark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50/50'}`}>
                      <button type="button"
                        onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
                        className={`relative w-10 h-5 rounded-full transition-colors shadow-inner ${formData.is_active ? 'bg-indigo-500' : dark ? 'bg-slate-600' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${formData.is_active ? 'translate-x-5' : ''}`} />
                      </button>
                      <span className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-gray-700'}`}>
                        {formData.is_active ? 'Visible' : 'Masquée'}
                      </span>
                    </div>
                  </Field>
                </div>

                {/* SEO Preview */}
                {formData.name && (
                  <div className={`p-3 rounded-xl border ${dark ? 'border-slate-700 bg-slate-700/20' : 'border-blue-100 bg-blue-50/40'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${dark ? 'text-slate-400' : 'text-blue-600'}`}>
                      🔍 Aperçu SEO
                    </p>
                    <p className="text-blue-600 dark:text-blue-400 font-semibold text-sm truncate">{formData.name}</p>
                    <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-gray-500'}`}>
                      gba.app/categories/{formData.slug || '…'}
                    </p>
                    {formData.description && <p className={`text-xs mt-1 line-clamp-2 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>{formData.description}</p>}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
                <Button variant="outline" size="sm" onClick={() => setOpenDialog(false)} disabled={saving}>
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !formData.name.trim()}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm min-w-[120px]">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {saving ? 'Sauvegarde…' : editingCategory ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Categories;
