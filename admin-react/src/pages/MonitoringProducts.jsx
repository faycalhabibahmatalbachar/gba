import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, TrendingUp, TrendingDown, AlertTriangle, Search, ShoppingCart, Heart, Eye, Star, Pencil, Trash2, Tag, LayoutGrid, BarChart2, Upload, MoreVertical, X, Loader2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import { Line, Bar, Scatter, PolarArea } from 'react-chartjs-2';
import { useDark } from '../components/Layout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const StatCard = ({ title, value, subtitle, Icon, bg, color, trend, alert: isAlert, dark }) => (
  <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} whileHover={{ y:-4 }} transition={{ duration:0.3 }}
    className={`rounded-2xl border p-4 flex items-start justify-between ${isAlert ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
    <div>
      <p className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
      <p className={`text-2xl font-extrabold truncate max-w-[120px] ${dark ? 'text-white' : 'text-gray-800'}`}>{value}</p>
      <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className={`p-2.5 rounded-xl ${bg} relative`}>
      <Icon size={18} className={color} />
      {isAlert && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">!</span>}
    </div>
  </motion.div>
);

const ProductRow = ({ product, index, onAction }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const stockColor = product.quantity <= 5 ? 'bg-red-100 text-red-600' : product.quantity <= 20 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  return (
    <motion.tr initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ delay:index*0.04 }} className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {product.main_image ? <img src={product.main_image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" /> : <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0" />}
          <div>
            <p className="font-medium text-gray-800 text-sm">{product.name}</p>
            <p className="text-xs text-gray-400">SKU: {product.id?.substring(0,8)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{product.category_name || 'N/A'}</span></td>
      <td className="px-4 py-3 text-right font-bold text-indigo-600 text-sm">{product.price} FCFA</td>
      <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stockColor}`}>{product.quantity}</span></td>
      <td className="px-4 py-3 text-center text-sm text-gray-600">{product.cart_count || 0}</td>
      <td className="px-4 py-3 text-center text-sm text-rose-500">{product.favorite_count || 0}</td>
      <td className="px-4 py-3 text-center text-sm text-gray-500">{product.views || 0}</td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-0.5">
          {[1,2,3,4,5].map(s => <Star key={s} size={10} className={s <= Math.round(product.rating||0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />)}
          <span className="text-[10px] text-gray-400 ml-1">({product.reviews||0})</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center relative">
        <button onClick={() => setMenuOpen(m => !m)} className="p-1.5 hover:bg-gray-100 rounded-lg"><MoreVertical size={14} className="text-gray-500" /></button>
        {menuOpen && (
          <div className="absolute right-8 top-2 z-10 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-36">
            <button onClick={() => { onAction('edit', product); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Pencil size={13} /> Modifier</button>
            <button onClick={() => { onAction('stock', product); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Package size={13} /> Gérer Stock</button>
            <button onClick={() => { onAction('promo', product); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Tag size={13} /> Promotion</button>
            <button onClick={() => { onAction('delete', product); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"><Trash2 size={13} /> Supprimer</button>
          </div>
        )}
      </td>
    </motion.tr>
  );
};

function MonitoringProducts() {
  const { dark } = useDark();
  const [tabValue, setTabValue] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null });
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    avgPrice: 0,
    totalValue: 0,
    outOfStock: 0,
    topCategory: '',
  });

  useEffect(() => {
    loadProductsData();
  }, []);

  const loadProductsData = async () => {
    setLoading(true);
    try {
      // Charger tous les produits avec relations
      const { data: products } = await supabase
        .from('products')
        .select(`
          *,
          categories (name),
          cart_items (quantity),
          favorites (id)
        `)
        .order('created_at', { ascending: false });

      // Calculer statistiques
      const processedProducts = products?.map(p => ({
        ...p,
        category_name: p.categories?.name,
        cart_count: p.cart_items?.reduce((acc, item) => acc + item.quantity, 0) || 0,
        favorite_count: p.favorites?.length || 0,
      })) || [];

      const lowStockCount = processedProducts.filter(p => p.quantity <= 20 && p.quantity > 0).length;
      const outOfStockCount = processedProducts.filter(p => p.quantity === 0).length;
      const avgPrice = processedProducts.reduce((acc, p) => acc + parseFloat(p.price || 0), 0) / Math.max(processedProducts.length, 1);
      const totalValue = processedProducts.reduce((acc, p) => acc + (parseFloat(p.price || 0) * (p.quantity || 0)), 0);

      // Real top category
      const catCounts = {};
      processedProducts.forEach(p => { const c = p.categories?.name || 'Autre'; catCounts[c] = (catCounts[c] || 0) + 1; });
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      setProducts(processedProducts);
      setStats({
        totalProducts: processedProducts.length,
        lowStock: lowStockCount,
        avgPrice: Math.round(avgPrice),
        totalValue: Math.round(totalValue),
        outOfStock: outOfStockCount,
        topCategory: topCat,
      });
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductAction = (action, product) => {
    setSelectedProduct(product);
    setActionDialog({ open: true, type: action });
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Real: top 10 products by cart count
  const top10 = [...products].sort((a, b) => (b.cart_count || 0) - (a.cart_count || 0)).slice(0, 10);
  const performanceData = {
    labels: top10.map(p => (p.name || '').slice(0, 18)),
    datasets: [
      {
        label: 'Dans les paniers',
        data: top10.map(p => p.cart_count || 0),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        tension: 0.4,
      },
      {
        label: 'Favoris',
        data: top10.map(p => p.favorite_count || 0),
        borderColor: '#e91e63',
        backgroundColor: 'rgba(233, 30, 99, 0.5)',
        tension: 0.4,
      },
    ],
  };

  // Real: category distribution by product count
  const catMap = {};
  products.forEach(p => { const c = p.categories?.name || 'Autre'; catMap[c] = (catMap[c] || 0) + 1; });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catColors = ['rgba(102,126,234,0.8)','rgba(118,75,162,0.8)','rgba(240,147,251,0.8)','rgba(48,207,208,0.8)','rgba(255,217,61,0.8)','rgba(233,30,99,0.8)'];
  const categoryPerformance = {
    labels: catEntries.map(([k]) => k),
    datasets: [{ label: 'Produits', data: catEntries.map(([,v]) => v), backgroundColor: catColors }],
  };

  const stockDistribution = {
    datasets: [{
      label: 'Stock vs Prix',
      data: products.map(p => ({
        x: parseFloat(p.price),
        y: p.quantity,
        r: Math.sqrt(p.favorite_count) * 3,
      })),
      backgroundColor: 'rgba(233, 30, 99, 0.6)',
    }],
  };

  const inp = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-gray-200'}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <motion.div initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }}>
          <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Monitoring Produits</h1>
          <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Analyse complète et gestion de votre catalogue produits</p>
        </motion.div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Upload size={14} /> Import CSV</Button>
          <Button size="sm"><BarChart2 size={15} /> Rapport Détaillé</Button>
        </div>
      </div>

      {stats.outOfStock > 0 && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm ${dark ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <span className={dark ? 'text-amber-300' : 'text-amber-800'}><strong>{stats.outOfStock} produits en rupture de stock!</strong> Action immédiate requise.</span>
          <button className="ml-auto text-xs font-medium text-amber-700 hover:underline">Voir produits</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard dark={dark} title="Total Produits" value={stats.totalProducts} subtitle="En catalogue" Icon={Package} bg="bg-indigo-50 dark:bg-indigo-900/30" color="text-indigo-600 dark:text-indigo-400" trend={12} />
        <StatCard dark={dark} title="Stock Faible" value={stats.lowStock} subtitle="< 20 unités" Icon={AlertTriangle} bg="bg-amber-50 dark:bg-amber-900/30" color="text-amber-500 dark:text-amber-400" alert={stats.lowStock > 10} />
        <StatCard dark={dark} title="Rupture Stock" value={stats.outOfStock} subtitle="À réappro." Icon={AlertTriangle} bg="bg-red-50 dark:bg-red-900/30" color="text-red-500 dark:text-red-400" alert={stats.outOfStock > 0} />
        <StatCard dark={dark} title="Prix Moyen" value={`${stats.avgPrice} F`} subtitle="Tous produits" Icon={Tag} bg="bg-green-50 dark:bg-green-900/30" color="text-green-600 dark:text-green-400" trend={-3} />
        <StatCard dark={dark} title="Valeur Stock" value={`${(stats.totalValue/1000).toFixed(0)}k`} subtitle="Total inventaire" Icon={TrendingUp} bg="bg-purple-50 dark:bg-purple-900/30" color="text-purple-600 dark:text-purple-400" trend={18} />
        <StatCard dark={dark} title="Top Catégorie" value={stats.topCategory} subtitle="Plus vendue" Icon={LayoutGrid} bg="bg-cyan-50 dark:bg-cyan-900/30" color="text-cyan-600 dark:text-cyan-400" trend={25} />
      </div>

      <div className={`flex gap-1 p-1 rounded-xl w-fit ${dark ? 'bg-slate-800' : 'bg-gray-100'}`}>
        {['Inventaire', 'Performance', 'Analyse'].map((tab, i) => (
          <button key={i} onClick={() => setTabValue(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tabValue === i ? (dark ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (dark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')}`}>
            {tab}
          </button>
        ))}
      </div>

      {tabValue === 0 && (
        <div>
          <Card className="p-3 mb-3 flex gap-3">
            <div className="relative flex-1">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher un produit..." className="pl-9" />
            </div>
          </Card>
          {loading
            ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
            : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className={dark ? 'bg-slate-800/80 border-b border-slate-700' : 'bg-gray-50 border-b border-gray-100'}>
                      <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Produit</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold uppercase hidden md:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Catégorie</th>
                      <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Prix</th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Stock</th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold uppercase hidden lg:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Paniers</th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold uppercase hidden lg:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Favoris</th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold uppercase hidden xl:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Vues</th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold uppercase hidden xl:table-cell ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Note</th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
                    </tr></thead>
                    <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y divide-gray-50'}>
                      {filteredProducts.slice(0, 25).map((product, index) => (
                        <ProductRow key={product.id} product={product} index={index} onAction={handleProductAction} />
                      ))}
                      {filteredProducts.length === 0 && <tr><td colSpan={9} className={`text-center py-10 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun produit</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
        </div>
      )}

      {tabValue === 1 && (
        <div className="flex flex-col lg:flex-row gap-4">
          <Card className="flex-1 p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Performance Paniers &amp; Favoris (Top 10)</h3>
            <div style={{ height:360 }}>
              <Bar data={performanceData} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } } }} />
            </div>
          </Card>
          <Card className="w-full lg:w-72 shrink-0 p-5">
            <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Répartition par Catégorie</h3>
            <div style={{ height:360 }}>
              <PolarArea data={categoryPerformance} options={{ responsive:true, maintainAspectRatio:false }} />
            </div>
          </Card>
        </div>
      )}

      {tabValue === 2 && (
        <Card className="p-5">
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Analyse Stock vs Prix (taille = popularité)</h3>
          <div style={{ height:460 }}>
            <Scatter data={stockDistribution} options={{ responsive:true, maintainAspectRatio:false,
              scales:{ x:{ title:{ display:true, text:'Prix (FCFA)' } }, y:{ title:{ display:true, text:'Quantité en stock' } } },
              plugins:{ tooltip:{ callbacks:{ label:(ctx) => { const p = products[ctx.dataIndex]; return [`${p.name}`,`Prix: ${p.price} FCFA`,`Stock: ${p.quantity}`,`Favoris: ${p.favorite_count}`]; } } } },
            }} />
          </div>
        </Card>
      )}

      {actionDialog.open && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>
                {actionDialog.type === 'edit' && 'Modifier le produit'}
                {actionDialog.type === 'stock' && 'Gérer le stock'}
                {actionDialog.type === 'promo' && 'Créer une promotion'}
                {actionDialog.type === 'delete' && 'Supprimer le produit'}
              </h2>
              <button onClick={() => setActionDialog({ open:false, type:null })} className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                {selectedProduct.main_image
                  ? <img src={selectedProduct.main_image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  : <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0" />}
                <div>
                  <p className="font-semibold text-gray-800">{selectedProduct.name}</p>
                  <p className="text-sm text-gray-500">{selectedProduct.category_name} · {selectedProduct.price} FCFA</p>
                </div>
              </div>
              {actionDialog.type === 'stock' && (
                <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Nouvelle quantité</label>
                  <input type="number" defaultValue={selectedProduct.quantity} className={inp} /></div>
              )}
              {actionDialog.type === 'promo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Réduction (%)</label><input type="number" className={inp} /></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date fin</label><input type="date" className={inp} /></div>
                </div>
              )}
              {actionDialog.type === 'delete' && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" /> Cette action est irréversible. Le produit sera définitivement supprimé.
                </div>
              )}
            </div>
            <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
              <Button variant="outline" size="sm" onClick={() => setActionDialog({ open:false, type:null })}>Annuler</Button>
              <Button size="sm" variant={actionDialog.type === 'delete' ? 'destructive' : 'default'}>Confirmer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitoringProducts;
