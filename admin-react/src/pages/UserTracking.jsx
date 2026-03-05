import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Eye, User, Lock, Package, MessageSquare, Search, TrendingUp, Clock, Tag, CreditCard, X, CheckCircle, Star, Share2, Smartphone, Wifi, Fingerprint, RefreshCw, Download, Loader2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDark } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const actionConfig = {
  cart_add: { label: 'Ajout panier', dot: 'bg-green-500' },
  cart_remove: { label: 'Retrait panier', dot: 'bg-red-400' },
  favorite_add: { label: 'Ajout favoris', dot: 'bg-rose-500' },
  favorite_remove: { label: 'Retrait favoris', dot: 'bg-gray-400' },
  product_view: { label: 'Produit consulté', dot: 'bg-blue-500' },
  profile_update: { label: 'Profil mis à jour', dot: 'bg-purple-500' },
  login: { label: 'Connexion', dot: 'bg-cyan-500' },
  logout: { label: 'Déconnexion', dot: 'bg-slate-400' },
  order_placed: { label: 'Commande passée', dot: 'bg-orange-500' },
  message_sent: { label: 'Message envoyé', dot: 'bg-indigo-500' },
  search: { label: 'Recherche', dot: 'bg-amber-700' },
  category_view: { label: 'Catégorie vue', dot: 'bg-teal-500' },
  checkout_started: { label: 'Checkout commencé', dot: 'bg-yellow-500' },
  checkout_abandoned: { label: 'Checkout abandonné', dot: 'bg-red-500' },
  payment_completed: { label: 'Paiement effectué', dot: 'bg-green-600' },
  review_posted: { label: 'Avis posté', dot: 'bg-yellow-400' },
  share_product: { label: 'Produit partagé', dot: 'bg-violet-500' },
  app_opened: { label: 'App ouverte', dot: 'bg-emerald-400' },
  app_closed: { label: 'App fermée', dot: 'bg-red-300' },
};

