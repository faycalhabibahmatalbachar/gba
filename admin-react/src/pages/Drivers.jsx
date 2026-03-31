import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Truck, UserPlus, Pencil, Eye, X, Save, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../config/supabase';
import { useDark } from '../components/Layout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export default function Drivers() {
  const { dark } = useDark();
  const enqueueSnackbar = (msg, { variant } = {}) => { variant === 'error' ? toast.error(msg) : toast.success(msg); };

  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', city: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', city: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [selectedDriverOrders, setSelectedDriverOrders] = useState([]);
  const [selectedDriverName, setSelectedDriverName] = useState('');

  // Fetch only driver-role profiles
  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url, city, created_at, role')
        .eq('role', 'driver')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: if role column doesn't exist yet, fetch all
        const { data: allData, error: allError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone, avatar_url, city, created_at')
          .order('created_at', { ascending: false });
        if (allError) throw allError;
        setDrivers(allData || []);
      } else {
        setDrivers(data || []);
      }
    } catch (e) {
      console.error('Error loading drivers/profiles:', e);
      enqueueSnackbar(`Erreur chargement livreurs: ${e.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDriver = async () => {
    if (!form.email || !form.password) {
      setCreateError('Email et mot de passe sont obligatoires');
      return;
    }
    if (form.password.length < 6) {
      setCreateError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      // Save admin session before signUp (signUp switches active session)
      const { data: { session: adminSession } } = await supabase.auth.getSession();

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

      // Upsert profile BEFORE restoring admin session:
      // The driver's freshly created JWT is active — they can write their own profile row.
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

      enqueueSnackbar(`Compte livreur créé: ${form.email}`, { variant: 'success' });
      setCreateOpen(false);
      setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', city: '' });
      fetchDrivers();
    } catch (e) {
      console.error('Create driver error:', e);
      setCreateError(e.message || 'Erreur lors de la création du compte');
      // Try to restore admin session on error too
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) window.location.reload();
      } catch (_) {}
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm('Supprimer ce livreur ?')) return;
    try {
      await supabase.from('profiles').update({ role: null }).eq('id', driverId);
      enqueueSnackbar('Livreur supprimé', { variant: 'success' });
      fetchDrivers();
    } catch (e) {
      enqueueSnackbar(`Erreur: ${e.message}`, { variant: 'error' });
    }
  };

  const handleToggleAvailability = async (driver) => {
    try {
      const newVal = !driver.is_available;
      await supabase.from('profiles').update({ is_available: newVal }).eq('id', driver.id);
      setDrivers((prev) => prev.map((d) => d.id === driver.id ? { ...d, is_available: newVal } : d));
      enqueueSnackbar(newVal ? 'Livreur marqué disponible' : 'Livreur marqué indisponible', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(`Erreur: ${e.message}`, { variant: 'error' });
    }
  };

  const handleOpenEdit = (driver) => {
    setEditDriver(driver);
    setEditForm({ firstName: driver.first_name || '', lastName: driver.last_name || '', phone: driver.phone || '', city: driver.city || '' });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editDriver) return;
    setEditSaving(true);
    try {
      await supabase.from('profiles').update({
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        phone: editForm.phone,
        city: editForm.city,
      }).eq('id', editDriver.id);
      setDrivers((prev) => prev.map((d) => d.id === editDriver.id
        ? { ...d, first_name: editForm.firstName, last_name: editForm.lastName, phone: editForm.phone, city: editForm.city }
        : d
      ));
      enqueueSnackbar('Livreur mis à jour', { variant: 'success' });
      setEditOpen(false);
    } catch (e) {
      enqueueSnackbar(`Erreur: ${e.message}`, { variant: 'error' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleViewOrders = async (driver) => {
    const name = `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || driver.email;
    setSelectedDriverName(name);
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setSelectedDriverOrders(data || []);
    } catch (_) { setSelectedDriverOrders([]); }
    setOrdersDialogOpen(true);
  };

  useEffect(() => {
    fetchDrivers();

    const subscription = supabase
      .channel('drivers_profiles_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchDrivers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [orderCounts, setOrderCounts] = useState({});
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data, error } = await supabase.from('orders').select('driver_id').not('driver_id', 'is', null);
        if (error) return;
        const counts = {};
        (data || []).forEach(o => { if (o.driver_id) counts[o.driver_id] = (counts[o.driver_id] || 0) + 1; });
        setOrderCounts(counts);
      } catch (_) {}
    };
    fetchCounts();
  }, [drivers]);

  const inp = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-gray-200'}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Livreurs</h1>
          <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Comptes livreurs — créez un compte dédié pour chaque livreur</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDrivers}><RefreshCw size={14} /> Actualiser</Button>
          <Button size="sm" onClick={() => { setCreateOpen(true); setCreateError(''); }}><UserPlus size={15} /> Nouveau livreur</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={dark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-50 border-b border-gray-100'}>
                  <th className="px-4 py-3 w-12"></th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Nom</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Email</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase hidden sm:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Téléphone</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase hidden lg:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Ville</th>
                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Commandes</th>
                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Statut</th>
                  <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-50'}>
                {drivers.map(d => {
                  const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email || '—';
                  const initials = (d.first_name || d.email || '?')[0]?.toUpperCase();
                  const count = orderCounts[d.id] || 0;
                  return (
                    <tr key={d.id} className={`transition-colors ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        {d.avatar_url
                          ? <img src={d.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                          : <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">{initials}</div>}
                      </td>
                      <td className={`px-4 py-3 font-medium ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{name}</td>
                      <td className={`px-4 py-3 hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{d.email || '—'}</td>
                      <td className={`px-4 py-3 hidden sm:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{d.phone || '—'}</td>
                      <td className={`px-4 py-3 hidden lg:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{d.city || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${count > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                          <Truck size={10} /> {count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggleAvailability(d)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${d.is_available !== false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {d.is_available !== false ? 'Dispo' : 'Pause'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleViewOrders(d)} className={`p-1.5 rounded-lg text-indigo-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`}><Eye size={14} /></button>
                          <button onClick={() => handleOpenEdit(d)} className={`p-1.5 rounded-lg text-blue-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteDriver(d.id)} className={`p-1.5 rounded-lg text-red-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {drivers.length === 0 && <tr><td colSpan={8} className={`text-center py-10 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun livreur</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Modifier le livreur</h2>
              <button onClick={() => setEditOpen(false)} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Prénom</label><input className={inp} value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Nom</label><input className={inp} value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} /></div>
              </div>
              <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Téléphone</label><input className={inp} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Ville</label><input className={inp} value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} disabled={editSaving}>Annuler</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editSaving ? 'Sauvegarde...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Dialog */}
      {ordersDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Commandes de {selectedDriverName}</h2>
              <button onClick={() => setOrdersDialogOpen(false)} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {selectedDriverOrders.length === 0
                ? <p className={`text-center py-8 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune commande assignée</p>
                : <div className="space-y-2">{selectedDriverOrders.map(o => (
                    <div key={o.id} className={`flex items-center justify-between py-2 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                      <span className={`font-bold text-sm ${dark ? 'text-slate-200' : 'text-gray-700'}`}>#{(o.order_number || o.id?.slice(0,8) || '').toUpperCase()}</span>
                      <Badge variant={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'destructive' : 'warning'}>{o.status}</Badge>
                      <span className="font-bold text-indigo-500 text-sm">{Number(o.total_amount || 0).toFixed(0)} FCFA</span>
                      <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  ))}</div>}
            </div>
            <div className={`px-5 py-4 border-t flex justify-end shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <Button variant="outline" size="sm" onClick={() => setOrdersDialogOpen(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Créer un compte livreur</h2>
              <button onClick={() => setCreateOpen(false)} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {createError && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${dark ? 'bg-red-900/30 border border-red-800 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />{createError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Prénom</label><input className={inp} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Nom</label><input className={inp} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
              </div>
              <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Email *</label><input className={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Mot de passe * (min. 6 car.)</label><input className={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Téléphone</label><input className={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className={`text-xs font-semibold uppercase mb-1 block ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Ville</label><input className={inp} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              </div>
            </div>
            <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</Button>
              <Button size="sm" onClick={handleCreateDriver} disabled={creating}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} {creating ? 'Création...' : 'Créer le compte'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
