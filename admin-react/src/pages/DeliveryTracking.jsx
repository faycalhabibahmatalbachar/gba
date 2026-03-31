import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, MapPin, Clock, Eye, X, ShoppingBag, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../config/supabase';
import { useDark } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import FleetMetrics from '../components/delivery/FleetMetrics';
import AlertsPanel from '../components/delivery/AlertsPanel';

// Fix leaflet default icon path (Vite/webpack issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Icône livreur (camion violet animé)
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:38px;height:38px;border-radius:50%;
    background:linear-gradient(135deg,#667eea,#764ba2);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 6px rgba(102,126,234,.25);
    font-size:18px;border:2px solid #fff;">🚚</div>`,
  iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22],
});

// Icône client (épingle bleue)
const clientIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:34px;height:34px;border-radius:50%;
    background:linear-gradient(135deg,#3b82f6,#1d4ed8);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 5px rgba(59,130,246,.25);
    font-size:16px;border:2px solid #fff;">👤</div>`,
  iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
});

// Composant auxiliaire : ajuste le zoom quand les positions changent
function MapFitter({ positions }) {
  const map = useMap();
  useEffect(() => {
    const pts = positions.filter(Boolean);
    if (!pts.length) return;
    if (pts.length === 1) { map.setView([pts[0].lat, pts[0].lng], 15); return; }
    const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [positions, map]);
  return null;
}

const TRAIL_MAX = 10;

function LocalOrderModal({ open, order, onClose, dark }) {
  if (!open || !order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  const total = Number(order.total_amount ?? 0);
  const shipping = Number(order.shipping_fee ?? order.shipping_cost ?? 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-3 border-b shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
          <div>
            <p className={`font-bold text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>{order.order_number || `#${order.id?.slice(0,8)}`}</p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-400'}`}>{order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {order.status && <Badge variant={order.status}>{order.status}</Badge>}
            <button onClick={onClose} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={16} /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {(order.customer_name || order.customer_phone) && (
            <div className={`rounded-xl border p-3 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <p className={`text-xs font-bold uppercase mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Client</p>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback>{(order.customer_name||'?')[0]?.toUpperCase()}</AvatarFallback></Avatar>
                <div>
                  {order.customer_name && <p className={`font-semibold text-sm ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{order.customer_name}</p>}
                  {order.customer_phone && (
                    <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
                      <Phone size={11} />{order.customer_phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          {(order.shipping_city || order.shipping_address) && (
            <div className={`rounded-xl border p-3 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <p className={`text-xs font-bold uppercase mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Adresse</p>
              <p className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
                {[order.shipping_country, order.shipping_city, order.shipping_district].filter(Boolean).join(', ')}
              </p>
              {order.shipping_address && <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{order.shipping_address}</p>}
            </div>
          )}
          {items.length > 0 && (
            <div className={`rounded-xl border p-3 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <p className={`text-xs font-bold uppercase mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Articles ({items.length})</p>
              <div className="space-y-2">
                {items.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                      {item.product_image
                        ? <img src={item.product_image} alt="" className="w-full h-full object-cover rounded-lg" />
                        : <ShoppingBag size={12} className={dark ? 'text-slate-400' : 'text-gray-400'} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{item.product_name||'Produit'}</p>
                      <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{item.quantity} × {Number(item.unit_price||0).toFixed(0)} FCFA</p>
                    </div>
                  </div>
                ))}
                {items.length > 4 && <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>+{items.length - 4} autres articles</p>}
              </div>
            </div>
          )}
          <div className={`rounded-xl border p-3 flex justify-between items-center ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
            <span className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-gray-600'}`}>Total</span>
            <span className="font-extrabold text-indigo-500">{total.toFixed(0)} FCFA</span>
          </div>
        </div>
        <div className={`px-4 py-3 border-t shrink-0 flex justify-end ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function DeliveryTracking() {
  const { dark } = useDark();
  const enqueueSnackbar = (msg, { variant } = {}) => { variant === 'error' ? toast.error(msg) : toast.success(msg); };

  const [loading, setLoading]            = useState(true);
  const [drivers, setDrivers]            = useState([]);
  const [selectedDriverId, setSelDriver] = useState('');
  const [driverLoc, setDriverLoc]        = useState(null);
  const [clientLoc, setClientLoc]        = useState(null);
  const [trail, setTrail]                = useState([]);
  const [orders, setOrders]              = useState([]);
  const [selectedOrderId, setSelOrder]   = useState('');
  const [allDriverLocations, setAllDriverLocations] = useState([]);
  const [localOrderOpen, setLocalOrderOpen] = useState(false);
  const [localOrderData, setLocalOrderData] = useState(null);
  const [localOrderLoading, setLocalOrderLoading] = useState(false);
  const driverChRef = useRef(null);
  const clientChRef = useRef(null);

  const mapName = d => `${d.first_name||''} ${d.last_name||''}`.trim() || d.email || d.phone || `Livreur ${d.id.slice(0,8)}`;

  const openLocalOrderDetail = useCallback(async (orderId) => {
    if (!orderId) return;
    setLocalOrderLoading(true);
    setLocalOrderOpen(true);
    setLocalOrderData(null);
    try {
      const { data: orderRow } = await supabase.from('orders').select('*').eq('id', orderId).single();
      const { data: itemsRaw } = await supabase.from('order_items').select('*, products(main_image)').eq('order_id', orderId);
      const items = (itemsRaw || []).map(i => ({ ...i, product_image: i.product_image || i.products?.main_image || null }));
      setLocalOrderData({ ...orderRow, items });
    } catch (e) {
      toast.error('Erreur chargement commande');
      setLocalOrderOpen(false);
    } finally {
      setLocalOrderLoading(false);
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles')
        .select('id, first_name, last_name, email, phone').eq('role','driver').order('created_at',{ascending:false});
      const rows = error
        ? (await supabase.from('profiles').select('id, first_name, last_name, email, phone').order('created_at',{ascending:false})).data || []
        : data || [];
      const mapped = rows.map(d => ({ ...d, name: mapName(d) }));
      setDrivers(mapped);
      if (!selectedDriverId && mapped.length) setSelDriver(mapped[0].id);
      
      // Fetch all driver locations for metrics
      await fetchAllDriverLocations(mapped);
    } catch { enqueueSnackbar('Erreur chargement livreurs', { variant:'error' }); }
    finally { setLoading(false); }
  }, [selectedDriverId]);

  const fetchOrders = useCallback(async (driverId) => {
    // Fetch ALL active orders for metrics (not just selected driver)
    const { data: ordersRaw } = await supabase.from('orders')
      .select('id, user_id, driver_id, status, order_number, customer_name, created_at')
      .in('status',['confirmed','shipped','processing','out_for_delivery']).order('created_at',{ascending:false});
    const rows = ordersRaw || [];
    // Fetch client names for orders without customer_name
    const missingIds = [...new Set(rows.filter(o => !o.customer_name && o.user_id).map(o => o.user_id))];
    let profileMap = {};
    if (missingIds.length) {
      const { data: profs } = await supabase.from('profiles')
        .select('id, first_name, last_name, email').in('id', missingIds);
      (profs||[]).forEach(p => { profileMap[p.id] = `${p.first_name||''} ${p.last_name||''}`.trim() || p.email || p.id.slice(0,8); });
    }
    const enriched = rows.map(o => ({
      ...o,
      displayName: o.customer_name || profileMap[o.user_id] || `Client ${o.user_id?.slice(0,8)||'?'}`,
      displayNum:  o.order_number || `#${o.id.slice(0,8)}`,
    }));
    setOrders(enriched);
    if (enriched.length) setSelOrder(enriched[0].id); else { setSelOrder(''); setClientLoc(null); }
  }, []);

  const fetchDriverLoc = useCallback(async (driverId) => {
    if (!driverId) return;
    // Fetch from history table for trail
    const { data } = await supabase.from('driver_location_history').select('*')
      .eq('driver_id', driverId).order('captured_at',{ascending:false}).limit(TRAIL_MAX);
    if (data?.length) { setDriverLoc(data[0]); setTrail(data.reverse().map(p=>[p.latitude,p.longitude])); }
    else { setDriverLoc(null); setTrail([]); }
  }, []);

  const fetchAllDriverLocations = useCallback(async (driverList) => {
    try {
      const driverIds = driverList.map(d => d.id);
      if (driverIds.length === 0) return;
      
      // Fetch latest position for each driver from history
      const { data } = await supabase
        .from('driver_location_history')
        .select('*')
        .in('driver_id', driverIds)
        .order('captured_at', { ascending: false });
      
      if (data) {
        // Keep only latest position per driver
        const latestByDriver = {};
        data.forEach(loc => {
          if (!latestByDriver[loc.driver_id]) {
            latestByDriver[loc.driver_id] = loc;
          }
        });
        setAllDriverLocations(Object.values(latestByDriver));
      }
    } catch (e) {
      console.error('Error fetching all driver locations:', e);
    }
  }, []);

  const fetchClientLoc = useCallback(async (orderId, orderList) => {
    const order = (orderList || orders).find(o => o.id === orderId);
    if (!order?.user_id) return;
    // Fetch latest from history or current location
    const { data: historyData } = await supabase.from('user_location_history')
      .select('*').eq('user_id', order.user_id).order('captured_at', {ascending: false}).limit(1).maybeSingle();
    if (historyData) {
      setClientLoc(historyData);
    } else {
      const { data: currentData } = await supabase.from('user_current_location')
        .select('*').eq('user_id', order.user_id).maybeSingle();
      setClientLoc(currentData || null);
    }
  }, [orders]);

  const subscribeDriver = useCallback((driverId) => {
    driverChRef.current?.unsubscribe();
    driverChRef.current = supabase.channel(`dt-drv-${driverId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'driver_location_history', filter:`driver_id=eq.${driverId}` },
        ({ new: loc }) => {
          if (!loc?.latitude) return;
          setDriverLoc(loc);
          setTrail(p => [...p.slice(-(TRAIL_MAX-1)), [loc.latitude, loc.longitude]]);
        })
      .subscribe();
  }, []);

  const subscribeClient = useCallback((userId) => {
    clientChRef.current?.unsubscribe();
    if (!userId) return;
    clientChRef.current = supabase.channel(`dt-cli-${userId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'user_location_history', filter:`user_id=eq.${userId}` },
        ({ new: loc }) => { if (loc?.latitude) setClientLoc(loc); })
      .subscribe();
  }, []);

  useEffect(() => {
    fetchDrivers();
    return () => { driverChRef.current?.unsubscribe(); clientChRef.current?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!selectedDriverId) return;
    fetchDriverLoc(selectedDriverId);
    fetchOrders(selectedDriverId);
    subscribeDriver(selectedDriverId);
  }, [selectedDriverId]);

  useEffect(() => {
    if (!selectedOrderId || !orders.length) return;
    fetchClientLoc(selectedOrderId, orders);
    const order = orders.find(o => o.id === selectedOrderId);
    if (order?.user_id) subscribeClient(order.user_id);
  }, [selectedOrderId, orders]);

  const selectedDriver = drivers.find(d => d.id === selectedDriverId) || null;
  const mapH = 'calc(100vh - 200px)';
  const fitterPos = [
    driverLoc ? { lat: driverLoc.latitude, lng: driverLoc.longitude } : null,
    clientLoc ? { lat: clientLoc.latitude, lng: clientLoc.longitude } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent'}`}>Delivery Operations Command Center</h1>
            <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Centre de pilotage logistique temps réel</p>
          </div>
          <Button size="sm" onClick={fetchDrivers}><RefreshCw size={15} /> Actualiser</Button>
        </div>
      </motion.div>

      {/* Métriques flotte */}
      <FleetMetrics drivers={drivers} orders={orders} locations={allDriverLocations} />

      {/* Alertes critiques */}
      <AlertsPanel drivers={drivers} orders={orders} locations={allDriverLocations} />

      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: mapH }}>
        {/* Sidebar */}
        <motion.div initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.1 }}
          className="w-full lg:w-72 shrink-0 flex flex-col gap-3">

          <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <p className={`text-xs font-semibold uppercase mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>🚚 Sélectionner un livreur</p>
            <select value={selectedDriverId} onChange={e => setSelDriver(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-gray-200'}`}>
              <option value="" disabled>Choisir un livreur...</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {selectedDriver && <p className={`text-xs mt-1.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{selectedDriver.phone || selectedDriver.email || ''}</p>}
          </div>

          {orders.length > 0 && (
            <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-100'}`}>
              <p className={`text-xs font-semibold uppercase mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>👤 Commande / Client</p>
              <select value={selectedOrderId} onChange={e => setSelOrder(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-gray-200'}`}>
                <option value="" disabled>Choisir...</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.displayNum} — {o.displayName}</option>)}
              </select>
              {selectedOrderId && (
                <button
                  onClick={() => openLocalOrderDetail(selectedOrderId)}
                  disabled={localOrderLoading}
                  className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    dark
                      ? 'bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100'
                  }`}
                >
                  <Eye size={13} />{localOrderLoading ? 'Chargement…' : 'Voir détails commande'}
                </button>
              )}
            </div>
          )}

          <div className={`rounded-2xl border p-4 flex items-center gap-3 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0"><MapPin size={18} /></div>
            <div>
              <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Précision GPS</p>
              <p className={`text-xl font-extrabold ${driverLoc ? 'text-indigo-500' : dark ? 'text-slate-600' : 'text-gray-300'}`}>
                {driverLoc?.accuracy != null ? `±${Number(driverLoc.accuracy).toFixed(0)} m` : '—'}
              </p>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 flex items-center gap-3 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 shrink-0"><Clock size={18} /></div>
            <div>
              <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Dernière position</p>
              <p className={`text-sm font-bold ${driverLoc ? (dark ? 'text-slate-100' : 'text-gray-800') : (dark ? 'text-slate-600' : 'text-gray-300')}`}>
                {driverLoc?.captured_at ? new Date(driverLoc.captured_at).toLocaleString('fr-FR') : '—'}
              </p>
            </div>
          </div>

          {driverLoc?.latitude != null && (
            <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <p className={`text-xs font-semibold uppercase mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Coordonnées</p>
              <p className={`text-xs font-mono ${dark ? 'text-slate-300' : 'text-gray-700'}`}>🚚 {Number(driverLoc.latitude).toFixed(6)}, {Number(driverLoc.longitude).toFixed(6)}</p>
              {clientLoc?.latitude != null && <p className={`text-xs font-mono mt-1 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>👤 {Number(clientLoc.latitude).toFixed(6)}, {Number(clientLoc.longitude).toFixed(6)}</p>}
            </div>
          )}

          <div className={`rounded-2xl border p-4 text-center ${driverLoc ? (dark ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50') : (dark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}`}>
            <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${driverLoc ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className={`text-sm font-semibold ${driverLoc ? (dark ? 'text-green-400' : 'text-green-700') : (dark ? 'text-slate-500' : 'text-gray-400')}`}>
              {driverLoc ? 'Signal actif' : 'En attente de signal'}
            </span>
            {clientLoc && <p className="mt-1.5 text-xs text-indigo-600 font-medium">👤 Client localisé</p>}
          </div>
        </motion.div>

        {/* Carte Leaflet */}
        <motion.div initial={{ opacity:0, scale:.98 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.2 }}
          className={`flex-1 rounded-2xl overflow-hidden shadow-md border ${dark ? 'border-slate-700' : 'border-gray-200'}`} style={{ minHeight: 400 }}>
          {driverLoc?.latitude != null ? (
            <MapContainer center={[driverLoc.latitude, driverLoc.longitude]} zoom={14} style={{ width:'100%', height:'100%', minHeight:400 }}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapFitter positions={fitterPos} />
              {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color:'#667eea', weight:3, opacity:0.6, dashArray:'6 4' }} />}
              <Marker position={[driverLoc.latitude, driverLoc.longitude]} icon={driverIcon}>
                <Popup>
                  <strong>🚚 {selectedDriver?.name || 'Livreur'}</strong><br />
                  Lat: {Number(driverLoc.latitude).toFixed(6)}<br />Lng: {Number(driverLoc.longitude).toFixed(6)}<br />
                  {driverLoc.accuracy != null && <>Précision: ±{Number(driverLoc.accuracy).toFixed(0)} m<br /></>}
                  {driverLoc.speed != null && <>Vitesse: {(Number(driverLoc.speed) * 3.6).toFixed(1)} km/h<br /></>}
                  {driverLoc.captured_at && <small>{new Date(driverLoc.captured_at).toLocaleString('fr-FR')}</small>}
                </Popup>
              </Marker>
              {clientLoc?.latitude != null && (
                <Marker position={[clientLoc.latitude, clientLoc.longitude]} icon={clientIcon}>
                  <Popup>
                    <strong>👤 Client</strong><br />
                    Lat: {Number(clientLoc.latitude).toFixed(6)}<br />Lng: {Number(clientLoc.longitude).toFixed(6)}<br />
                    {clientLoc.accuracy != null && <>Précision: ±{Number(clientLoc.accuracy).toFixed(0)} m<br /></>}
                    {clientLoc.captured_at && <small>{new Date(clientLoc.captured_at).toLocaleString('fr-FR')}</small>}
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          ) : (
            <div className={`h-full flex flex-col items-center justify-center p-8 text-center ${dark ? 'bg-slate-900' : ''}`} style={{ minHeight:400 }}>
              <MapPin size={64} className={`mb-4 ${dark ? 'text-slate-600' : 'text-gray-200'}`} />
              <p className={`text-lg font-bold ${dark ? 'text-slate-400' : 'text-gray-400'}`}>Aucune position reçue</p>
              <p className={`text-sm mt-2 max-w-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                Le mobile livreur doit envoyer sa position GPS vers la table{' '}
                <code className={`px-1.5 py-0.5 rounded text-xs ${dark ? 'bg-slate-800 text-slate-300' : 'bg-gray-100'}`}>driver_locations</code>{' '}
                via l'application mobile GBA.
              </p>
            </div>
          )}
        </motion.div>
      </div>
      <LocalOrderModal
        open={localOrderOpen}
        order={localOrderData}
        onClose={() => setLocalOrderOpen(false)}
        dark={dark}
      />
    </div>
  );
}
