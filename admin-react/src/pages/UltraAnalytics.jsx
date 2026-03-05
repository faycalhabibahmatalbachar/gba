import React, { useState, useEffect } from 'react';
import { Users, Activity, Zap, BarChart2, TrendingUp, RefreshCw, Download, Eye, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line, Doughnut } from 'react-chartjs-2';
import { useDark } from '../components/Layout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';

// Register ChartJS components
try {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    ChartTooltip,
    Legend,
    Filler
  );
} catch (error) {
  console.error('ChartJS registration error:', error);
}

const actionTypeConfig = {
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

function UltraAnalytics() {
  const { dark } = useDark();
  const [realtimeData, setRealtimeData] = useState({
    activeUsers: 0,
    activeSessions: 0,
    actionsLastHour: 0,
    actionsToday: 0,
    topAction: '',
    topPage: ''
  });
  
  const [activities, setActivities] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [conversionData, setConversionData] = useState([]);
  const [userMetrics, setUserMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);

  // Activity feed filters
  const [filterDate, setFilterDate] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterUser, setFilterUser] = useState('');
  

  useEffect(() => {
    fetchAllData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRealtimeData();
    }, 30000);
    
    // Realtime subscription with error handling
    let subscription;
    try {
      subscription = supabase
        .channel('activities_channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activities'
        }, (payload) => {
          if (payload.new) {
            setActivities(prev => [payload.new, ...prev].slice(0, 50));
            fetchRealtimeData();
          }
        })
        .subscribe();
    } catch (error) {
      console.error('Subscription error:', error);
    }
    
    return () => {
      clearInterval(interval);
      if (subscription) subscription.unsubscribe();
    };
  }, [timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchRealtimeData(),
      fetchActivities(),
      fetchTopProducts(),
      fetchConversionData(),
      fetchUserMetrics()
    ]);
    setLoading(false);
  };

  const fetchRealtimeData = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_realtime_analytics');
      
      if (error) {
        console.error('RPC error:', error);
        // Set default values if function doesn't exist yet
        setRealtimeData({
          activeUsers: 0,
          activeSessions: 0,
          actionsLastHour: 0,
          actionsToday: 0,
          topAction: 'N/A',
          topPage: 'N/A'
        });
        return;
      }
      if (data && data[0]) {
        setRealtimeData({
          activeUsers: data[0].active_users_now || 0,
          activeSessions: data[0].active_sessions || 0,
          actionsLastHour: data[0].actions_last_hour || 0,
          actionsToday: data[0].actions_today || 0,
          topAction: data[0].top_action_type || 'N/A',
          topPage: data[0].top_page || 'N/A'
        });
      }
    } catch (error) {
      console.error('Error fetching realtime data:', error);
      setRealtimeData({
        activeUsers: 0,
        activeSessions: 0,
        actionsLastHour: 0,
        actionsToday: 0,
        topAction: 'N/A',
        topPage: 'N/A'
      });
    }
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select(`
          *,
          profiles:user_id (
            email,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Activities fetch error:', error);
        setActivities([]);
        return;
      }
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('top_viewed_products')
        .select('*')
        .limit(10);
      
      if (error) {
        console.error('Top products error:', error);
        setTopProducts([]);
        return;
      }
      setTopProducts(data || []);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setTopProducts([]);
    }
  };

  const fetchConversionData = async () => {
    try {
      const { data, error } = await supabase
        .from('conversion_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);
      
      if (error) {
        console.error('Conversion data error:', error);
        setConversionData([]);
        return;
      }
      setConversionData(data || []);
    } catch (error) {
      console.error('Error fetching conversion data:', error);
      setConversionData([]);
    }
  };

  const fetchUserMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_metrics')
        .select(`
          *,
          profiles:user_id (
            email,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('period_type', 'all_time')
        .order('total_actions', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('User metrics error:', error);
        setUserMetrics([]);
        return;
      }
      setUserMetrics(data || []);
    } catch (error) {
      console.error('Error fetching user metrics:', error);
      setUserMetrics([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
    toast.success('Données actualisées');
  };

  // Chart data preparation
  const conversionChartData = {
    labels: conversionData.slice(0, 7).reverse().map(d => 
      new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' })
    ),
    datasets: [
      {
        label: 'Taux de conversion',
        data: conversionData.slice(0, 7).reverse().map(d => d.overall_conversion_rate),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Panier → Checkout',
        data: conversionData.slice(0, 7).reverse().map(d => d.cart_to_checkout_rate),
        borderColor: '#48bb78',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const activityDistributionData = {
    labels: Object.values(actionTypeConfig).slice(0, 6).map(c => c.label),
    datasets: [{
      data: [45, 30, 25, 20, 15, 10],
      backgroundColor: ['#667eea','#e91e63','#4caf50','#ff9800','#2196f3','#9c27b0'],
      borderWidth: 0
    }]
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={40} className="animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Analytics Dashboard</h1>
          <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Surveillance en temps réel des activités utilisateurs</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
            className={`text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-gray-200'}`}>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualiser
          </Button>
          <Button size="sm"><Download size={13} /> Exporter</Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Utilisateurs actifs', value:realtimeData.activeUsers, Icon:Users, bg:'bg-indigo-50 dark:bg-indigo-900/30', c:'text-indigo-600 dark:text-indigo-400', trend:'+12%' },
          { label:'Sessions actives', value:realtimeData.activeSessions, Icon:Activity, bg:'bg-green-50 dark:bg-green-900/30', c:'text-green-600 dark:text-green-400', trend:'+8%' },
          { label:'Actions (1h)', value:realtimeData.actionsLastHour, Icon:Zap, bg:'bg-amber-50 dark:bg-amber-900/30', c:'text-amber-600 dark:text-amber-400', trend:'+25%' },
          { label:"Actions aujourd'hui", value:realtimeData.actionsToday, Icon:BarChart2, bg:'bg-rose-50 dark:bg-rose-900/30', c:'text-rose-500 dark:text-rose-400', trend:'+15%' },
        ].map(({ label, value, Icon, bg, c, trend }, i) => (
          <motion.div key={i} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:i*0.08 }}
            className={`rounded-2xl border p-4 flex items-start justify-between ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
            <div>
              <p className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</p>
              <p className={`text-3xl font-extrabold ${dark ? 'text-white' : 'text-gray-800'}`}>{value.toLocaleString()}</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-500 mt-1"><TrendingUp size={11} />{trend}</span>
            </div>
            <div className={`p-3 rounded-xl ${bg}`}><Icon size={20} className={c} /></div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="flex-1 p-5">
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Taux de Conversion</h3>
          <div style={{ height:280 }}>
            <Line data={conversionChartData} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true, ticks:{ callback:(v)=>`${v}%` } } } }} />
          </div>
        </Card>
        <Card className="w-full lg:w-72 shrink-0 p-5">
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Distribution des Actions</h3>
          <div style={{ height:280 }}>
            <Doughnut data={activityDistributionData} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }} />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Activités en Temps Réel</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className={`text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-gray-200'}`} />
            <input placeholder="Produit..." value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
              className={`text-sm border rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-gray-200'}`} />
            <input placeholder="Utilisateur..." value={filterUser} onChange={e => setFilterUser(e.target.value)}
              className={`text-sm border rounded-lg px-2 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'border-gray-200'}`} />
            {(filterDate || filterProduct || filterUser) && (
              <button onClick={() => { setFilterDate(''); setFilterProduct(''); setFilterUser(''); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1.5 rounded-lg">
                <X size={12} /> Reset
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[440px] overflow-y-auto space-y-1">
          <AnimatePresence>
            {activities.map((activity, index) => {
              const actUser = activity.profiles;
              const cfg = actionTypeConfig[activity.action_type] || {};
              const actDate = activity.created_at ? activity.created_at.slice(0, 10) : '';
              if (filterDate && actDate !== filterDate) return null;
              if (filterProduct && !(activity.entity_name || '').toLowerCase().includes(filterProduct.toLowerCase())) return null;
              if (filterUser) {
                const fn = `${actUser?.first_name||''} ${actUser?.last_name||''} ${actUser?.email||''}`.toLowerCase();
                if (!fn.includes(filterUser.toLowerCase())) return null;
              }
              return (
                <motion.div key={activity.id} initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:16 }} transition={{ delay:index*0.03 }}
                  className={`flex items-center gap-3 py-2 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                  <div className="relative shrink-0">
                    {actUser?.avatar_url
                      ? <img src={actUser.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">{(actUser?.first_name||actUser?.email||'?')[0].toUpperCase()}</div>}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.dot||'bg-gray-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{actUser?.first_name} {actUser?.last_name}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{cfg.label||activity.action_type}</span>
                      {activity.entity_name && <span className="text-[11px] text-gray-400">{activity.entity_name}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{new Date(activity.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {activities.length === 0 && <p className={`text-center py-8 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune activité</p>}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Top Produits Consultés</h3>
          <div className="space-y-3">
            {topProducts.map((product, i) => {
              const pct = topProducts[0]?.view_count ? Math.round((product.view_count / topProducts[0].view_count) * 100) : 0;
              const medal = i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-amber-600' : 'bg-indigo-400';
              return (
                <div key={product.product_id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full ${medal} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{product.product_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Eye size={11} className="text-gray-400" /><span className="text-xs text-gray-500">{product.view_count} vues</span>
                      <Users size={11} className="text-gray-400 ml-2" /><span className="text-xs text-gray-500">{product.unique_viewers ?? 0}</span>
                    </div>
                    <div className={`h-1.5 rounded-full mt-1 overflow-hidden ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}><div className="h-full bg-indigo-400 rounded-full" style={{ width:`${pct}%` }} /></div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                </div>
              );
            })}
            {topProducts.length === 0 && <p className={`text-center py-4 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun produit</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Utilisateurs les Plus Actifs</h3>
          <div className="space-y-3">
            {userMetrics.slice(0, 5).map((u, i) => {
              const score = Math.min(100, u.total_actions * 2);
              return (
                <div key={u.user_id} className="flex items-center gap-3">
                  {u.profiles?.avatar_url
                    ? <img src={u.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold shrink-0">{(u.profiles?.first_name||'?')[0]}</div>}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{u.profiles?.first_name} {u.profiles?.last_name}</p>
                    <p className="text-xs text-gray-400">{u.total_actions} actions · Score {score}</p>
                    <div className={`h-1.5 rounded-full mt-1 overflow-hidden ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}><div className="h-full bg-purple-400 rounded-full" style={{ width:`${score}%` }} /></div>
                  </div>
                </div>
              );
            })}
            {userMetrics.length === 0 && <p className={`text-center py-4 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun utilisateur</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default UltraAnalytics;
