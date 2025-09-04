import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FiUsers, FiShoppingCart, FiPackage, FiTrendingUp,
  FiSearch, FiFilter, FiDownload, FiEye, FiLock,
  FiUnlock, FiMail, FiPhone, FiCalendar, FiActivity,
  FiDollarSign, FiShoppingBag, FiHeart, FiDatabase,
  FiRefreshCw, FiX, FiCheck, FiAlertCircle, FiClock
} from 'react-icons/fi';
import {
  FaUser, FaClock, FaChartLine, FaShoppingCart, 
  FaHeart, FaStar, FaCoins, FaMapMarkerAlt,
  FaEnvelope, FaPhone, FaCalendar, FaBan,
  FaCheckCircle, FaExclamationTriangle, FaSearch,
  FaFilter, FaDownload, FaSync, FaEye,
  FaEdit, FaTrash, FaUserCog, FaDatabase,
  FaServer, FaGlobe, FaBell, FaLock
} from 'react-icons/fa';
import './UserManagementUltra.css';

const UserManagementUltra = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [userActivities, setUserActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [dbTables, setDbTables] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newUsersToday: 0,
    totalOrders: 0,
    totalRevenue: 0
  });
  const [realTimeStats, setRealTimeStats] = useState({
    activeUsers: 0,
    newToday: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0
  });

  useEffect(() => {
    fetchUsers();
    fetchRealTimeStats();
    fetchDatabaseTables();
    
    const interval = setInterval(() => {
      fetchRealTimeStats();
    }, 5000);

    const subscription = supabase
      .channel('admin_ultra_monitoring')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        handleProfileChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        handleOrderChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cart_items' },
        handleCartChange
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const handleProfileChange = (payload) => {
    console.log('🔄 Changement profil:', payload);
    fetchUsers();
    fetchRealTimeStats();
  };

  const handleOrderChange = (payload) => {
    console.log('🛒 Nouvelle commande:', payload);
    fetchRealTimeStats();
  };

  const handleCartChange = (payload) => {
    console.log('🛍️ Modification panier:', payload);
    if (selectedUser && payload.new?.user_id === selectedUser.id) {
      fetchUserDetails(selectedUser.id);
    }
  };

  const fetchDatabaseTables = async () => {
    try {
      const tables = [
        { table: 'profiles' },
        { table: 'orders' },
        { table: 'order_items' },
        { table: 'cart_items' },
        { table: 'favorites' },
        { table: 'products' },
        { table: 'categories' },
        { table: 'user_activities' },
        { table: 'user_connections' }
      ];
      
      const tableData = [];
      for (const table of tables) {
        const { count } = await supabase
          .from(table.table)
          .select('*', { count: 'exact', head: true });
        
        tableData.push({
          name: table.table,
          count: count || 0,
          icon: getTableIcon(table.table)
        });
      }
      
      setDbTables(tableData);
    } catch (error) {
      console.error('Erreur récupération tables:', error);
    }
  };

  const getTableIcon = (tableName) => {
    const icons = {
      'profiles': FaUser,
      'orders': FaShoppingCart,
      'products': FaDatabase,
      'categories': FaFilter,
      'favorites': FaHeart,
      'cart_items': FaShoppingCart,
      'user_activities': FaChartLine,
      'user_connections': FaGlobe
    };
    return icons[tableName] || FaDatabase;
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Récupération des utilisateurs...');
      
      // Récupérer tous les profils d'abord pour un affichage rapide
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('📊 Profiles récupérés:', profiles?.length || 0, 'utilisateurs');
      
      if (profileError) {
        console.error('❌ Erreur récupération profiles:', profileError);
        setUsers([]);
        return;
      }

      // Afficher les utilisateurs immédiatement avec des données de base
      const basicUsers = (profiles || []).map(profile => ({
        ...profile,
        email: profile.email || `user_${profile.id.substring(0, 8)}@gba.com`,
        created_at: profile.created_at || new Date().toISOString(),
        last_sign_in: profile.last_sign_in || null,
        orders_count: 0,
        cart_count: 0,
        favorites_count: 0,
        logs_count: 0,
        status: profile.is_active ? 'active' : 'inactive',
        avatar_display: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(
          (profile.first_name || '') + ' ' + (profile.last_name || '') || 'User'
        )}&background=667eea&color=fff`
      }));
      
      setUsers(basicUsers);
      setLoading(false); // Arrêter le loading immédiatement
      
      // Récupérer les statistiques en parallèle de manière optimisée
      const userIds = profiles?.map(p => p.id) || [];
      
      // Récupérer toutes les statistiques en une seule requête par table
      const [ordersData, cartData, favoritesData] = await Promise.all([
        supabase
          .from('orders')
          .select('user_id')
          .in('user_id', userIds),
        supabase
          .from('cart_items')
          .select('user_id')
          .in('user_id', userIds),
        supabase
          .from('favorites')
          .select('user_id')
          .in('user_id', userIds)
      ]);

      // Compter les occurrences pour chaque utilisateur
      const ordersCounts = {};
      const cartCounts = {};
      const favoritesCounts = {};
      
      (ordersData.data || []).forEach(item => {
        ordersCounts[item.user_id] = (ordersCounts[item.user_id] || 0) + 1;
      });
      
      (cartData.data || []).forEach(item => {
        cartCounts[item.user_id] = (cartCounts[item.user_id] || 0) + 1;
      });
      
      (favoritesData.data || []).forEach(item => {
        favoritesCounts[item.user_id] = (favoritesCounts[item.user_id] || 0) + 1;
      });

      // Mettre à jour les utilisateurs avec les statistiques
      const enrichedUsers = basicUsers.map(user => ({
        ...user,
        orders_count: ordersCounts[user.id] || 0,
        cart_count: cartCounts[user.id] || 0,
        favorites_count: favoritesCounts[user.id] || 0,
        // Préserver les champs importants
        email: user.email,
        phone: user.phone,
        address: user.address,
        date_of_birth: user.date_of_birth,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        avatar_display: user.avatar_display
      }));

      console.log('✅ Utilisateurs enrichis avec statistiques');
      setUsers(enrichedUsers);

      // Calcul des statistiques globales
      const globalStats = {
        totalUsers: enrichedUsers.length,
        activeUsers: enrichedUsers.filter(u => u.status === 'active').length,
        newUsersToday: enrichedUsers.filter(u => {
          const userDate = new Date(u.created_at);
          const today = new Date();
          return userDate.toDateString() === today.toDateString();
        }).length,
        totalOrders: Object.values(ordersCounts).reduce((sum, count) => sum + count, 0),
        totalRevenue: 0 // À calculer depuis les commandes si nécessaire
      };
      setStats(globalStats);
    } catch (error) {
      console.error('❌ Erreur générale récupération utilisateurs:', error);
      setUsers([]);
      setLoading(false);
    }
  }, []);

  const fetchRealTimeStats = async () => {
    try {
      // Total utilisateurs
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      // Nouveaux utilisateurs aujourd'hui - Corriger le format de date
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const startOfDay = `${year}-${month}-${day}T00:00:00.000Z`;
      
      const { count: newToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay);

      // ... Reste du code
      const { data: todayOrders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', startOfDay);

      if (!ordersError && todayOrders) {
        const totalRevenue = todayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        const avgOrderValue = todayOrders.length > 0 ? totalRevenue / todayOrders.length : 0;

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        let activeUsers = 0;
        try {
          const { count } = await supabase
            .from('user_activities')
            .select('user_id', { count: 'exact', head: true })
            .gte('created_at', thirtyMinutesAgo);
          activeUsers = count || 0;
        } catch (e) {
          // Table n'existe pas, ignorer
        }

        setRealTimeStats({
          totalUsers: totalUsers || 0,
          newToday: newToday || 0,
          activeUsers: activeUsers || 0,
          totalOrders: todayOrders?.length || 0,
          totalRevenue: totalRevenue.toFixed(2),
          avgOrderValue: avgOrderValue.toFixed(2)
        });
      }
    } catch (error) {
      console.error('Erreur fetch stats:', error);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const { data: activities } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data: cartItems } = await supabase
        .from('cart_items')
        .select('*, products(*)')
        .eq('user_id', userId);

      const { data: favorites } = await supabase
        .from('favorites')
        .select('*, products(*)')
        .eq('user_id', userId);

      setUserActivities(activities || []);
      
      setSelectedUser({
        ...selectedUser,
        orders: orders || [],
        cartItems: cartItems || [],
        favorites: favorites || []
      });
    } catch (error) {
      console.error('Erreur détails utilisateur:', error);
    }
  };

  const getOnlineStatus = (lastActivityAt) => {
    if (!lastActivityAt) return 'inactive';
    const diff = new Date() - new Date(lastActivityAt);
    if (diff < 5 * 60 * 1000) return 'online';
    if (diff < 30 * 60 * 1000) return 'recently';
    if (diff < 24 * 60 * 60 * 1000) return 'today';
    return 'inactive';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'online': { class: 'success', text: '🟢 En ligne' },
      'recently': { class: 'warning', text: '🟡 Récent' },
      'today': { class: 'info', text: '🔵 Aujourd\'hui' },
      'inactive': { class: 'secondary', text: '⚫ Inactif' },
      'blocked': { class: 'danger', text: '🚫 Bloqué' }
    };
    
    const badge = badges[status] || badges.inactive;
    return <span className={`badge bg-${badge.class}`}>{badge.text}</span>;
  };

  const handleViewDetails = async (user) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
    await fetchUserDetails(user.id);
  };

  const handleBlockUser = async (userId, currentlyBlocked) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_blocked: !currentlyBlocked,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      
      await supabase.from('user_activities').insert({
        user_id: userId,
        activity_type: currentlyBlocked ? 'unblocked' : 'blocked',
        activity_details: { 
          admin_action: true,
          timestamp: new Date().toISOString()
        }
      });

      fetchUsers();
    } catch (error) {
      console.error('Erreur blocage utilisateur:', error);
    }
  };

  const exportAllData = () => {
    const data = users.map(user => ({
      ID: user.id,
      Email: user.email,
      Prénom: user.first_name || '',
      Nom: user.last_name || '',
      Téléphone: user.phone || '',
      Ville: user.city || '',
      Adresse: user.address || '',
      'Date inscription': format(new Date(user.created_at), 'dd/MM/yyyy HH:mm'),
      'Dernière activité': user.lastActivity ? format(new Date(user.lastActivity), 'dd/MM/yyyy HH:mm') : 'Jamais',
      Commandes: user.ordersCount,
      'Total dépensé': user.totalSpent + '€',
      'Articles panier': user.cartItemsCount,
      Favoris: user.favoritesCount,
      Statut: user.status,
      Bloqué: user.is_blocked ? 'Oui' : 'Non'
    }));

    const csv = [
      Object.keys(data[0]).join(';'),
      ...data.map(row => Object.values(row).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_utilisateurs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    a.click();
  };

  // Calcul des utilisateurs filtrés
  const filteredUsers = users.filter(user => {
    const matchSearch = 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);
    
    const matchFilter = statusFilter === 'all' || user.status === statusFilter;
    return matchSearch && matchFilter;
  });

  const getActivityIcon = (type) => {
    const icons = {
      'login': '🔓',
      'logout': '🔒',
      'add_to_cart': '🛒',
      'remove_from_cart': '🗑️',
      'add_favorite': '❤️',
      'remove_favorite': '💔',
      'purchase': '💳',
      'view_product': '👁️',
      'update_profile': '✏️',
      'blocked': '🚫',
      'unblocked': '✅'
    };
    return icons[type] || '📌';
  };

  return (
    <div className="user-management-ultra">
      {/* En-tête avec statistiques */}
      <div className="stats-header">
        <div className="stat-card gradient-primary">
          <FaUser className="stat-icon" />
          <div className="stat-content">
            <h2>{realTimeStats.totalUsers}</h2>
            <p>Utilisateurs Total</p>
          </div>
        </div>
        
        <div className="stat-card gradient-success">
          <FaCheckCircle className="stat-icon" />
          <div className="stat-content">
            <h2>{realTimeStats.activeUsers}</h2>
            <p>En Ligne Maintenant</p>
          </div>
        </div>
        
        <div className="stat-card gradient-info">
          <FaCalendar className="stat-icon" />
          <div className="stat-content">
            <h2>{realTimeStats.newToday}</h2>
            <p>Nouveaux Aujourd'hui</p>
          </div>
        </div>
        
        <div className="stat-card gradient-warning">
          <FaShoppingCart className="stat-icon" />
          <div className="stat-content">
            <h2>{realTimeStats.totalOrders}</h2>
            <p>Commandes du Jour</p>
          </div>
        </div>
        
        <div className="stat-card gradient-danger">
          <FaCoins className="stat-icon" />
          <div className="stat-content">
            <h2>{realTimeStats.totalRevenue}€</h2>
            <p>Revenus du Jour</p>
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="toolbar">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous les statuts</option>
          <option value="online">🟢 En ligne</option>
          <option value="recently">🟡 Récemment actif</option>
          <option value="today">🔵 Aujourd'hui</option>
          <option value="inactive">⚫ Inactif</option>
          <option value="blocked">🚫 Bloqué</option>
        </select>

        <div className="toolbar-actions">
          <button className="btn-action" onClick={fetchUsers}>
            <FaSync /> Actualiser
          </button>
          <button className="btn-action btn-export" onClick={exportAllData}>
            <FaDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Vue Base de Données */}
      <div className="database-overview">
        <h3>📊 Vue d'ensemble de la Base de Données</h3>
        <div className="db-tables-grid">
          {dbTables.map(table => {
            const Icon = table.icon;
            return (
              <div key={table.name} className="db-table-card">
                <Icon className="table-icon" />
                <div className="table-info">
                  <h4>{table.name}</h4>
                  <p>{table.count} enregistrements</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table des utilisateurs */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Contact</th>
              <th>Inscription</th>
              <th>Activité</th>
              <th>Métriques</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="loading-cell">
                  <div className="spinner"></div>
                  Chargement des données...
                </td>
              </tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id} className={user.is_blocked ? 'blocked-user' : ''}>
                <td>
                  <div className="user-info">
                    <div className="user-avatar">
                      <img 
                        src={user.avatar_display}
                        alt="avatar"
                      />
                    </div>
                    <div className="user-details">
                      <strong>{user.email || 'Email non disponible'}</strong>
                      {(user.first_name || user.last_name) && (
                        <span className="user-email">
                          {user.first_name} {user.last_name}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    {user.phone && <div><FaPhone /> {user.phone}</div>}
                    {user.city && <div><FaMapMarkerAlt /> {user.city}</div>}
                  </div>
                </td>
                <td>
                  <div className="date-info">
                    <div title="Date d'inscription">
                      <FaCalendar className="inline-icon" />
                      {user.created_at ? format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
                    </div>
                    <div className="last-login" title="Dernière connexion">
                      <FaClock className="inline-icon" />
                      {user.last_sign_in_at ? 
                        formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true, locale: fr }) : 
                        'Jamais connecté'
                      }
                    </div>
                    {user.email_confirmed_at && (
                      <div className="email-verified" title="Email vérifié">
                        <FaCheckCircle className="inline-icon success" /> Email vérifié
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="activity-stats">
                    {user.logs_count > 0 && (
                      <div className="stat-item">
                        <FiActivity className="stat-icon" />
                        <span>{user.logs_count} activités</span>
                      </div>
                    )}
                    {user.orders_count > 0 && (
                      <div className="stat-item">
                        <FiShoppingBag className="stat-icon" />
                        <span>{user.orders_count} commandes</span>
                      </div>
                    )}
                    {user.cart_count > 0 && (
                      <div className="stat-item">
                        <FiShoppingCart className="stat-icon" />
                        <span>{user.cart_count} au panier</span>
                      </div>
                    )}
                    {user.favorites_count > 0 && (
                      <div className="stat-item">
                        <FiHeart className="stat-icon" />
                        <span>{user.favorites_count} favoris</span>
                      </div>
                    )}
                    {!user.logs_count && !user.orders_count && !user.cart_count && !user.favorites_count && (
                      <span className="no-activity">Aucune activité</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="metrics">
                    <div className="metric" title="Commandes">
                      <FiShoppingBag /> {user.orders_count || 0}
                    </div>
                    <div className="metric" title="Montant total">
                      <FiDollarSign /> {user.total_spent || 0}€
                    </div>
                    <div className="metric" title="Points de fidélité">
                      <FaCoins /> {user.loyalty_points || 0}
                    </div>
                    {user.membership_level && (
                      <div className="metric membership" title="Niveau">
                        <FaStar /> {user.membership_level}
                      </div>
                    )}
                  </div>
                </td>
                <td>{getStatusBadge(user.status)}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-icon btn-view"
                      onClick={() => handleViewDetails(user)}
                      title="Voir détails"
                    >
                      <FaEye />
                    </button>
                    <button
                      className={`btn-icon ${user.is_blocked ? 'btn-unblock' : 'btn-block'}`}
                      onClick={() => handleBlockUser(user.id, user.is_blocked)}
                      title={user.is_blocked ? 'Débloquer' : 'Bloquer'}
                    >
                      {user.is_blocked ? <FaCheckCircle /> : <FaBan />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal détails utilisateur */}
      {showDetailsModal && selectedUser && (
        <div className="modal-backdrop" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-ultra" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FaUserCog /> {selectedUser.first_name} {selectedUser.last_name}
              </h2>
              <button className="close-btn" onClick={() => setShowDetailsModal(false)}>✕</button>
            </div>

            <div className="modal-tabs">
              <button 
                className={activeTab === 'overview' ? 'active' : ''} 
                onClick={() => setActiveTab('overview')}
              >
                Vue d'ensemble
              </button>
              <button 
                className={activeTab === 'activities' ? 'active' : ''} 
                onClick={() => setActiveTab('activities')}
              >
                Activités
              </button>
              <button 
                className={activeTab === 'orders' ? 'active' : ''} 
                onClick={() => setActiveTab('orders')}
              >
                Commandes
              </button>
              <button 
                className={activeTab === 'cart' ? 'active' : ''} 
                onClick={() => setActiveTab('cart')}
              >
                Panier
              </button>
            </div>

            <div className="modal-content">
              {activeTab === 'overview' && (
                <div className="overview-grid">
                  <div className="info-section">
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <img 
                        src={selectedUser.avatar_display || selectedUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          (selectedUser.first_name || '') + ' ' + (selectedUser.last_name || '') || 'User'
                        )}&background=667eea&color=fff`}
                        alt="Profile"
                        style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          border: '3px solid #667eea',
                          cursor: 'pointer',
                          objectFit: 'cover'
                        }}
                        onClick={() => {
                          const imageUrl = selectedUser.avatar_display || selectedUser.avatar_url;
                          if (imageUrl) {
                            window.open(imageUrl, '_blank');
                          }
                        }}
                        title="Cliquez pour voir en grand"
                      />
                      {(selectedUser.avatar_display || selectedUser.avatar_url) && (
                        <div style={{ marginTop: '10px' }}>
                          <button 
                            onClick={() => window.open(selectedUser.avatar_display || selectedUser.avatar_url, '_blank')}
                            style={{
                              background: '#667eea',
                              color: 'white',
                              border: 'none',
                              padding: '5px 15px',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            <FaEye style={{ marginRight: '5px' }} />
                            Voir l'image
                          </button>
                        </div>
                      )}
                    </div>
                    <h3>Informations Personnelles</h3>
                    <div className="info-row">
                      <FaEnvelope /> {selectedUser.email}
                    </div>
                    <div className="info-row">
                      <FaPhone /> {selectedUser?.phone || 'Non renseigné'}
                    </div>
                    <div className="info-row">
                      <FaMapMarkerAlt /> {selectedUser?.address || 'Non renseignée'}
                    </div>
                    <div className="info-row">
                      <FaCalendar /> Né(e) le {selectedUser?.date_of_birth ? new Date(selectedUser.date_of_birth).toLocaleDateString('fr-FR') : 'Non renseigné'}
                    </div>
                  </div>
                  
                  <div className="info-section">
                    <h3>Statistiques Détaillées</h3>
                    <div className="stat-row">
                      <span>Total dépensé</span>
                      <strong>{selectedUser.totalSpent}€</strong>
                    </div>
                    <div className="stat-row">
                      <span>Commandes</span>
                      <strong>{selectedUser.ordersCount}</strong>
                    </div>
                    <div className="stat-row">
                      <span>Articles en favoris</span>
                      <strong>{selectedUser.favoritesCount}</strong>
                    </div>
                    <div className="stat-row">
                      <span>Articles dans le panier</span>
                      <strong>{selectedUser.cartItemsCount}</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'activities' && (
                <div className="activities-timeline">
                  {userActivities.length > 0 ? userActivities.map(activity => (
                    <div key={activity.id} className="activity-item">
                      <span className="activity-icon">{getActivityIcon(activity.activity_type)}</span>
                      <div className="activity-content">
                        <strong>{activity.activity_type}</strong>
                        <span className="activity-time">
                          {formatDistanceToNow(new Date(activity.created_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <p className="empty-state">Aucune activité enregistrée</p>
                  )}
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="orders-list">
                  {selectedUser.orders?.length > 0 ? selectedUser.orders.map(order => (
                    <div key={order.id} className="order-item">
                      <div className="order-header">
                        <span>Commande #{order.id.slice(0, 8)}</span>
                        <span>{order.total_amount}€</span>
                      </div>
                      <div className="order-date">
                        {format(new Date(order.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </div>
                    </div>
                  )) : (
                    <p className="empty-state">Aucune commande</p>
                  )}
                </div>
              )}

              {activeTab === 'cart' && (
                <div className="cart-items">
                  {selectedUser.cartItems?.length > 0 ? selectedUser.cartItems.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="item-info">
                        <strong>{item.products?.name}</strong>
                        <span>Quantité: {item.quantity}</span>
                      </div>
                      <span className="item-price">{item.products?.price}€</span>
                    </div>
                  )) : (
                    <p className="empty-state">Panier vide</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementUltra;
