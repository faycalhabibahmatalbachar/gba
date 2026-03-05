import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Users, Package, DollarSign, RefreshCw, ArrowRight,
  CheckCircle, Clock, UserPlus, Loader2, Truck, MessageCircle,
  BarChart3, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { supabase } from '../config/supabase';
import { format, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDark } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';

const FCFA = (v) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;
const STATUS_FR = {
  pending: 'En attente', confirmed: 'Confirmée', processing: 'En traitement',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

const QUICK_ACTIONS = [
  { label: 'Commandes', icon: ShoppingCart, path: '/orders', color: 'from-indigo-500 to-indigo-600' },
  { label: 'Produits', icon: Package, path: '/products', color: 'from-purple-500 to-purple-600' },
  { label: 'Livraisons', icon: Truck, path: '/deliveries', color: 'from-amber-500 to-amber-600' },
  { label: 'Messages', icon: MessageCircle, path: '/messages', color: 'from-green-500 to-green-600' },
  { label: 'Analytiques', icon: BarChart3, path: '/analytics', color: 'from-pink-500 to-pink-600' },
  { label: 'Utilisateurs', icon: Users, path: '/users', color: 'from-cyan-500 to-cyan-600' },
];

const PIE_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#30cfd0', '#ffa07a'];

function MiniSparkline({ data, color = 'rgba(255,255,255,0.6)' }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 72, H = 24;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 mt-1">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ title, value, Icon, sub, gradient, loading, delay = 0, sparkData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.28, delay }}
      className="rounded-2xl text-white overflow-hidden relative shadow-lg cursor-default"
      style={{ background: gradient }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
            {loading
              ? <div className="h-8 w-24 bg-white/25 rounded-lg animate-pulse mt-1.5 mb-1" />
              : <p className="text-2xl sm:text-3xl font-extrabold mt-1 mb-1 leading-none">{value}</p>}
            <p className="text-xs opacity-70">{sub}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="bg-white/20 rounded-xl p-2.5"><Icon size={22} /></div>
            {sparkData && <MiniSparkline data={sparkData} />}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15">
        <motion.div className="h-full bg-white/40" initial={{ width: 0 }} animate={{ width: '70%' }} transition={{ delay: delay + 0.4, duration: 0.5 }} />
      </div>
    </motion.div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { dark } = useDark();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, orders: 0, products: 0, users: 0, pendingOrders: 0, deliveredOrders: 0, newUsersToday: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [salesByDay, setSalesByDay] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30).toISOString();
      const todayStart = startOfDay(now).toISOString();

      const [ordersRes, productsRes, usersRes, recentOrdersRes, categoryRes, newUsersRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, status, created_at').gte('created_at', thirtyDaysAgo),
        supabase.from('products').select('id, name, main_image, price', { count: 'exact', head: false }),
        supabase.from('profiles').select('id', { count: 'exact', head: false }),
        supabase.from('orders').select('id, order_number, total_amount, status, created_at, profiles(first_name, last_name, email)').order('created_at', { ascending: false }).limit(8),
        supabase.from('order_items').select('product_id, quantity, unit_price, products(name, main_image, categories(name))').limit(200),
        supabase.from('profiles').select('id', { count: 'exact', head: false }).gte('created_at', todayStart),
      ]);

      const orders = ordersRes.data || [];
      const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount || 0), 0);
      const pendingCount = orders.filter(o => o.status === 'pending').length;
      const deliveredCount = orders.filter(o => o.status === 'delivered').length;

      // Sales by day (last 7 days)
      const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
      const byDay = days.map(day => {
        const label = format(day, 'EEE', { locale: fr });
        const dayStr = format(day, 'yyyy-MM-dd');
        const total = orders
          .filter(o => o.created_at?.startsWith(dayStr) && o.status !== 'cancelled')
          .reduce((s, o) => s + (o.total_amount || 0), 0);
        return { label, total };
      });
      setSalesByDay(byDay);

      // Top products by quantity sold
      const productMap = {};
      (categoryRes.data || []).forEach(item => {
        const pid = item.product_id;
        if (!pid) return;
        if (!productMap[pid]) {
          productMap[pid] = {
            id: pid,
            name: item.products?.name || 'Produit',
            image: item.products?.main_image,
            category: item.products?.categories?.name,
            qty: 0,
            revenue: 0,
          };
        }
        productMap[pid].qty += item.quantity || 0;
        productMap[pid].revenue += (item.unit_price || 0) * (item.quantity || 0);
      });
      const sortedProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(sortedProducts);

      // Category breakdown from orders
      const catMap = {};
      (categoryRes.data || []).forEach(item => {
        const cat = item.products?.categories?.name || 'Autres';
        catMap[cat] = (catMap[cat] || 0) + (item.quantity || 0);
      });
      setCategoryStats(Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6));

      if (recentOrdersRes.error) {
        console.error('[Dashboard] Recent orders error:', recentOrdersRes.error.message);
      }
      setStats({
        revenue: totalRevenue,
        orders: ordersRes.data?.length || 0,
        products: productsRes.data?.length || 0,
        users: usersRes.data?.length || 0,
        pendingOrders: pendingCount,
        deliveredOrders: deliveredCount,
        newUsersToday: newUsersRes.data?.length || 0,
      });
      setRecentOrders(recentOrdersRes.data || []);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const sparkRevenue = salesByDay.map(d => d.total);
  const statCards = [
    { title: 'Revenus (30j)', value: FCFA(stats.revenue), Icon: DollarSign, sub: `${stats.orders} commandes`, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', sparkData: sparkRevenue },
    { title: 'Commandes', value: stats.orders.toLocaleString('fr-FR'), Icon: ShoppingCart, sub: `${stats.pendingOrders} en attente`, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { title: 'Produits', value: stats.products.toLocaleString('fr-FR'), Icon: Package, sub: 'en catalogue', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { title: 'Utilisateurs', value: stats.users.toLocaleString('fr-FR'), Icon: Users, sub: `+${stats.newUsersToday} aujourd'hui`, gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
  ];

  const pieData = categoryStats.map(([name, value]) => ({ name, value }));

  const chartTextColor = dark ? '#94a3b8' : '#6b7280';
  const chartGridColor = dark ? '#1e293b' : '#f1f5f9';

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Tableau de bord</h1>
          <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })} — temps réel
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </Button>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <StatCard key={i} {...stat} loading={loading} delay={i * 0.06} />
        ))}
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Livrées', value: stats.deliveredOrders, color: 'emerald', Icon: CheckCircle },
          { label: 'En attente', value: stats.pendingOrders, color: 'amber', Icon: Clock },
          { label: 'Nouveaux utilisateurs', value: stats.newUsersToday, color: 'blue', Icon: UserPlus },
        ].map((m, i) => (
          <Card key={i} className="border-l-4" style={{ borderLeftColor: m.color === 'emerald' ? '#34d399' : m.color === 'amber' ? '#fbbf24' : '#60a5fa' }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-${m.color}-100 dark:bg-${m.color}-900/40`}>
                <m.Icon size={17} className={`text-${m.color}-500`} />
              </div>
              <div>
                {loading ? <Skeleton className="h-6 w-10" /> : <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{m.value}</p>}
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{m.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-indigo-500" />
            <CardTitle className="text-sm">Actions rapides</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {QUICK_ACTIONS.map(a => {
              const Icon = a.icon;
              return (
                <motion.button key={a.path} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(a.path)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gradient-to-br ${a.color} text-white shadow-sm hover:shadow-md transition-shadow`}>
                  <Icon size={18} />
                  <span className="text-[10px] sm:text-xs font-medium leading-tight text-center">{a.label}</span>
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Revenus — 7 derniers jours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {loading ? (
                <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesByDay}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#667eea" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis dataKey="label" tick={{ fill: chartTextColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <RTooltip contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: dark ? '#e2e8f0' : '#1f2937' }}
                      formatter={(v) => [FCFA(v), 'Revenu']} />
                    <Area type="monotone" dataKey="total" stroke="#667eea" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#667eea', r: 4 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ventes par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {loading ? <Loader2 size={24} className="animate-spin text-indigo-400" /> : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RTooltip contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: dark ? '#e2e8f0' : '#1f2937' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className={`text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune donnée</p>}
            </div>
            {!loading && pieData.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className={dark ? 'text-slate-300' : 'text-gray-600'}>{d.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Commandes récentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
              Voir tout <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 mb-2" />)
                : recentOrders.map(order => {
                    const name = `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || order.profiles?.email || 'Client';
                    return (
                      <div key={order.id} className={`flex items-center gap-3 py-2.5 border-b last:border-0 ${dark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{name[0]?.toUpperCase() || 'C'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{name}</p>
                          <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>#{order.order_number || order.id?.slice(0, 8)}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <p className="text-sm font-bold text-indigo-500">{FCFA(order.total_amount)}</p>
                          <Badge variant={order.status || 'default'}>
                            {STATUS_FR[order.status] || order.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Meilleurs produits</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/products')}>
              Voir tout <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 mb-2" />)
                : topProducts.length === 0
                  ? <p className={`text-sm text-center py-4 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune donnée</p>
                  : topProducts.map((product, idx) => (
                    <div key={product.id} className={`flex items-center gap-3 py-2.5 border-b last:border-0 ${dark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                      {product.image
                        ? <img src={product.image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                        : <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">{idx + 1}</div>}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{product.name}</p>
                        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{product.qty} vendus · {product.category}</p>
                      </div>
                      <p className="text-sm font-bold text-indigo-500 shrink-0">{FCFA(product.revenue)}</p>
                    </div>
                  ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
