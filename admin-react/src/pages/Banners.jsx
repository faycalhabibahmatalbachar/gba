import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, X, Loader2, AlertCircle,
  Search, Image, CheckCircle2, Clock, XCircle, Upload,
  CalendarDays, Link, Hash, ToggleLeft, ToggleRight,
  TrendingUp, Eye, EyeOff, GripVertical, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../config/supabase';
import { useDark } from '../components/Layout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

// ── Utility ──────────────────────────────────────────────────────────────────
const BUCKET = 'banners';
const MAX_SIZE_MB = 5;
const RECOMMENDED_W = 1200;
const RECOMMENDED_H = 375;

async function uploadBannerImage(file, bannerId) {
  // 1. Validate format
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!validTypes.includes(file.type)) {
    return { success: false, error: `Format non supporté. Utilisez JPG, PNG, WEBP ou GIF.` };
  }
  // 2. Validate size
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { success: false, error: `L'image dépasse ${MAX_SIZE_MB} Mo` };
  }
  const ext = file.name.split('.').pop().toLowerCase();
  const filePath = `${bannerId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type });

  if (upErr) {
    console.error('[BANNERS STORAGE]', upErr);
    return { success: false, error: upErr.message };
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return { success: true, url: publicUrl, path: filePath };
}

async function deleteBannerImage(imagePath) {
  if (!imagePath) return { success: true };
  let path = imagePath;
  if (imagePath.includes('/storage/v1/object/public/banners/')) {
    path = imagePath.split('/storage/v1/object/public/banners/')[1];
  }
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) { console.warn('[BANNERS DELETE STORAGE]', error); }
  return { success: !error };
}

function getBannerStatus(b) {
  if (!b.is_active) return 'inactive';
  const now = new Date();
  if (b.starts_at && new Date(b.starts_at) > now) return 'scheduled';
  if (b.ends_at && new Date(b.ends_at) < now) return 'expired';
  return 'active';
}

const STATUS_META = {
  active:    { label: 'Actif',     bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', Icon: CheckCircle2 },
  inactive:  { label: 'Inactif',   bg: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400', Icon: XCircle },
  scheduled: { label: 'Planifiée', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', Icon: Clock },
  expired:   { label: 'Expirée',   bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', Icon: XCircle },
};

function StatusBadge({ status }) {
  const { label, bg, Icon } = STATUS_META[status] || STATUS_META.inactive;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${bg}`}>
      <Icon size={10} /> {label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Field ──────────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
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

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, gradient, Icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`rounded-2xl p-4 text-white shadow-lg ${gradient} flex items-center gap-4`}
    >
      <div className="p-2.5 bg-white/20 rounded-xl">
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-none">{value}</p>
        <p className="text-xs mt-0.5 font-medium opacity-90">{label}</p>
        {sub && <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Upload Zone ────────────────────────────────────────────────────────────
function UploadZone({ imageFile, previewUrl, onFile, onClear, uploading }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  }, [onFile]);

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      className="hidden"
      accept="image/*"
      onChange={handleChange}
      disabled={uploading}
    />
  );

  if (previewUrl || imageFile) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border-2 border-indigo-200 dark:border-indigo-700 bg-gray-50 dark:bg-slate-700/50"
        style={{ aspectRatio: '16/5' }}>
        {hiddenInput}
        <img
          src={imageFile ? URL.createObjectURL(imageFile) : previewUrl}
          alt="preview"
          className="w-full h-full object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3 gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white rounded-lg text-xs font-semibold text-gray-700 transition-all shadow"
            disabled={uploading}
          >
            <Upload size={12} /> Changer
          </button>
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 hover:bg-red-500 rounded-lg text-xs font-semibold text-white transition-all shadow"
            disabled={uploading}
          >
            <X size={12} /> Supprimer
          </button>
          {imageFile && (
            <span className="ml-auto text-[10px] text-white/80 font-medium">
              {(imageFile.size / 1024 / 1024).toFixed(2)} Mo
            </span>
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
            <div className="flex items-center gap-2 bg-white/90 rounded-xl px-4 py-2">
              <Loader2 size={15} className="animate-spin text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700">Upload en cours…</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-3 py-10
        ${dragging
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]'
          : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 bg-gray-50/50 dark:bg-slate-700/30 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10'
        }`}
      style={{ aspectRatio: '16/5' }}
    >
      {hiddenInput}
      <div className={`p-3 rounded-2xl transition-colors ${dragging ? 'bg-indigo-100 dark:bg-indigo-800/50' : 'bg-gray-100 dark:bg-slate-700'}`}>
        <Image size={28} className={dragging ? 'text-indigo-500' : 'text-gray-400 dark:text-slate-500'} />
      </div>
      <div className="text-center">
        <p className={`text-sm font-semibold ${dragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-slate-300'}`}>
          {dragging ? 'Déposez l\'image ici' : 'Glisser-déposer ou cliquer'}
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">JPG, PNG, WEBP · Max {MAX_SIZE_MB} Mo · Ratio 16:5 recommandé</p>
        <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5 font-medium">{RECOMMENDED_W} × {RECOMMENDED_H} px optimal</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
function Banners() {
  const { dark } = useDark();
  const [banners, setBanners]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [imageFile, setImageFile]   = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [searchQ, setSearchQ]       = useState('');
  const fileInputRef = useRef(null);

  const emptyForm = useCallback((orderLen = 0) => ({
    title: '',
    subtitle: '',
    target_route: '',
    link_url: '',
    display_order: orderLen,
    is_active: true,
    starts_at: '',
    ends_at: '',
    image_url: '',
    image_path: '',
  }), []);

  const [formData, setFormData] = useState(() => emptyForm(0));

  const set = (key, val) => setFormData(p => ({ ...p, [key]: val }));

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('banners')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (e) throw e;
      setBanners(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total:     banners.length,
      active:    banners.filter(b => getBannerStatus(b) === 'active').length,
      scheduled: banners.filter(b => getBannerStatus(b) === 'scheduled').length,
      expired:   banners.filter(b => getBannerStatus(b) === 'expired').length,
      inactive:  banners.filter(b => getBannerStatus(b) === 'inactive').length,
    };
  }, [banners]);

  // ── Open / Close ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingBanner(null);
    setImageFile(null);
    setFormData(emptyForm(banners.length));
    setDialogOpen(true);
  };

  const openEdit = (b) => {
    setEditingBanner(b);
    setImageFile(null);
    setFormData({
      title:         b.title || '',
      subtitle:      b.subtitle || '',
      target_route:  b.target_route || '',
      link_url:      b.link_url || '',
      display_order: b.display_order ?? 0,
      is_active:     b.is_active !== false,
      starts_at:     b.starts_at ? new Date(b.starts_at).toISOString().slice(0, 16) : '',
      ends_at:       b.ends_at ? new Date(b.ends_at).toISOString().slice(0, 16) : '',
      image_url:     b.image_url || '',
      image_path:    b.image_path || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBanner(null);
    setImageFile(null);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Le titre est obligatoire');
      return;
    }

    setSaving(true);
    let uploadedPath = null;

    try {
      // ── Log diagnostic ──
      const { data: { session } } = await supabase.auth.getSession();
      let isAdm = null;
      try { const r = await supabase.rpc('is_admin'); isAdm = r.data; } catch (_) {}
      console.log('[BANNERS SAVE]', { userId: session?.user?.id, isAdmin: isAdm, hasImage: !!imageFile });

      if (isAdm === false) {
        toast.error('Accès refusé : droits administrateur requis');
        return;
      }

      const payload = {
        title:         formData.title.trim(),
        subtitle:      formData.subtitle?.trim() || null,
        target_route:  formData.target_route?.trim() || null,
        link_url:      formData.link_url?.trim() || null,
        display_order: Number(formData.display_order) || 0,
        is_active:     !!formData.is_active,
        starts_at:     formData.starts_at || null,
        ends_at:       formData.ends_at || null,
        updated_at:    new Date().toISOString(),
      };

      let bannerId = editingBanner?.id;

      // ── DB operation ──
      if (editingBanner) {
        const { error: updErr } = await supabase
          .from('banners').update(payload).eq('id', editingBanner.id);
        if (updErr) throw updErr;
      } else {
        const { data, error: insErr } = await supabase
          .from('banners').insert([payload]).select().single();
        if (insErr) throw insErr;
        bannerId = data.id;
      }

      // ── Image upload (after DB write) ──
      if (imageFile && bannerId) {
        setUploading(true);
        console.log('[BANNERS] Uploading to storage.banners, bannerId:', bannerId);
        const result = await uploadBannerImage(imageFile, bannerId);
        setUploading(false);

        if (!result.success) {
          // Rollback: delete created banner
          if (!editingBanner) {
            await supabase.from('banners').delete().eq('id', bannerId);
          }
          throw new Error(`Échec upload image : ${result.error}`);
        }

        uploadedPath = result.path;

        // If editing and had old image → delete old
        if (editingBanner?.image_path && editingBanner.image_path !== result.path) {
          await deleteBannerImage(editingBanner.image_path);
        }

        const { error: imgUpd } = await supabase
          .from('banners')
          .update({ image_url: result.url, image_path: result.path, updated_at: new Date().toISOString() })
          .eq('id', bannerId);
        if (imgUpd) throw imgUpd;
        console.log('[BANNERS] ✅ Image saved:', result.url);
      }

      toast.success(editingBanner ? 'Bannière mise à jour' : 'Bannière créée');
      closeDialog();
      await loadData();
    } catch (e) {
      setUploading(false);
      // Rollback uploaded file on error
      if (uploadedPath) {
        await deleteBannerImage(uploadedPath);
      }
      console.error('[BANNERS SAVE ERROR]', e);
      toast.error(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async (banner) => {
    if (!window.confirm(`Supprimer la bannière "${banner.title}" ?`)) return;
    try {
      const { error: delErr } = await supabase
        .from('banners').delete().eq('id', banner.id);
      if (delErr) throw delErr;
      if (banner.image_path) await deleteBannerImage(banner.image_path);
      toast.success('Bannière supprimée');
      await loadData();
    } catch (e) {
      toast.error(e.message || String(e));
    }
  };

  // ── Quick toggle ────────────────────────────────────────────────────────
  const handleToggle = async (banner) => {
    try {
      const { error: e } = await supabase
        .from('banners')
        .update({ is_active: !banner.is_active, updated_at: new Date().toISOString() })
        .eq('id', banner.id);
      if (e) throw e;
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !b.is_active } : b));
    } catch (e) {
      toast.error(e.message || String(e));
    }
  };

  // ── Diagnostic ─────────────────────────────────────────────────────────
  const runDiagnostic = async () => {
    console.group('[BANNERS DIAGNOSTIC]');
    try {
      const { data: { session }, error: sesErr } = await supabase.auth.getSession();
      if (sesErr || !session) { console.error('❌ Pas de session:', sesErr); console.groupEnd(); return; }
      console.log('✅ User:', session.user.id, session.user.email);

      const { data: isAdm } = await supabase.rpc('is_admin');
      console.log('🔐 is_admin():', isAdm);

      // Test: list files in banners bucket
      const { data: files, error: listErr } = await supabase.storage.from('banners').list();
      if (listErr) console.error('❌ Storage banners:', listErr.message);
      else console.log('📦 banners bucket accessible, folders:', files?.length || 0);

      // Test: insert
      const { error: insErr } = await supabase.from('banners').insert([{ title: '__DIAG__', is_active: false }]);
      if (insErr) console.error('❌ INSERT test:', insErr.code, insErr.message);
      else {
        console.log('✅ INSERT OK');
        await supabase.from('banners').delete().eq('title', '__DIAG__');
      }
    } catch (e) {
      console.error('Diagnostic exception:', e);
    }
    console.groupEnd();
    toast('Diagnostic terminé — voir console F12');
  };

  // ── Filter ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    banners.filter(b =>
      !searchQ ||
      b.title?.toLowerCase().includes(searchQ.toLowerCase()) ||
      b.subtitle?.toLowerCase().includes(searchQ.toLowerCase())
    ),
    [banners, searchQ]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className={`text-2xl font-extrabold tracking-tight ${dark ? 'text-white' : 'bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'}`}>
              🖼️ Banner Management
            </h1>
            <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
              Gérez les bannières promotionnelles affichées dans l'application
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </Button>
            <Button variant="outline" size="sm" onClick={runDiagnostic}>
              🔍 Diagnostics
            </Button>
            <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md">
              <Plus size={15} /> Créer une bannière
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total" value={stats.total}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
          Icon={Image} delay={0} />
        <KpiCard label="Actives" value={stats.active}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
          Icon={CheckCircle2} delay={0.05}
          sub={`${stats.scheduled} planifiées`} />
        <KpiCard label="Inactives" value={stats.inactive}
          gradient="bg-gradient-to-br from-slate-500 to-slate-600"
          Icon={EyeOff} delay={0.1} />
        <KpiCard label="Expirées" value={stats.expired}
          gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          Icon={Clock} delay={0.15} />
      </div>

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

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
        <Input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Rechercher une bannière…" className="pl-9 rounded-xl" />
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
            <p className={`text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Chargement des bannières…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className={dark ? 'bg-slate-800/70 border-b border-slate-700' : 'bg-gray-50/80 border-b border-gray-100'}>
                  {['', 'Image', 'Titre & Sous-titre', 'Statut', 'Période', 'Position', 'Actions'].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={dark ? 'divide-y divide-slate-700/40' : 'divide-y divide-gray-50'}>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`text-center py-14 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                      <Image size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Aucune bannière</p>
                      <p className="text-xs mt-1">Créez votre première bannière promotionnelle</p>
                    </td>
                  </tr>
                )}
                {filtered.map((b, i) => {
                  const status = getBannerStatus(b);
                  return (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`transition-colors group ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/30'}`}
                    >
                      {/* Drag handle */}
                      <td className="pl-3 pr-1 py-3 w-6">
                        <GripVertical size={14} className={`${dark ? 'text-slate-600' : 'text-gray-300'} cursor-grab`} />
                      </td>
                      {/* Image */}
                      <td className="px-3 py-3 w-32">
                        {b.image_url ? (
                          <div className="relative group/img">
                            <img src={b.image_url} alt={b.title} className="w-28 h-[44px] object-cover rounded-xl shadow-sm ring-1 ring-black/5" />
                          </div>
                        ) : (
                          <div className={`w-28 h-[44px] rounded-xl flex items-center justify-center ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                            <Image size={16} className={dark ? 'text-slate-600' : 'text-gray-300'} />
                          </div>
                        )}
                      </td>
                      {/* Title */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <p className={`font-semibold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{b.title}</p>
                        {b.subtitle && <p className={`text-xs truncate mt-0.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{b.subtitle}</p>}
                        {b.target_route && (
                          <p className="text-[10px] text-indigo-400 mt-0.5 flex items-center gap-0.5">
                            <Link size={9} /> {b.target_route}
                          </p>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={status} />
                          <button
                            onClick={() => handleToggle(b)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            title={b.is_active ? 'Désactiver' : 'Activer'}
                          >
                            {b.is_active
                              ? <ToggleRight size={16} className="text-emerald-500" />
                              : <ToggleLeft size={16} className={dark ? 'text-slate-500' : 'text-gray-400'} />
                            }
                          </button>
                        </div>
                      </td>
                      {/* Period */}
                      <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {(b.starts_at || b.ends_at) ? (
                          <div className="flex flex-col gap-0.5">
                            {b.starts_at && <span className="flex items-center gap-1"><CalendarDays size={10} className="text-indigo-400" /> {fmtDate(b.starts_at)}</span>}
                            {b.ends_at && <span className="flex items-center gap-1"><CalendarDays size={10} className="text-red-400" /> {fmtDate(b.ends_at)}</span>}
                          </div>
                        ) : <span className="text-gray-300 dark:text-slate-600">Toujours</span>}
                      </td>
                      {/* Position */}
                      <td className={`px-4 py-3 text-center ${dark ? 'text-slate-300' : 'text-gray-600'}`}>
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold
                          ${dark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-600'}`}>
                          {b.display_order ?? 0}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => openEdit(b)}
                            className={`p-1.5 rounded-xl transition-colors ${dark ? 'text-indigo-400 hover:bg-slate-700' : 'text-indigo-500 hover:bg-indigo-50'}`}
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(b)}
                            className={`p-1.5 rounded-xl transition-colors ${dark ? 'text-red-400 hover:bg-slate-700' : 'text-red-500 hover:bg-red-50'}`}
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Create / Edit Modal ── */}
      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden
                ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
            >
              {/* Modal Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0
                ${dark ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow">
                    <Image size={15} className="text-white" />
                  </div>
                  <div>
                    <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                      {editingBanner ? 'Modifier la bannière' : 'Nouvelle bannière'}
                    </h2>
                    <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {editingBanner ? 'Modifiez les informations de la bannière' : 'Remplissez les informations pour créer une bannière'}
                    </p>
                  </div>
                </div>
                <button onClick={closeDialog}
                  className={`p-1.5 rounded-xl transition-colors ${dark ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 p-6 space-y-5">

                {/* Section 1: Image Upload */}
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                    <Upload size={11} /> Section 1 — Image
                  </p>
                  <UploadZone
                    imageFile={imageFile}
                    previewUrl={formData.image_url}
                    onFile={(f) => setImageFile(f)}
                    onClear={() => { setImageFile(null); set('image_url', ''); set('image_path', ''); }}
                    uploading={uploading}
                  />
                  {/* hidden input for UploadZone click */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setImageFile(f); }}
                  />
                </div>

                {/* Section 2: Content */}
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                    <Zap size={11} /> Section 2 — Contenu
                  </p>
                  <div className="space-y-4">
                    <Field label="Titre" required>
                      <input className={inputCls} value={formData.title}
                        onChange={e => set('title', e.target.value)} placeholder="Ex: Offre de bienvenue — 50% sur tout" />
                    </Field>
                    <Field label="Sous-titre" hint="Texte secondaire affiché sous le titre">
                      <input className={inputCls} value={formData.subtitle}
                        onChange={e => set('subtitle', e.target.value)} placeholder="Ex: Valable jusqu'au 31 décembre" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Route cible" hint="Ex: /promotions, /products">
                        <input className={inputCls} value={formData.target_route}
                          onChange={e => set('target_route', e.target.value)} placeholder="/promotions" />
                      </Field>
                      <Field label="Lien externe">
                        <input className={inputCls} value={formData.link_url}
                          onChange={e => set('link_url', e.target.value)} placeholder="https://…" />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Section 3: Display settings */}
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                    <TrendingUp size={11} /> Section 3 — Affichage
                  </p>
                  <div className="space-y-4">
                    {/* Toggle is_active */}
                    <div className={`flex items-center justify-between p-4 rounded-2xl border ${dark ? 'border-slate-700 bg-slate-700/30' : 'border-gray-100 bg-gray-50/50'}`}>
                      <div>
                        <p className={`text-sm font-semibold ${dark ? 'text-slate-100' : 'text-gray-800'}`}>Bannière active</p>
                        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-400'}`}>
                          {formData.is_active ? 'Visible dans l\'application' : 'Masquée dans l\'application'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => set('is_active', !formData.is_active)}
                        className={`relative w-12 h-6 rounded-full transition-colors shadow-inner ${formData.is_active ? 'bg-indigo-500' : dark ? 'bg-slate-600' : 'bg-gray-200'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${formData.is_active ? 'translate-x-6' : ''}`} />
                      </button>
                    </div>

                    {/* Position */}
                    <Field label="Position (ordre d'affichage)" hint="0 = premier, plus la valeur est basse, plus la bannière apparaît tôt">
                      <input type="number" min="0" className={inputCls} value={formData.display_order}
                        onChange={e => set('display_order', e.target.value)} />
                    </Field>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Date de début" hint="Laisser vide = dès maintenant">
                        <input type="datetime-local" className={inputCls} value={formData.starts_at}
                          onChange={e => set('starts_at', e.target.value)} />
                      </Field>
                      <Field label="Date de fin" hint="Laisser vide = sans expiration">
                        <input type="datetime-local" className={inputCls} value={formData.ends_at}
                          onChange={e => set('ends_at', e.target.value)} />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={`flex items-center justify-between px-6 py-4 border-t shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
                <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {imageFile ? `📎 ${imageFile.name} (${(imageFile.size / 1024 / 1024).toFixed(2)} Mo)` : 'Aucune image sélectionnée'}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={closeDialog} disabled={saving || uploading}>
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || uploading || !formData.title.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm min-w-[120px]"
                  >
                    {(saving || uploading) && <Loader2 size={13} className="animate-spin" />}
                    {uploading ? 'Upload…' : saving ? 'Sauvegarde…' : editingBanner ? 'Mettre à jour' : 'Créer'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Banners;
