import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, TrendingUp, Clock, Truck, CheckCircle, X, MoreVertical, Search, RefreshCw, Download, Printer, Phone, MapPin, Eye, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDark } from '../components/Layout';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Avatar, AvatarFallback } from '../components/ui/avatar';

const statusColors = {
  pending: '#FFA726',
  confirmed: '#66BB6A',
  processing: '#42A5F5',
  shipped: '#AB47BC',
  delivered: '#26A69A',
  cancelled: '#EF5350',
  refunded: '#FF7043'
};

const STATUS_FR = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En traitement',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};


function OrderDetailsDialog({ open, order, onClose, loading, dark }) {
  if (!open || !order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const totalAmount = Number(order.total_amount ?? 0);
  const shippingFee = Number(order.shipping_fee ?? order.shipping_cost ?? 0);
  const subtotal = totalAmount - shippingFee;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}
        className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
          <div>
            <p className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>{order.order_number || order.id}</p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-400'}`}>{order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={order.status || 'default'}>{STATUS_FR[order.status] || order.status}</Badge>
            <button onClick={onClose} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && <div className="h-1 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 animate-pulse w-1/2" /></div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(order.customer_name || order.customer_email || order.customer_phone || order.customer_phone_profile) && (
              <div className={`border rounded-xl p-4 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
                <p className={`text-xs font-bold uppercase mb-3 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Client</p>
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-9 w-9"><AvatarFallback>{(order.customer_name || 'C')[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  <div>
                    {order.customer_name && <p className={`font-semibold text-sm ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{order.customer_name}</p>}
                    {order.customer_email && <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{order.customer_email}</p>}
                  </div>
                </div>
                {(order.customer_phone || order.customer_phone_profile) && (
                  <div className={`flex items-center gap-1 text-sm ${dark ? 'text-slate-300' : 'text-gray-600'}`}>
                    <Phone size={13} className={dark ? 'text-slate-500' : 'text-gray-400'} />
                    {order.customer_phone || order.customer_phone_profile}
                  </div>
                )}
              </div>
            )}
            {(order.shipping_country || order.shipping_city || order.shipping_district || order.shipping_address) && (
              <div className={`border rounded-xl p-4 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
                <p className={`text-xs font-bold uppercase mb-3 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Adresse de livraison</p>
                {(order.shipping_country || order.shipping_city || order.shipping_district) && (
                  <div className={`flex items-start gap-1 text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
                    <MapPin size={13} className={`mt-0.5 shrink-0 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
                    {[order.shipping_country, order.shipping_city, order.shipping_district].filter(Boolean).join(', ')}
                  </div>
                )}
                {order.shipping_address && <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{order.shipping_address}</p>}
              </div>
            )}
          </div>

          <div className={`border rounded-xl p-4 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
            <p className={`text-xs font-bold uppercase mb-3 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Articles ({items.length})</p>
            {items.length === 0 && <p className={`text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun article</p>}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {item.product_image
                    ? <img src={item.product_image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    : <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}><ShoppingBag size={14} className={dark ? 'text-slate-400' : 'text-gray-400'} /></div>}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{item.product_name || ''}</p>
                    <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{Number(item.quantity ?? 0)} × {Number(item.unit_price ?? 0).toFixed(0)} FCFA</p>
                  </div>
                  <span className={`font-bold text-sm shrink-0 ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{Number(item.total_price ?? 0).toFixed(0)} FCFA</span>
                </div>
              ))}
            </div>
            <div className={`mt-4 pt-3 border-t space-y-1 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className={`flex justify-between text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}><span>Sous-total</span><span className="font-semibold">{Math.max(0, subtotal).toFixed(0)} FCFA</span></div>
              <div className={`flex justify-between text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}><span>Livraison</span><span className="font-semibold">{shippingFee.toFixed(0)} FCFA</span></div>
              <div className={`flex justify-between text-sm font-bold pt-1 border-t ${dark ? 'text-white border-slate-700' : 'text-gray-800 border-gray-100'}`}><span>Total</span><span className="text-indigo-500">{totalAmount.toFixed(0)} FCFA</span></div>
            </div>
          </div>
        </div>

        <div className={`px-5 py-3 border-t flex justify-end shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </motion.div>
    </div>
  );
}

function UltraOrders() {
  const { dark } = useDark();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [driverProfiles, setDriverProfiles] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const deepLinkHandledRef = useRef(false);

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    if (location.search) {
      navigate(location.pathname, { replace: true });
    }
  };
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    delivered: 0,
    revenue: 0
  });


  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetOrder, setAssignTargetOrder] = useState(null);

  const fetchDriverProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, is_available')
        .eq('role', 'driver')
        .order('first_name', { ascending: true });
      if (!error) setDriverProfiles(data || []);
    } catch (_) { }
  };

  const openAssignDialog = (order) => {
    setAssignTargetOrder(order);
    setAssignDialogOpen(true);
  };

  const assignDriver = async (orderId, driverId) => {
    try {
      const payload = { driver_id: driverId || null };
      if (driverId) payload.status = 'confirmed';
      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId);
      if (error) throw error;

      const driver = driverId ? driverProfiles.find(d => d.id === driverId) : null;
      const optimisticName = driver
        ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || driver.email
        : null;

      setAssignDialogOpen(false);
      toast.success(driverId ? `Livreur assigné : ${optimisticName}` : 'Livreur désassigné');
      await fetchOrders();
    } catch (e) {
      toast.error(`Erreur: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchDriverProfiles();

    // Realtime subscription
    const subscription = supabase
      .channel('orders_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchOrders();
        fetchStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedOrder?.id) return;
    const updated = orders.find((o) => o.id === selectedOrder.id);
    if (updated) {
      setSelectedOrder(updated);
    }
  }, [orders, selectedOrder?.id]);

  const fetchOrderDetails = async (orderId) => {
    try {
      setDetailsLoading(true);
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (orderError) throw orderError;

      const { data: itemsRaw, error: itemsError } = await supabase
        .from('order_items')
        .select('*, products(main_image, images)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (itemsError) throw itemsError;

      const items = (itemsRaw || []).map(item => ({
        ...item,
        product_image: item.product_image
          || item.products?.main_image
          || (Array.isArray(item.products?.images) ? item.products.images[0] : null)
          || null,
      }));

      setSelectedOrder({
        ...orderRow,
        items,
      });
      setDetailsOpen(true);
    } catch (e) {
      toast.error('Erreur chargement détails');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (deepLinkHandledRef.current) return;

    const params = new URLSearchParams(location.search || '');
    const orderId = params.get('orderId');
    if (!orderId) return;

    deepLinkHandledRef.current = true;
    setSelectedOrderId(orderId);
    fetchOrderDetails(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('order_details_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      toast.error('Erreur chargement commandes');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_order_statistics', { p_period: 'month' });

      if (error) throw error;
      if (data && data[0]) {
        setStats({
          total: data[0].total_orders || 0,
          pending: data[0].pending_orders || 0,
          delivered: data[0].completed_orders || 0,
          revenue: data[0].total_revenue || 0
        });
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[UltraOrders] auth.getUser error:', authError);
      } else {
        console.log('[UltraOrders] auth user:', authData?.user?.id, authData?.user?.email);
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('id,status')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Mise à jour refusée (0 ligne modifiée). Vérifie les RLS/policies admin sur la table orders.'
        );
      }

      console.log('[UltraOrders] order status updated:', data);

      // Send push notification for status change
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, order_number, user_id, total_amount, driver_id')
          .eq('id', orderId)
          .single();
        if (orderData) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              type: newStatus === 'shipped' && orderData.driver_id
                ? 'driver_assigned'
                : 'order_status_changed',
              record: { ...orderData, status: newStatus },
            },
          });
        }
      } catch (pushErr) {
        console.warn('Push notification failed:', pushErr);
      }

      toast.success('Statut mis à jour');
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status: newStatus } : prev));
      fetchOrders();

      if (detailsOpen && selectedOrder?.id === orderId) {
        fetchOrderDetails(orderId);
      }

      setAnchorEl(null);
    } catch (error) {
      console.error('[UltraOrders] handleStatusChange error:', error);
      const message =
        (error && typeof error === 'object' && 'message' in error && error.message)
          ? error.message
          : 'Erreur mise à jour';
      toast.error(message);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusCls = {
    pending:'bg-amber-100 text-amber-700', confirmed:'bg-green-100 text-green-700',
    processing:'bg-blue-100 text-blue-700', shipped:'bg-purple-100 text-purple-700',
    delivered:'bg-teal-100 text-teal-700', cancelled:'bg-red-100 text-red-600',
    refunded:'bg-orange-100 text-orange-600'
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Gestion des Commandes</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrders}><RefreshCw size={13} /> Actualiser</Button>
          <Button variant="outline" size="sm"><Download size={13} /> <span className="hidden sm:inline">Exporter</span></Button>
          <Button variant="outline" size="sm"><Printer size={13} /> <span className="hidden sm:inline">Imprimer</span></Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total Commandes', value:stats.total, Icon:ShoppingBag, bg:'bg-indigo-50 dark:bg-indigo-900/30', c:'text-indigo-600 dark:text-indigo-400' },
          { label:'En Attente', value:stats.pending, Icon:Clock, bg:'bg-amber-50 dark:bg-amber-900/30', c:'text-amber-600 dark:text-amber-400' },
          { label:'Livrées', value:stats.delivered, Icon:CheckCircle, bg:'bg-green-50 dark:bg-green-900/30', c:'text-green-600 dark:text-green-400' },
          { label:'Revenus', value:`${Number(stats.revenue).toFixed(0)} F`, Icon:TrendingUp, bg:'bg-purple-50 dark:bg-purple-900/30', c:'text-purple-600 dark:text-purple-400' },
        ].map(({label, value, Icon, bg, c}, i) => (
          <motion.div key={i} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:i*0.08 }}>
            <Card className={`border shadow-sm ${dark ? 'border-slate-700' : 'border-indigo-100/70'}`}>
              <CardContent className="p-4 flex items-start justify-between">
                <div>
                  <p className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</p>
                  <p className={`text-2xl font-extrabold ${dark ? 'text-white' : 'text-gray-800'}`}>{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${bg}`}><Icon size={20} className={c} /></div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher par numéro ou client..." className="pl-9" />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className={`text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-200 text-gray-700'}`}>
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_FR).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={dark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-50/80 border-b border-gray-100'}>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Commande</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Client</th>
                  <th className={`px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide hidden sm:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Art.</th>
                  <th className={`px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Total</th>
                  <th className={`px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Statut</th>
                  <th className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide hidden lg:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Livreur</th>
                  <th className={`px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-100/80'}>
                {filteredOrders.map((order) => {
                  const driverName = order.driver_name?.trim() ||
                    (order.driver_id ? driverProfiles.find(d => d.id === order.driver_id) : null)?.first_name || null;
                  return (
                    <tr key={order.id} className={`transition-colors ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50/60'}`}>
                      <td className="px-3 py-2.5">
                        <p className={`font-bold text-xs ${dark ? 'text-white' : 'text-gray-800'}`}>{order.order_number}</p>
                        <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="text-[10px]">{(order.customer_name||'?')[0]?.toUpperCase()}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{order.customer_name}</p>
                            {order.customer_phone_profile && <p className={`text-[11px] truncate ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{order.customer_phone_profile}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 text-center hidden sm:table-cell ${dark ? 'text-slate-300' : 'text-gray-600'}`}>
                        <span className={`inline-flex items-center justify-center min-w-[24px] h-6 text-xs font-medium rounded-lg ${dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>{order.total_items}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="font-bold text-indigo-500 text-xs">{order.total_amount?.toFixed(0)} FCFA</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant={order.status || 'default'} className="text-[10px]">{STATUS_FR[order.status]||order.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                        {driverName
                          ? <Badge variant="default" className="text-[10px]">{driverName}</Badge>
                          : <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>—</span>}
                        <button onClick={() => openAssignDialog(order)} className="block text-[11px] text-indigo-500 hover:underline mt-0.5">
                          {order.driver_id ? 'Modifier' : 'Assigner'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => { setSelectedOrder(order); setDetailsOpen(true); fetchOrderDetails(order.id); }}
                            className={`p-1.5 rounded-lg text-indigo-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`} title="Détails"><Eye size={14} /></button>
                          <div className="relative">
                            <button onClick={() => setAnchorEl(anchorEl === order.id ? null : order.id)}
                              className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`} title="Changer statut"><MoreVertical size={14} /></button>
                            {anchorEl === order.id && (
                              <div className={`absolute right-0 top-8 z-20 rounded-xl shadow-xl border py-1 w-40 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                                {['pending','confirmed','processing','shipped','delivered','cancelled'].map(s => (
                                  <button key={s} onClick={() => { handleStatusChange(order.id, s); setAnchorEl(null); }}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${dark ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColors[s] }} />
                                    {STATUS_FR[s]||s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={7} className={`text-center py-12 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune commande</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <OrderDetailsDialog open={detailsOpen} order={selectedOrder} onClose={handleCloseDetails} loading={detailsLoading} dark={dark} />

      {assignDialogOpen && assignTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl shadow-2xl w-full max-w-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div>
                <p className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Assigner un livreur</p>
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-400'}`}>Commande #{assignTargetOrder.order_number || assignTargetOrder.id?.slice(0, 8)}</p>
              </div>
              <button onClick={() => setAssignDialogOpen(false)} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto space-y-2">
              {driverProfiles.length === 0
                ? <p className={`text-center py-6 text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun livreur (role=driver)</p>
                : driverProfiles.map(driver => {
                    const name = `${driver.first_name||''} ${driver.last_name||''}`.trim() || driver.email || driver.id.slice(0, 8);
                    const isAssigned = assignTargetOrder.driver_id === driver.id;
                    return (
                      <button key={driver.id} onClick={() => assignDriver(assignTargetOrder.id, driver.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isAssigned ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : dark ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={isAssigned ? '' : 'bg-gray-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400'}>{name[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-sm ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{name}</span>
                            <Badge variant={driver.is_available !== false ? 'success' : 'warning'} className="text-[10px]">
                              {driver.is_available !== false ? 'Disponible' : 'Occupé'}
                            </Badge>
                          </div>
                          <p className={`text-xs truncate ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{driver.phone || driver.email || ''}</p>
                        </div>
                        {isAssigned && <CheckCircle size={16} className="text-indigo-500 shrink-0" />}
                      </button>
                    );
                  })}
            </div>
            <div className={`flex items-center justify-between px-5 py-3 border-t ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              {assignTargetOrder.driver_id && (
                <Button variant="destructive" size="sm" onClick={() => assignDriver(assignTargetOrder.id, null)}>Désassigner</Button>
              )}
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setAssignDialogOpen(false)}>Annuler</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default UltraOrders;
