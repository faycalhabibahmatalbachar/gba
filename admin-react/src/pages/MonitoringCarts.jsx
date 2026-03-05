import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, TrendingUp, Trash2, Eye, Clock, X, AlertTriangle, BarChart2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useDark } from '../components/Layout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const StatCard = ({ title, value, subtitle, Icon, bg, color, trend, dark }) => (
  <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} whileHover={{ y:-4 }} transition={{ duration:0.3 }}
    className={`rounded-2xl border p-5 flex items-start justify-between ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
    <div>
      <p className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
      <p className={`text-3xl font-extrabold ${dark ? 'text-white' : 'text-gray-800'}`}>{value}</p>
      <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p>
      {trend && <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${trend.includes('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{trend}</span>}
    </div>
    <div className={`p-3 rounded-xl ${bg}`}><Icon size={22} className={color} /></div>
  </motion.div>
);

function MonitoringCarts() {
  const { dark } = useDark();
  const [tabValue, setTabValue] = useState(0);
  const [activeCarts, setActiveCarts] = useState([]);
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [selectedCart, setSelectedCart] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [popularProductsData, setPopularProductsData] = useState(null);
  const [cartValueData, setCartValueData] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    abandoned: 0,
    converted: 0,
    totalValue: 0,
    avgValue: 0,
  });

  useEffect(() => {
    loadCartsData();
  }, []);

  const loadCartsData = async () => {
    setLoading(true);
    try {
      // Charger les paniers actifs (sans join profiles pour éviter FK manquante)
      const { data: cartItems } = await supabase
        .from('cart_items')
        .select('*, products(*)')
        .order('created_at', { ascending: false });

      // Fetch profiles séparément
      const userIds = [...new Set((cartItems || []).map(i => i.user_id).filter(Boolean))];
      const profileMap = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, phone')
          .in('id', userIds);
        (profs || []).forEach(p => { profileMap[p.id] = p; });
      }

      // Grouper par utilisateur
      const cartsByUser = {};
      cartItems?.forEach(item => {
        const userId = item.user_id;
        if (!cartsByUser[userId]) {
          cartsByUser[userId] = {
            user: profileMap[userId] || null,
            items: [],
            total: 0,
            itemCount: 0,
            lastActivity: item.created_at,
          };
        }
        cartsByUser[userId].items.push(item);
        cartsByUser[userId].total += (item.products?.price || 0) * (item.quantity || 0);
        cartsByUser[userId].itemCount += item.quantity;
      });

      const activeCartsArray = Object.values(cartsByUser).filter(cart => {
        const hoursSinceActivity = (Date.now() - new Date(cart.lastActivity)) / (1000 * 60 * 60);
        return hoursSinceActivity < 24;
      });

      const abandonedCartsArray = Object.values(cartsByUser).filter(cart => {
        const hoursSinceActivity = (Date.now() - new Date(cart.lastActivity)) / (1000 * 60 * 60);
        return hoursSinceActivity >= 24;
      });

      // Compute popular products from real data
      const productCounts = {};
      cartItems?.forEach(item => {
        const name = item.products?.name || 'Produit';
        productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
      });
      const sortedProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (sortedProducts.length > 0) {
        setPopularProductsData({
          labels: sortedProducts.map(([k]) => k),
          datasets: [{ data: sortedProducts.map(([, v]) => v), backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#30cfd0', '#ffd93d'] }],
        });
      }

      // Cart value distribution
      const allCarts = Object.values(cartsByUser);
      const totalValue = allCarts.reduce((s, c) => s + c.total, 0);
      const buckets = [0, 0, 0, 0, 0];
      allCarts.forEach(c => {
        if (c.total < 5000) buckets[0]++;
        else if (c.total < 20000) buckets[1]++;
        else if (c.total < 50000) buckets[2]++;
        else if (c.total < 200000) buckets[3]++;
        else buckets[4]++;
      });
      setCartValueData({
        labels: ['<5k', '5k-20k', '20k-50k', '50k-200k', '200k+'],
        datasets: [{ label: 'Paniers', data: buckets, backgroundColor: 'rgba(118, 75, 162, 0.8)' }],
      });

      setActiveCarts(activeCartsArray);
      setAbandonedCarts(abandonedCartsArray);
      setStats({
        total: allCarts.length,
        active: activeCartsArray.length,
        abandoned: abandonedCartsArray.length,
        converted: Math.floor(activeCartsArray.length * 0.3),
        totalValue,
        avgValue: allCarts.length > 0 ? Math.round(totalValue / allCarts.length) : 0,
      });
    } catch (error) {
      console.error('Erreur chargement paniers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCart = async (userId) => {
    try {
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId);
      
      loadCartsData();
    } catch (error) {
      console.error('Erreur suppression panier:', error);
    }
  };

  const handleViewDetails = (cart) => {
    setSelectedCart(cart);
    setDetailsOpen(true);
  };


  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <motion.div initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }}>
          <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Monitoring Paniers</h1>
          <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Surveillance et gestion des paniers clients en temps réel</p>
        </motion.div>
        <Button size="sm"><BarChart2 size={15} /> Exporter Rapport</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard dark={dark} title="Total Paniers" value={stats.total} subtitle="Tous les paniers" Icon={ShoppingCart} bg="bg-indigo-50 dark:bg-indigo-900/30" color="text-indigo-600 dark:text-indigo-400" trend="+12% ce mois" />
        <StatCard dark={dark} title="Paniers Actifs" value={stats.active} subtitle="Dernières 24h" Icon={ShoppingCart} bg="bg-green-50 dark:bg-green-900/30" color="text-green-600 dark:text-green-400" trend="+8% aujourd'hui" />
        <StatCard dark={dark} title="Abandonnés" value={stats.abandoned} subtitle="Plus de 24h" Icon={AlertTriangle} bg="bg-red-50 dark:bg-red-900/30" color="text-red-500 dark:text-red-400" trend="-5% ce mois" />
        <StatCard dark={dark} title="Taux Conversion" value="32%" subtitle="Ce mois" Icon={TrendingUp} bg="bg-purple-50 dark:bg-purple-900/30" color="text-purple-600 dark:text-purple-400" trend="+3% vs mois dernier" />
      </div>

      <div className={`flex gap-1 p-1 rounded-xl w-fit ${dark ? 'bg-slate-800' : 'bg-gray-100'}`}>
        {['Paniers Actifs', 'Paniers Abandonnés', 'Statistiques'].map((tab, i) => (
          <button key={i} onClick={() => setTabValue(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tabValue === i ? (dark ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (dark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')}`}>
            {tab}
          </button>
        ))}
      </div>

      {tabValue === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeCarts.map((cart, i) => (
            <motion.div key={i} initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} transition={{ delay:i*0.08 }}
              className={`rounded-2xl border p-5 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
                    {(cart.user?.full_name || cart.user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className={`font-semibold ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{cart.user?.full_name || cart.user?.email || 'Utilisateur'}</p>
                    <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{cart.user?.email}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[11px] font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{cart.itemCount} articles</span>
                      <span className="text-[11px] font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{cart.total.toFixed(0)} FCFA</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleViewDetails(cart)} className={`p-1.5 rounded-lg text-indigo-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`}><Eye size={15} /></button>
                  <button onClick={() => handleClearCart(cart.user?.id)} className={`p-1.5 rounded-lg text-red-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className={`border-t mt-3 pt-3 flex items-center justify-between ${dark ? 'border-slate-700' : 'border-gray-50'}`}>
                <span className={`flex items-center gap-1 text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}><Clock size={12} /> Dernière activité: il y a 2h</span>
                <button className="text-xs px-3 py-1 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50">Envoyer rappel</button>
              </div>
            </motion.div>
          ))}
          {activeCarts.length === 0 && <p className={`col-span-2 text-center py-10 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun panier actif</p>}
        </div>
      )}

      {tabValue === 1 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={dark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-50 border-b border-gray-100'}>
                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Client</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Email</th>
                <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Articles</th>
                <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Valeur</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Abandonné depuis</th>
                <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
              </tr></thead>
              <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-50'}>
                {abandonedCarts.map((cart, i) => {
                  const h = Math.round((Date.now() - new Date(cart.lastActivity)) / 3600000);
                  return (
                    <tr key={i} className={`transition-colors ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">{(cart.user?.full_name || 'U')[0]}</div>
                          <span className={`font-medium ${dark ? 'text-slate-200' : 'text-gray-700'}`}>{cart.user?.full_name || 'Utilisateur'}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{cart.user?.email}</td>
                      <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{cart.itemCount}</span></td>
                      <td className={`px-4 py-3 text-right font-bold ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{cart.total.toFixed(0)} FCFA</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{h < 48 ? `${h}h` : `${Math.round(h/24)}j`}</span></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="text-xs px-2 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Relancer</button>
                          <button onClick={() => handleClearCart(cart.user?.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {abandonedCarts.length === 0 && <tr><td colSpan={6} className={`text-center py-10 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun panier abandonné</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tabValue === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Produits Populaires dans les Paniers</h3>
            <div style={{ height:280 }}>
              {popularProductsData ? <Doughnut data={popularProductsData} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right' } } }} /> : <p className="text-center text-gray-400 py-10">Aucune donnée</p>}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Statistiques</h3>
            <div className="space-y-3">
              {[
                { label:'Valeur totale des paniers', value:`${stats.totalValue.toLocaleString('fr-FR')} FCFA` },
                { label:'Valeur moyenne par panier', value:`${stats.avgValue.toLocaleString('fr-FR')} FCFA` },
                { label:'Paniers actifs (24h)', value:stats.active },
                { label:'Paniers abandonnés', value:stats.abandoned },
              ].map((row, i) => (
                <div key={i} className={`flex justify-between py-2 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                  <span className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{row.label}</span>
                  <span className={`text-sm font-bold ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 md:col-span-2">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Distribution de la valeur des paniers</h3>
            <div style={{ height:280 }}>
              {cartValueData ? <Bar data={cartValueData} options={{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }} /> : <p className="text-center text-gray-400 py-10">Aucune donnée</p>}
            </div>
          </Card>
        </div>
      )}

      {detailsOpen && selectedCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Détails du Panier</h2>
              <button onClick={() => setDetailsOpen(false)} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-bold">
                  {(selectedCart.user?.full_name || selectedCart.user?.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{selectedCart.user?.full_name}</p>
                  <p className="text-sm text-gray-500">{selectedCart.user?.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                {selectedCart.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                    {item.products?.main_image
                      ? <img src={item.products.main_image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><ShoppingCart size={16} className="text-gray-400" /></div>}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{item.products?.name}</p>
                      <p className="text-xs text-gray-400">{item.quantity} × {item.products?.price} FCFA</p>
                    </div>
                    <p className="font-bold text-gray-700 text-sm">{(item.quantity * item.products?.price).toFixed(0)} FCFA</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="font-bold text-gray-700">Total</span>
                <span className="font-bold text-indigo-600">{selectedCart.total.toFixed(0)} FCFA</span>
              </div>
            </div>
            <div className={`px-5 py-4 border-t flex justify-end shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <Button variant="outline" size="sm" onClick={() => setDetailsOpen(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitoringCarts;