function UserTracking() {
  const { dark } = useDark();
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const [activities, setActivities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [digitalFootprint, setDigitalFootprint] = useState(null);
  const [liveActivity, setLiveActivity] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersTotalSpent, setOrdersTotalSpent] = useState(0);
  
  useEffect(() => {
    if (userId) {
      fetchAllData();
      
      const subscription = supabase
        .channel(`user_tracking_${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activities',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          setLiveActivity(payload.new);
          setActivities(prev => [payload.new, ...prev].slice(0, 100));
        })
        .subscribe();
      
      const interval = setInterval(() => {
        fetchMetrics();
      }, 10000);
      
      return () => {
        subscription.unsubscribe();
        clearInterval(interval);
      };
    }
  }, [userId]);
  
  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUser(),
        fetchActivities(),
        fetchSessions(),
        fetchMetrics(),
        buildDigitalFootprint(),
        fetchOrders()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };
  
  const fetchUser = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setUser(data);
  };
  
  const fetchActivities = async () => {
    const { data } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    setActivities(data || []);
  };
  
  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(30);
      if (!error) setSessions(data || []);
    } catch (_) { /* table may not exist */ }
  };
  
  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('period_type', 'all_time')
        .single();
      if (!error) setMetrics(data);
    } catch (_) { /* table may not exist */ }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, order_items(id, quantity, unit_price, products(name))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const list = data || [];
      setOrders(list);
      setOrdersTotalSpent(list.reduce((s, o) => s + (o.total_amount || 0), 0));
    } catch (_) {}
  };
  
  const buildDigitalFootprint = async () => {
    const { data: activities } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', userId);
    
    const footprint = {
      totalInteractions: activities?.length || 0,
      uniqueProducts: new Set(),
      uniqueCategories: new Set(),
      searchQueries: [],
      favoriteProducts: [],
      messagingActivity: 0,
      socialShares: 0,
      reviewsPosted: 0
    };
    
    activities?.forEach(activity => {
      if (activity.entity_type === 'product' && activity.entity_id) {
        footprint.uniqueProducts.add(activity.entity_id);
      }
      if (activity.entity_type === 'category' && activity.entity_id) {
        footprint.uniqueCategories.add(activity.entity_id);
      }
      if (activity.action_type === 'search') {
        footprint.searchQueries.push(activity.action_details?.query);
      }
      if (activity.action_type === 'message_sent') {
        footprint.messagingActivity++;
      }
      if (activity.action_type === 'share_product') {
        footprint.socialShares++;
      }
      if (activity.action_type === 'review_posted') {
        footprint.reviewsPosted++;
      }
    });
    
    footprint.uniqueProducts = footprint.uniqueProducts.size;
    footprint.uniqueCategories = footprint.uniqueCategories.size;
    
    setDigitalFootprint(footprint);
  };
  
  const calculateEngagementScore = () => {
    if (!metrics) return 0;
    
    const weights = {
      actions: 0.3,
      orders: 0.25,
      products: 0.15,
      messages: 0.1,
      favorites: 0.1,
      sessions: 0.1
    };
    
    const score = 
      Math.min(100, metrics.total_actions * 0.1) * weights.actions +
      Math.min(100, metrics.orders_placed * 10) * weights.orders +
      Math.min(100, metrics.products_viewed * 0.5) * weights.products +
      Math.min(100, metrics.messages_sent * 2) * weights.messages +
      Math.min(100, metrics.favorites_added * 1) * weights.favorites +
      Math.min(100, metrics.total_sessions * 0.5) * weights.sessions;
    
    return Math.round(score);
  };
  
  const engagementScore = calculateEngagementScore();
  
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={40} className="animate-spin text-indigo-400" />
    </div>
  );
  if (!user) return (
    <div className={`p-4 rounded-2xl text-sm ${dark ? 'bg-red-900/20 border border-red-800 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>Utilisateur non trouvé</div>
  );
  const scoreLabel = engagementScore >= 80 ? 'Très actif' : engagementScore >= 60 ? 'Actif' : engagementScore >= 40 ? 'Modéré' : engagementScore >= 20 ? 'Peu actif' : 'Inactif';

  return (
    <div>
      <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/users')} className={`p-2 rounded-xl ${dark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100'}`}><ArrowLeft size={18} className={dark ? 'text-slate-400' : 'text-gray-600'} /></button>
        {user.avatar_url
          ? <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          : <div className="w-14 h-14 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xl font-bold">{(user.first_name || user.email || 'U')[0].toUpperCase()}</div>}
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{user.first_name} {user.last_name}</h1>
          <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{user.email} · ID: {user.id.slice(0, 8)}…</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchAllData()}><RefreshCw size={13} /> Actualiser</Button>
        <Button size="sm"><Download size={13} /> Exporter</Button>
      </motion.div>

      <AnimatePresence>
        {liveActivity && (
          <motion.div initial={{ opacity:0, x:80 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-80 }}
            className={`flex items-center gap-2 p-3 mb-4 rounded-2xl text-sm ${dark ? 'bg-blue-900/20 border border-blue-800 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
            <Wifi size={15} className="text-blue-500 shrink-0" />
            <span><strong>Activité en temps réel:</strong> {actionConfig[liveActivity.action_type]?.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
          <p className="text-sm font-medium opacity-80 mb-2">Score d'Engagement</p>
          <p className="text-5xl font-extrabold">{engagementScore}</p>
          <p className="text-sm opacity-70 mb-3">/100</p>
          <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-white/20">{scoreLabel}</span>
        </div>
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label:'Empreinte Digitale', value:digitalFootprint?.totalInteractions||0, Icon:Fingerprint, bg:'bg-blue-50', c:'text-blue-600' },
            { label:'Produits Explorés', value:digitalFootprint?.uniqueProducts||0, Icon:Eye, bg:'bg-green-50', c:'text-green-600' },
            { label:'Temps Total', value:`${Math.round((metrics?.total_time_spent_seconds||0)/60)} min`, Icon:Clock, bg:'bg-amber-50', c:'text-amber-600' },
            { label:'Taux Conversion', value:`${Math.round((metrics?.orders_placed||0)/Math.max(1,metrics?.total_sessions||1)*100)}%`, Icon:TrendingUp, bg:'bg-purple-50', c:'text-purple-600' },
            { label:'Valeur Lifetime', value:`${ordersTotalSpent.toLocaleString('fr-FR')} F`, Icon:Tag, bg:'bg-rose-50', c:'text-rose-500' },
            { label:'Dernière Activité', value:metrics?.last_activity_at ? formatDistanceToNow(new Date(metrics.last_activity_at),{locale:fr,addSuffix:true}) : 'Jamais', Icon:Clock, bg:'bg-cyan-50', c:'text-cyan-600' },
          ].map(({label,value,Icon,bg,c},i) => (
            <div key={i} className={`rounded-2xl border p-4 flex items-start gap-3 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
              <div className={`p-2 rounded-lg ${bg} shrink-0`}><Icon size={16} className={c} /></div>
              <div><p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</p><p className={`font-bold text-sm mt-0.5 truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{value}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className={`flex gap-1 p-1 rounded-xl mb-5 w-fit ${dark ? 'bg-slate-800' : 'bg-gray-100'}`}>
        {['Timeline', 'Commandes', 'Comportement', 'Sessions'].map((tab, i) => (
          <button key={i} onClick={() => setTabValue(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tabValue === i ? (dark ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (dark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')}`}>
            {tab}
          </button>
        ))}
      </div>
      
      {tabValue === 0 && (
        <Card className="p-5">
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Chronologie des Activités</h3>
          {activities.length === 0
            ? <p className={`text-center py-8 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune activité enregistrée</p>
            : <div className="space-y-1">
                {activities.slice(0, 50).map((activity, i) => {
                  const cfg = actionConfig[activity.action_type] || {};
                  return (
                    <div key={activity.id || i} className={`flex items-center gap-3 py-2 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                      <div className="relative shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.dot || 'bg-gray-300'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{cfg.label || activity.action_type}</span>
                          {activity.entity_name && <span className={`text-[11px] px-2 py-0.5 border rounded-full ${dark ? 'border-slate-600 text-slate-400' : 'border-gray-200 text-gray-500'}`}>{activity.entity_name}</span>}
                        </div>
                        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{format(new Date(activity.created_at), 'dd MMMM yyyy à HH:mm:ss', { locale: fr })}</p>
                      </div>
                      <span className={`text-xs shrink-0 hidden sm:block ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{formatDistanceToNow(new Date(activity.created_at), { locale: fr, addSuffix: true })}</span>
                    </div>
                  );
                })}
              </div>}
        </Card>
      )}

      {tabValue === 1 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-bold ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Commandes ({orders.length})</h3>
            <span className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Total: <strong className="text-indigo-500">{ordersTotalSpent.toLocaleString('fr-FR')} FCFA</strong></span>
          </div>
          {orders.length === 0
            ? <p className={`text-center py-8 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune commande enregistrée</p>
            : <div className="space-y-1">
                {orders.map((order) => {
                  const sc = order.status === 'delivered' ? (dark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700') : order.status === 'cancelled' ? (dark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600') : (dark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700');
                  return (
                    <div key={order.id} className={`flex items-center gap-3 py-2.5 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                      <ShoppingCart size={15} className={`shrink-0 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-gray-800'}`}>#{order.id.slice(0, 8)}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sc}`}>{order.status}</span>
                        </div>
                        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{format(new Date(order.created_at), 'dd MMM yyyy HH:mm', { locale: fr })} · {order.order_items?.length || 0} article(s)</p>
                      </div>
                      <span className="font-bold text-indigo-500 text-sm shrink-0">{(order.total_amount || 0).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  );
                })}
              </div>}
        </Card>
      )}

      {tabValue === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Distribution des actions</h3>
            {activities.length === 0
              ? <p className={`text-center py-8 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune activité</p>
              : (() => {
                  const counts = {};
                  activities.forEach(a => { const l = actionConfig[a.action_type]?.label || a.action_type; counts[l] = (counts[l] || 0) + 1; });
                  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, count]) => (
                    <div key={label} className="mb-3">
                      <div className="flex justify-between mb-1"><span className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-600'}`}>{label}</span><span className={`text-xs font-bold ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{count}</span></div>
                      <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}><div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(100, count / activities.length * 100)}%` }} /></div>
                    </div>
                  ));
                })()}
          </Card>
          <Card className="p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Métriques comportementales</h3>
            {metrics
              ? <div className="space-y-2">
                  {[
                    { label:'Total actions', value:metrics.total_actions||0 },
                    { label:'Commandes passées', value:metrics.orders_placed||0 },
                    { label:'Produits consultés', value:metrics.products_viewed||0 },
                    { label:'Messages envoyés', value:metrics.messages_sent||0 },
                    { label:'Favoris ajoutés', value:metrics.favorites_added||0 },
                    { label:'Sessions totales', value:metrics.total_sessions||0 },
                    { label:'Temps total', value:`${Math.round((metrics.total_time_spent_seconds||0)/60)} min` },
                    { label:'Montant total dépensé', value:`${(metrics.total_amount_spent||0).toLocaleString('fr-FR')} FCFA` },
                  ].map((item, i) => (
                    <div key={i} className={`flex justify-between py-1.5 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                      <span className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{item.label}</span>
                      <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              : <p className={`text-center py-8 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune métrique disponible</p>}
          </Card>
          <Card className="p-5 md:col-span-2">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Empreinte digitale</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label:'Interactions', value:digitalFootprint?.totalInteractions||0, bg:'bg-indigo-50', c:'text-indigo-600' },
                { label:'Produits', value:digitalFootprint?.uniqueProducts||0, bg:'bg-green-50', c:'text-green-600' },
                { label:'Catégories', value:digitalFootprint?.uniqueCategories||0, bg:'bg-amber-50', c:'text-amber-600' },
                { label:'Recherches', value:digitalFootprint?.searchQueries?.length||0, bg:'bg-purple-50', c:'text-purple-600' },
                { label:'Messages', value:digitalFootprint?.messagingActivity||0, bg:'bg-blue-50', c:'text-blue-600' },
                { label:'Avis', value:digitalFootprint?.reviewsPosted||0, bg:'bg-yellow-50', c:'text-yellow-600' },
              ].map((item, i) => (
                <div key={i} className={`${dark ? 'bg-slate-700/50' : item.bg} rounded-2xl p-3 text-center`}>
                  <p className={`text-2xl font-extrabold ${item.c}`}>{item.value}</p>
                  <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tabValue === 3 && (
        <Card className="p-5">
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Historique des sessions</h3>
          {sessions.length === 0
            ? <div>
                <p className={`text-sm mb-1 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune session enregistrée pour cet utilisateur.</p>
                <p className={`text-xs ${dark ? 'text-slate-600' : 'text-gray-300'}`}>Les sessions sont tracées uniquement si la table <code className={dark ? 'bg-slate-700 px-1 rounded' : ''}>user_sessions</code> est active dans la base.</p>
              </div>
            : <div className="space-y-1">
                {sessions.map((session, i) => {
                  const duration = session.ended_at && session.started_at ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000) : null;
                  return (
                    <div key={session.id || i} className={`flex items-center gap-3 py-2.5 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${session.ended_at ? 'bg-green-400' : 'bg-amber-400'}`}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{format(new Date(session.started_at), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${session.ended_at ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{session.ended_at ? 'Terminée' : 'En cours'}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                          {duration !== null && <span>{duration < 60 ? `${duration} min` : `${Math.round(duration/60)}h ${duration%60}min`}</span>}
                          {session.device_type && <span className="ml-2">· {session.device_type}</span>}
                          {session.ip_address && <span className="ml-2">· {session.ip_address}</span>}
                        </p>
                      </div>
                      <span className={`text-xs shrink-0 hidden sm:block ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{formatDistanceToNow(new Date(session.started_at), { locale: fr, addSuffix: true })}</span>
                    </div>
                  );
                })}
              </div>}
        </Card>
      )}
    </div>
  );
}

export default UserTracking;
