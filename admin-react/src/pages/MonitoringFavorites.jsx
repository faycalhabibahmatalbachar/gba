import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Users, TrendingUp, Star, Trash2, Eye, X, BarChart2 } from 'lucide-react';
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
      <p className={`text-3xl font-extrabold truncate max-w-[140px] ${dark ? 'text-white' : 'text-gray-800'}`}>{value}</p>
      <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p>
      {trend && <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${trend.includes('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{trend}</span>}
    </div>
    <div className={`p-3 rounded-xl ${bg}`}><Icon size={22} className={color} /></div>
  </motion.div>
);

const ProductCard = ({ product, dark }) => (
  <motion.div whileHover={{ scale:1.01 }} transition={{ duration:0.2 }}
    className={`rounded-2xl border p-4 flex gap-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
    {product.image
      ? <img src={product.image} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
      : <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0" />}
    <div className="flex-1 min-w-0">
      <p className={`font-semibold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{product.name}</p>
      <div className="flex items-center gap-0.5 mt-1">
        {[1,2,3,4,5].map(s => <Star key={s} size={11} className={s <= Math.round(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />)}
        <span className="text-xs text-gray-400 ml-1">({product.reviews})</span>
      </div>
      <div className="flex gap-2 mt-2">
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-rose-200 text-rose-600">❤ {product.favorites} favoris</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">{product.category}</span>
      </div>
    </div>
    <p className="font-bold text-indigo-600 text-sm shrink-0">{product.price} FCFA</p>
  </motion.div>
);

function MonitoringFavorites() {
  const { dark } = useDark();
  const [tabValue, setTabValue] = useState(0);
  const [favoritesByUser, setFavoritesByUser] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFavorites: 0,
    activeUsers: 0,
    avgPerUser: 0,
    topCategory: '',
  });
  const [categoriesData, setCategoriesData] = useState(null);
  const [userEngagementData, setUserEngagementData] = useState(null);

  useEffect(() => {
    loadFavoritesData();
  }, []);

  const loadFavoritesData = async () => {
    setLoading(true);
    try {
      // Charger favoris avec produits (sans join profiles pour éviter FK manquante)
      const { data: favorites, error: favErr } = await supabase
        .from('favorites')
        .select('*, products(*, categories(id, name))')
        .order('created_at', { ascending: false });

      if (favErr) {
        console.error('[MonitoringFavorites] RLS/fetch error:', favErr);
        throw favErr;
      }

      // Fetch profiles séparément
      const userIds = [...new Set((favorites || []).map(f => f.user_id).filter(Boolean))];
      const profileMap = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url')
          .in('id', userIds);
        (profs || []).forEach(p => { profileMap[p.id] = p; });
      }

      // Grouper par utilisateur
      const userGroups = {};
      const productCounts = {};
      
      favorites?.forEach(fav => {
        // Grouper par utilisateur
        const userId = fav.user_id;
        if (!userGroups[userId]) {
          userGroups[userId] = {
            user: profileMap[userId] || null,
            favorites: [],
            count: 0,
          };
        }
        userGroups[userId].favorites.push(fav);
        userGroups[userId].count++;

        // Compter les produits
        const productId = fav.product_id;
        if (!productCounts[productId]) {
          productCounts[productId] = {
            product: fav.products,
            count: 0,
          };
        }
        productCounts[productId].count++;
      });

      // Top produits
      const sortedProducts = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Compute category distribution from real data
      const catCounts = {};
      favorites?.forEach(fav => {
        const cat = fav.products?.categories?.name || fav.products?.category_name || 'Autre';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });
      const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const topCat = catEntries[0]?.[0] || 'N/A';
      if (catEntries.length > 0) {
        setCategoriesData({
          labels: catEntries.map(([k]) => k),
          datasets: [{ data: catEntries.map(([, v]) => v), backgroundColor: ['#667eea','#764ba2','#f093fb','#30cfd0','#ffd93d','#6dd5ed'], borderWidth: 0 }],
        });
      }

      // User engagement (how many favorites each user has)
      const userCounts = Object.values(userGroups).map(u => u.count);
      const buckets = [0, 0, 0, 0, 0];
      userCounts.forEach(c => {
        if (c <= 5) buckets[0]++;
        else if (c <= 10) buckets[1]++;
        else if (c <= 20) buckets[2]++;
        else if (c <= 50) buckets[3]++;
        else buckets[4]++;
      });
      setUserEngagementData({
        labels: ['1-5', '6-10', '11-20', '21-50', '50+'],
        datasets: [{ label: 'Utilisateurs', data: buckets, backgroundColor: 'rgba(102,126,234,0.8)', borderColor: '#667eea', borderWidth: 2 }],
      });

      setFavoritesByUser(Object.values(userGroups));
      setTopProducts(sortedProducts);
      
      setStats({
        totalFavorites: favorites?.length || 0,
        activeUsers: Object.keys(userGroups).length,
        avgPerUser: Math.round((favorites?.length || 0) / Math.max(Object.keys(userGroups).length, 1)),
        topCategory: topCat,
      });
    } catch (error) {
      console.error('Erreur chargement favoris:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (userId, productId) => {
    try {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
      
      loadFavoritesData();
    } catch (error) {
      console.error('Erreur suppression favori:', error);
    }
  };

  const handleViewUserDetails = (user) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };


  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <motion.div initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }}>
          <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Monitoring Favoris</h1>
          <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Analyse et gestion des produits favoris des utilisateurs</p>
        </motion.div>
        <Button size="sm"><BarChart2 size={15} /> Exporter Analyse</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard dark={dark} title="Total Favoris" value={stats.totalFavorites} subtitle="Tous produits confondus" Icon={Heart} bg="bg-rose-50 dark:bg-rose-900/30" color="text-rose-500 dark:text-rose-400" trend="+18% ce mois" />
        <StatCard dark={dark} title="Utilisateurs Actifs" value={stats.activeUsers} subtitle="Avec des favoris" Icon={Users} bg="bg-indigo-50 dark:bg-indigo-900/30" color="text-indigo-600 dark:text-indigo-400" trend="+12% cette semaine" />
        <StatCard dark={dark} title="Moyenne/Utilisateur" value={stats.avgPerUser} subtitle="Favoris par personne" Icon={TrendingUp} bg="bg-purple-50 dark:bg-purple-900/30" color="text-purple-600 dark:text-purple-400" trend="+3 vs mois dernier" />
        <StatCard dark={dark} title="Catégorie Top" value={stats.topCategory || 'N/A'} subtitle="La plus aimée" Icon={Star} bg="bg-amber-50 dark:bg-amber-900/30" color="text-amber-500 dark:text-amber-400" trend="35% des favoris" />
      </div>

      <div className={`flex gap-1 p-1 rounded-xl w-fit ${dark ? 'bg-slate-800' : 'bg-gray-100'}`}>
        {['Top Produits', 'Par Utilisateur', 'Statistiques'].map((tab, i) => (
          <button key={i} onClick={() => setTabValue(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tabValue === i ? (dark ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (dark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')}`}>
            {tab}
          </button>
        ))}
      </div>

      {tabValue === 0 && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <h3 className={`text-sm font-bold ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Produits les Plus Aimés</h3>
            {topProducts.filter(item => item.product).map((item, i) => (
              <motion.div key={i} initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.08 }}>
                <ProductCard dark={dark} product={{
                  id: item.product?.id,
                  name: item.product?.name || 'Produit supprimé',
                  image: item.product?.main_image,
                  price: item.product?.price || 0,
                  rating: item.product?.rating || 0,
                  reviews: item.product?.reviews_count || 0,
                  favorites: item.count,
                  category: item.product?.category_name || 'Non catégorisé',
                }} />
              </motion.div>
            ))}
            {topProducts.length === 0 && <p className={`text-center py-8 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun favori</p>}
          </div>
          <Card className="w-full lg:w-72 shrink-0 p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Répartition par Catégorie</h3>
            <div style={{ height:260 }}>
              {categoriesData
                ? <Doughnut data={categoriesData} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }} />
                : <p className="text-center text-gray-400 py-10">Aucune donnée</p>}
            </div>
          </Card>
        </div>
      )}

      {tabValue === 1 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={dark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-50 border-b border-gray-100'}>
                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Utilisateur</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Email</th>
                <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Favoris</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase hidden lg:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Inscription</th>
                <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
              </tr></thead>
              <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-50'}>
                {favoritesByUser.map((ug, i) => (
                  <tr key={i} className={`transition-colors ${dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-rose-400 flex items-center justify-center text-white text-xs font-bold">
                          {(ug.user?.first_name || ug.user?.email || 'U')[0].toUpperCase()}
                        </div>
                        <span className={`font-medium ${dark ? 'text-slate-200' : 'text-gray-700'}`}>{`${ug.user?.first_name || ''} ${ug.user?.last_name || ''}`.trim() || 'Utilisateur'}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{ug.user?.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full">❤ {ug.count}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                      {ug.user?.created_at ? new Date(ug.user.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleViewUserDetails(ug)} className={`p-1.5 rounded-lg text-indigo-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`}><Eye size={14} /></button>
                        <button className={`p-1.5 rounded-lg text-red-500 ${dark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {favoritesByUser.length === 0 && <tr><td colSpan={5} className={`text-center py-10 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun favori</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tabValue === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Résumé des favoris</h3>
            <div className="space-y-3">
              {[
                { label:'Total favoris', value:stats.totalFavorites },
                { label:'Utilisateurs actifs', value:stats.activeUsers },
                { label:'Moyenne par utilisateur', value:stats.avgPerUser },
                { label:'Catégorie principale', value:stats.topCategory || 'N/A' },
              ].map((row, i) => (
                <div key={i} className={`flex justify-between py-2 border-b ${dark ? 'border-slate-700/50' : 'border-gray-50'}`}>
                  <span className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{row.label}</span>
                  <span className={`text-sm font-bold ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Distribution par Utilisateur</h3>
            <div style={{ height:280 }}>
              {userEngagementData
                ? <Bar data={userEngagementData} options={{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }} />
                : <p className="text-center text-gray-400 py-10">Aucune donnée</p>}
            </div>
          </Card>
        </div>
      )}

      {detailsOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center gap-3 px-5 py-4 border-b shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold">
                {(selectedUser.user?.first_name || selectedUser.user?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">{`${selectedUser.user?.first_name || ''} ${selectedUser.user?.last_name || ''}`.trim() || selectedUser.user?.email}</p>
                <p className="text-xs text-gray-500">{selectedUser.user?.email} · {selectedUser.count} favoris</p>
              </div>
              <button onClick={() => setDetailsOpen(false)} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-2">
              {selectedUser.favorites.map((fav, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                  {fav.products?.main_image
                    ? <img src={fav.products.main_image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{fav.products?.name}</p>
                    <p className="text-xs text-gray-400">{fav.products?.price} FCFA · {new Date(fav.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <button onClick={() => handleRemoveFavorite(fav.user_id, fav.product_id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0 ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <button className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium"><Trash2 size={14} /> Supprimer Tous</button>
              <Button variant="outline" size="sm" onClick={() => setDetailsOpen(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitoringFavorites;
