import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { 
  FaShoppingCart, FaHeart, FaBox, FaUsers, 
  FaDollarSign, FaChartLine, FaExclamationTriangle,
  FaCheckCircle, FaClock, FaSync
} from 'react-icons/fa';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const RealTimeMonitoring = ({ type }) => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    let subscription;
    let interval;

    const setupMonitoring = async () => {
      await fetchData();
      
      // Configuration selon le type
      const config = getMonitoringConfig(type);
      
      // Subscription temps réel
      subscription = supabase
        .channel(`${type}_monitoring`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: config.table },
          handleDataChange
        )
        .subscribe();

      // Rafraîchissement périodique
      interval = setInterval(() => {
        fetchData();
      }, config.refreshInterval);
    };

    setupMonitoring();

    return () => {
      if (subscription) subscription.unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [type]);

  const getMonitoringConfig = (type) => {
    const configs = {
      favorites: {
        table: 'favorites',
        refreshInterval: 5000,
        title: 'Favoris',
        icon: FaHeart,
        color: '#e74c3c'
      },
      cart: {
        table: 'cart_items',
        refreshInterval: 3000,
        title: 'Paniers',
        icon: FaShoppingCart,
        color: '#3498db'
      },
      orders: {
        table: 'orders',
        refreshInterval: 10000,
        title: 'Commandes',
        icon: FaBox,
        color: '#2ecc71'
      },
      products: {
        table: 'products',
        refreshInterval: 30000,
        title: 'Produits',
        icon: FaBox,
        color: '#9b59b6'
      }
    };
    return configs[type] || configs.favorites;
  };

  const handleDataChange = (payload) => {
    console.log(`${type} change:`, payload);
    setLastUpdate(new Date());
    
    // Log l'activité
    logActivity(payload);
    
    // Rafraîchir les données
    fetchData();
  };

  const logActivity = async (payload) => {
    try {
      const activityType = `${type}_${payload.eventType}`;
      await supabase.from('user_activities').insert({
        user_id: payload.new?.user_id || payload.old?.user_id,
        activity_type: activityType,
        entity_id: payload.new?.id || payload.old?.id,
        entity_type: type,
        activity_details: {
          event: payload.eventType,
          data: payload.new || payload.old
        }
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const config = getMonitoringConfig(type);

    try {
      switch (type) {
        case 'favorites':
          await fetchFavorites();
          break;
        case 'cart':
          await fetchCartItems();
          break;
        case 'orders':
          await fetchOrders();
          break;
        case 'products':
          await fetchProducts();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${type} data:`, error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    // Récupérer les favoris avec les détails
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        *,
        products (name, price, main_image),
        profiles (email, first_name, last_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Statistiques
    const { count: totalFavorites } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true });

    const { data: todayFavorites } = await supabase
      .from('favorites')
      .select('*')
      .gte('created_at', new Date().toISOString().split('T')[0]);

    // Produits les plus favoris
    const { data: topProducts } = await supabase
      .from('favorites')
      .select('product_id, products(name)')
      .select('product_id')
      .limit(5);

    const productCounts = {};
    favorites?.forEach(fav => {
      const productId = fav.product_id;
      productCounts[productId] = (productCounts[productId] || 0) + 1;
    });

    setData(favorites || []);
    setStats({
      total: totalFavorites || 0,
      today: todayFavorites?.length || 0,
      topProducts: Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({
          id,
          name: favorites.find(f => f.product_id === id)?.products?.name,
          count
        })),
      recentActivity: favorites?.slice(0, 10) || []
    });

    // Préparer les données du graphique
    prepareChartData(favorites);
  };

  const fetchCartItems = async () => {
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        products (name, price, main_image),
        profiles (email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { count: totalItems } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true });

    const totalValue = cartItems?.reduce((sum, item) => 
      sum + (item.quantity * (item.products?.price || 0)), 0
    ) || 0;

    const { count: activeCarts } = await supabase
      .from('cart_items')
      .select('user_id', { count: 'exact', head: true });

    setData(cartItems || []);
    setStats({
      totalItems: totalItems || 0,
      totalValue: totalValue.toFixed(2),
      activeCarts: activeCarts || 0,
      averageCartValue: activeCarts ? (totalValue / activeCarts).toFixed(2) : 0,
      recentActivity: cartItems?.slice(0, 10) || []
    });
  };

  const fetchOrders = async () => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        profiles (email, first_name, last_name),
        order_items (
          quantity,
          unit_price,
          products (name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const { data: todayOrders } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', new Date().toISOString().split('T')[0]);

    const todayRevenue = todayOrders?.reduce((sum, order) => 
      sum + parseFloat(order.total_amount || 0), 0
    ) || 0;

    setData(orders || []);
    setStats({
      totalOrders: orders?.length || 0,
      todayOrders: todayOrders?.length || 0,
      todayRevenue: todayRevenue.toFixed(2),
      averageOrderValue: orders?.length ? 
        (orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) / orders.length).toFixed(2) : 0,
      recentOrders: orders?.slice(0, 10) || []
    });
  };

  const fetchProducts = async () => {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const lowStock = products?.filter(p => p.stock_quantity < 10) || [];
    const outOfStock = products?.filter(p => p.stock_quantity === 0) || [];

    setData(products || []);
    setStats({
      totalProducts: products?.length || 0,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      categories: [...new Set(products?.map(p => p.categories?.name))].length,
      lowStockProducts: lowStock,
      recentlyAdded: products?.slice(0, 5) || []
    });
  };

  const prepareChartData = (items) => {
    if (!items || items.length === 0) return;

    // Grouper par heure pour les dernières 24h
    const hourlyData = {};
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now - i * 60 * 60 * 1000);
      const hourKey = format(hour, 'HH:00');
      hourlyData[hourKey] = 0;
    }

    items.forEach(item => {
      const hour = format(new Date(item.created_at), 'HH:00');
      if (hourlyData[hour] !== undefined) {
        hourlyData[hour]++;
      }
    });

    setChartData({
      labels: Object.keys(hourlyData).reverse(),
      datasets: [{
        label: `${getMonitoringConfig(type).title} par heure`,
        data: Object.values(hourlyData).reverse(),
        borderColor: getMonitoringConfig(type).color,
        backgroundColor: `${getMonitoringConfig(type).color}20`,
        tension: 0.4
      }]
    });
  };

  const renderContent = () => {
    const config = getMonitoringConfig(type);
    const Icon = config.icon;

    if (loading) {
      return (
        <div className="text-center py-5">
          <div className="spinner-border" role="status"></div>
        </div>
      );
    }

    switch (type) {
      case 'favorites':
        return renderFavoritesContent();
      case 'cart':
        return renderCartContent();
      case 'orders':
        return renderOrdersContent();
      case 'products':
        return renderProductsContent();
      default:
        return null;
    }
  };

  const renderFavoritesContent = () => (
    <div>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stat-box">
            <FaHeart size={24} className="text-danger mb-2" />
            <h3>{stats.total}</h3>
            <p>Total Favoris</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaClock size={24} className="text-info mb-2" />
            <h3>{stats.today}</h3>
            <p>Ajoutés Aujourd'hui</p>
          </div>
        </div>
        <div className="col-md-6">
          <div className="stat-box">
            <h6>Top Produits Favoris</h6>
            {stats.topProducts?.map((product, idx) => (
              <div key={idx} className="d-flex justify-content-between small">
                <span>{product.name}</span>
                <span className="badge bg-danger">{product.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {chartData && (
        <div className="chart-container mb-4">
          <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
      )}

      <div className="recent-activity">
        <h5>Activité Récente</h5>
        <div className="activity-list">
          {stats.recentActivity?.map(item => (
            <div key={item.id} className="activity-item">
              <img
                src={item.profiles?.avatar_url || '/default-avatar.png'}
                alt=""
                className="avatar"
              />
              <div className="activity-details">
                <strong>{item.profiles?.first_name} {item.profiles?.last_name}</strong>
                <span className="text-muted"> a ajouté </span>
                <strong>{item.products?.name}</strong>
                <span className="text-muted"> aux favoris</span>
                <div className="activity-time">
                  {format(new Date(item.created_at), 'dd/MM à HH:mm', { locale: fr })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCartContent = () => (
    <div>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stat-box">
            <FaShoppingCart size={24} className="text-primary mb-2" />
            <h3>{stats.totalItems}</h3>
            <p>Articles en Panier</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaDollarSign size={24} className="text-success mb-2" />
            <h3>{stats.totalValue}€</h3>
            <p>Valeur Totale</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaUsers size={24} className="text-info mb-2" />
            <h3>{stats.activeCarts}</h3>
            <p>Paniers Actifs</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaChartLine size={24} className="text-warning mb-2" />
            <h3>{stats.averageCartValue}€</h3>
            <p>Panier Moyen</p>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h5>Paniers Récents</h5>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Produit</th>
                <th>Quantité</th>
                <th>Prix</th>
                <th>Ajouté</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentActivity?.map(item => (
                <tr key={item.id}>
                  <td>{item.profiles?.email}</td>
                  <td>{item.products?.name}</td>
                  <td>{item.quantity}</td>
                  <td>{(item.quantity * item.products?.price).toFixed(2)}€</td>
                  <td>{format(new Date(item.created_at), 'dd/MM HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderOrdersContent = () => (
    <div>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stat-box">
            <FaBox size={24} className="text-success mb-2" />
            <h3>{stats.todayOrders}</h3>
            <p>Commandes Aujourd'hui</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaDollarSign size={24} className="text-primary mb-2" />
            <h3>{stats.todayRevenue}€</h3>
            <p>Revenus Aujourd'hui</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaChartLine size={24} className="text-info mb-2" />
            <h3>{stats.averageOrderValue}€</h3>
            <p>Commande Moyenne</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaCheckCircle size={24} className="text-warning mb-2" />
            <h3>{stats.totalOrders}</h3>
            <p>Total Commandes</p>
          </div>
        </div>
      </div>

      <div className="recent-orders">
        <h5>Commandes Récentes</h5>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>N° Commande</th>
                <th>Client</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders?.map(order => (
                <tr key={order.id}>
                  <td>{order.id.slice(0, 8)}</td>
                  <td>{order.profiles?.first_name} {order.profiles?.last_name}</td>
                  <td>{order.total_amount}€</td>
                  <td>
                    <span className={`badge bg-${order.status === 'completed' ? 'success' : 'warning'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>{format(new Date(order.created_at), 'dd/MM HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderProductsContent = () => (
    <div>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stat-box">
            <FaBox size={24} className="text-primary mb-2" />
            <h3>{stats.totalProducts}</h3>
            <p>Total Produits</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaExclamationTriangle size={24} className="text-warning mb-2" />
            <h3>{stats.lowStock}</h3>
            <p>Stock Faible</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaExclamationTriangle size={24} className="text-danger mb-2" />
            <h3>{stats.outOfStock}</h3>
            <p>Rupture de Stock</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-box">
            <FaChartLine size={24} className="text-info mb-2" />
            <h3>{stats.categories}</h3>
            <p>Catégories</p>
          </div>
        </div>
      </div>

      {stats.lowStockProducts?.length > 0 && (
        <div className="alert alert-warning">
          <h6>Produits en Stock Faible</h6>
          <ul>
            {stats.lowStockProducts.slice(0, 5).map(product => (
              <li key={product.id}>
                {product.name} - Stock: {product.stock_quantity}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="real-time-monitoring">
      <div className="monitoring-header mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <h4>
            {getMonitoringConfig(type).icon && 
              React.createElement(getMonitoringConfig(type).icon, { className: 'me-2' })
            }
            Monitoring {getMonitoringConfig(type).title}
          </h4>
          <div className="d-flex align-items-center">
            <span className="text-muted me-3">
              <FaClock className="me-1" />
              Dernière MAJ: {format(lastUpdate, 'HH:mm:ss')}
            </span>
            <button className="btn btn-sm btn-outline-primary" onClick={fetchData}>
              <FaSync className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {renderContent()}

      <style jsx>{`
        .real-time-monitoring {
          padding: 20px;
          background: white;
          border-radius: 10px;
        }
        
        .stat-box {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          height: 100%;
        }
        
        .stat-box h3 {
          margin: 10px 0;
          font-size: 2rem;
          color: #2c3e50;
        }
        
        .stat-box p {
          margin: 0;
          color: #7f8c8d;
        }
        
        .chart-container {
          height: 300px;
        }
        
        .activity-item {
          display: flex;
          align-items: center;
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        
        .activity-item:hover {
          background: #f8f9fa;
        }
        
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          margin-right: 10px;
          object-fit: cover;
        }
        
        .activity-time {
          font-size: 0.85rem;
          color: #999;
          margin-top: 5px;
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RealTimeMonitoring;
