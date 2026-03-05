import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Truck, ExternalLink, Eye, Search, Map } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../config/supabase';
import { useDark } from '../components/Layout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const statusColors = {
  pending: '#FFA726',
  confirmed: '#66BB6A',
  processing: '#42A5F5',
  shipped: '#AB47BC',
  delivered: '#26A69A',
  cancelled: '#EF5350',
  refunded: '#FF7043',
};

function buildDestinationAddress(order) {
  const parts = [
    order.shipping_address,
    order.shipping_district,
    order.shipping_city,
    order.shipping_country,
  ].filter(Boolean);
  return parts.join(', ');
}

function buildGoogleMapsDirectionsUrl(order) {
  const lat = Number(order.delivery_lat);
  const lng = Number(order.delivery_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const params = new URLSearchParams({
      api: '1',
      destination: `${lat},${lng}`,
      travelmode: 'driving',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const destination = buildDestinationAddress(order);
  if (!destination) return null;

  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'driving',
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildOsmUrl(order) {
  const lat = Number(order.delivery_lat);
  const lng = Number(order.delivery_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const zoom = 16;
    return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=${zoom}/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`;
  }

  const destination = buildDestinationAddress(order);
  if (!destination) return null;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(destination)}`;
}

export default function Deliveries() {
  const { dark } = useDark();
  const enqueueSnackbar = (msg, { variant } = {}) => { variant === 'error' ? toast.error(msg) : toast.success(msg); };

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Try the view first, fallback to orders table directly
      let data, error;
      ({ data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false }));

      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      console.error('Error loading orders:', e);
      enqueueSnackbar('Erreur chargement livraisons', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch only driver-role profiles (no fallback to all profiles)
  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('role', 'driver')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading driver profiles:', error);
        setDrivers([]);
      } else {
        setDrivers(data || []);
      }
    } catch (e) {
      console.error('Error loading driver profiles:', e);
      setDrivers([]);
    }
  };

  // Assign driver by updating orders.driver_id directly
  const assignDriver = async (orderId, driverId) => {
    try {
      const updatePayload = { driver_id: driverId || null };
      // Also set status to confirmed when assigning a driver
      if (driverId) updatePayload.status = 'confirmed';

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId);

      if (error) throw error;

      // Find driver name for local state persistence
      const driver = driverId ? (drivers || []).find((d) => d.id === driverId) : null;
      const driverName = driver
        ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || driver.email
        : null;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, driver_id: driverId || null, driver_name: driverName, status: driverId ? (o.status === 'pending' ? 'confirmed' : o.status) : o.status }
            : o
        )
      );
      enqueueSnackbar(
        driverId ? `Livreur assigné: ${driverName || ''}` : 'Livreur désassigné',
        { variant: 'success' }
      );
    } catch (e) {
      console.error('Assign driver error:', e);
      enqueueSnackbar(`Erreur affectation livreur: ${e.message}`, { variant: 'error' });
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('id,status')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Mise à jour refusée (RLS)');

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      enqueueSnackbar('Statut mis à jour', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(`Erreur mise à jour statut: ${e.message}`, { variant: 'error' });
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDrivers();

    const subscription = supabase
      .channel('deliveries_orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to get driver display name
  const getDriverName = (driverId) => {
    const d = drivers.find((p) => p.id === driverId);
    if (!d) return null;
    const full = `${d.first_name || ''} ${d.last_name || ''}`.trim();
    return full || d.email || d.phone || 'Livreur';
  };

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return (orders || []).filter((o) => {
      const status = (o.status || '').toLowerCase();

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? !['delivered', 'cancelled', 'refunded'].includes(status)
            : status === statusFilter;

      const matchesQuery =
        !q ||
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [orders, searchTerm, statusFilter]);

  const statsData = useMemo(() => {
    const all = orders || [];
    return {
      total: all.length,
      pending: all.filter(o => o.status === 'pending').length,
      shipped: all.filter(o => ['shipped', 'processing'].includes(o.status)).length,
      delivered: all.filter(o => o.status === 'delivered').length,
      assigned: all.filter(o => o.driver_id).length,
    };
  }, [orders]);

  const STATUS_LABELS = { pending:'En attente', confirmed:'Confirmée', processing:'En traitement', shipped:'Expédiée', delivered:'Livrée', cancelled:'Annulée', refunded:'Remboursée' };
  const STATUS_COLORS = { pending:'bg-amber-100 text-amber-800', confirmed:'bg-green-100 text-green-800', processing:'bg-blue-100 text-blue-800', shipped:'bg-purple-100 text-purple-800', delivered:'bg-teal-100 text-teal-800', cancelled:'bg-red-100 text-red-700', refunded:'bg-orange-100 text-orange-700' };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent'}`}>🚚 Livraisons</h1>
            <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Assignez un livreur et suivez les commandes par GPS</p>
          </div>
          <Button size="sm" onClick={fetchOrders}><RefreshCw size={15} /> Actualiser</Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: statsData.total, emoji: '📦', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
          { label: 'En attente', value: statsData.pending, emoji: '⏳', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
          { label: 'En cours', value: statsData.shipped, emoji: '🚛', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
          { label: 'Livrées', value: statsData.delivered, emoji: '✅', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
          { label: 'Assignées', value: statsData.assigned, emoji: '👤', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`${s.bg} rounded-2xl p-4 text-center`}>
            <p className="text-2xl mb-1">{s.emoji}</p>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className={`text-xs font-medium mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
          <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Recherche: commande, client, email, téléphone…" className="pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className={`px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-200'}`}>
          <option value="active">Actives (non livrées)</option>
          <option value="all">Toutes</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmée</option>
          <option value="processing">En traitement</option>
          <option value="shipped">Expédiée</option>
          <option value="delivered">Livrée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-indigo-400"><span className="text-2xl animate-spin">⟳</span></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={dark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-50/80 border-b border-gray-100'}>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Commande</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Client</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide hidden lg:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Adresse</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Livreur</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Statut</th>
                  <th className={`px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Total</th>
                  <th className={`px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-50'}>
                {filteredOrders.map(o => {
                  const mapsUrl = buildGoogleMapsDirectionsUrl(o);
                  const osmUrl = buildOsmUrl(o);
                  const statusKey = (o.status || '').toLowerCase();
                  return (
                    <tr key={o.id} className={`transition-colors ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50'}`}>
                      <td className={`px-3 py-2.5 font-mono font-bold text-xs whitespace-nowrap ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{o.order_number || o.id?.slice(0,8)}</td>
                      <td className="px-3 py-2.5 max-w-[160px]">
                        <p className={`text-xs font-medium truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{o.customer_name || '—'}</p>
                        {o.customer_phone && <p className={`text-[11px] truncate ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{o.customer_phone}</p>}
                      </td>
                      <td className={`px-3 py-2.5 max-w-[180px] truncate hidden lg:table-cell text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{buildDestinationAddress(o) || '—'}</td>
                      <td className="px-3 py-2.5">
                        <select value={o.driver_id || ''} onChange={e => assignDriver(o.id, e.target.value)}
                          className={`text-[11px] border rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 max-w-[130px] ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-200'}`}>
                          <option value="">Non assigné</option>
                          {(drivers || []).map(d => {
                            const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email || d.id.slice(0,8);
                            return <option key={d.id} value={d.id}>{name}</option>;
                          })}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <select value={statusKey} onChange={e => updateOrderStatus(o.id, e.target.value)}
                          className={`text-[11px] border border-transparent rounded-lg px-1.5 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400 max-w-[110px] ${STATUS_COLORS[statusKey] || 'bg-gray-100 text-gray-700'}`}>
                          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-bold text-xs whitespace-nowrap ${dark ? 'text-slate-200' : 'text-gray-700'}`}>{Number(o.total_amount || 0).toFixed(0)} FCFA</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button title="Google Maps" disabled={!mapsUrl} onClick={() => mapsUrl && window.open(mapsUrl,'_blank','noopener')} className={`p-1.5 rounded-lg text-indigo-500 disabled:opacity-30 ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`}><Truck size={14} /></button>
                          <button title="OpenStreetMap" disabled={!osmUrl} onClick={() => osmUrl && window.open(osmUrl,'_blank','noopener')} className={`p-1.5 rounded-lg text-blue-500 disabled:opacity-30 ${dark ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}><Map size={14} /></button>
                          <button title="Voir commande" onClick={() => window.open(`/orders?orderId=${encodeURIComponent(o.id)}`,'_blank','noopener')} className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}><Eye size={14} /></button>
                          <button title="Ouvrir" onClick={() => window.open(`/orders?orderId=${encodeURIComponent(o.id)}`,'_blank','noopener')} className={`p-1.5 rounded-lg ${dark ? 'text-slate-500 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><ExternalLink size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && <tr><td colSpan={7} className={`text-center py-12 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune livraison</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
