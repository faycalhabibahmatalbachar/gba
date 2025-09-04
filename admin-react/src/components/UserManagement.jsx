import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { 
  FaUser, FaClock, FaChartLine, FaShoppingCart, 
  FaHeart, FaStar, FaCoins, FaMapMarkerAlt,
  FaEnvelope, FaPhone, FaCalendar, FaBan,
  FaCheckCircle, FaExclamationTriangle, FaSearch,
  FaFilter, FaDownload, FaSync, FaEye
} from 'react-icons/fa';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivities, setUserActivities] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [realTimeStats, setRealTimeStats] = useState({
    activeUsers: 0,
    newToday: 0,
    totalUsers: 0
  });

  useEffect(() => {
    fetchUsers();
    fetchRealTimeStats();
    
    // Actualisation temps réel
    const interval = setInterval(() => {
      fetchRealTimeStats();
    }, 10000); // Toutes les 10 secondes

    // Subscription aux changements
    const subscription = supabase
      .channel('users_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        handleProfileChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_activities' },
        handleActivityChange
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const handleProfileChange = (payload) => {
    console.log('Profile change:', payload);
    fetchUsers();
  };

  const handleActivityChange = (payload) => {
    console.log('Activity change:', payload);
    if (selectedUser && payload.new?.user_id === selectedUser.id) {
      fetchUserActivities(selectedUser.id);
    }
    fetchRealTimeStats();
  };

  const fetchUsers = async () => {
    try {
      // Récupérer les profils avec leurs stats
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_stats (
            total_connections,
            connections_today,
            connections_this_month,
            last_login_at,
            last_activity_at,
            total_orders,
            total_spent,
            total_favorites,
            loyalty_points
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrichir avec le statut en ligne
      const enrichedUsers = profiles.map(user => ({
        ...user,
        stats: user.user_stats?.[0] || {},
        status: getOnlineStatus(user.user_stats?.[0]?.last_login_at)
      }));

      setUsers(enrichedUsers);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoading(false);
    }
  };

  const fetchRealTimeStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_real_time_metrics');
      if (error) throw error;
      
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setRealTimeStats({
        activeUsers: data[0]?.active_users_count || 0,
        newToday: data[0]?.new_users_today || 0,
        totalUsers: totalUsers || 0
      });
    } catch (error) {
      console.error('Error fetching real-time stats:', error);
    }
  };

  const fetchUserActivities = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setUserActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const getOnlineStatus = (lastLoginAt) => {
    if (!lastLoginAt) return 'inactive';
    const diff = new Date() - new Date(lastLoginAt);
    if (diff < 30 * 60 * 1000) return 'online'; // < 30 min
    if (diff < 24 * 60 * 60 * 1000) return 'recently'; // < 24h
    return 'inactive';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'online':
        return <span className="badge bg-success">En ligne</span>;
      case 'recently':
        return <span className="badge bg-warning">Récent</span>;
      default:
        return <span className="badge bg-secondary">Inactif</span>;
    }
  };

  const handleViewDetails = async (user) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
    await fetchUserActivities(user.id);
    
    // Log l'activité de consultation
    await supabase.from('user_activities').insert({
      user_id: user.id,
      activity_type: 'admin_view_profile',
      activity_details: { admin_id: 'current_admin_id' }
    });
  };

  const handleBlockUser = async (userId, currentlyBlocked) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !currentlyBlocked })
        .eq('id', userId);

      if (error) throw error;
      
      // Log l'activité
      await supabase.from('user_activities').insert({
        user_id: userId,
        activity_type: currentlyBlocked ? 'unblocked' : 'blocked',
        activity_details: { admin_id: 'current_admin_id' }
      });

      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const exportUserData = () => {
    const csvContent = users.map(user => ({
      Email: user.email,
      Nom: `${user.first_name} ${user.last_name}`,
      Inscrit: format(new Date(user.created_at), 'dd/MM/yyyy'),
      Connexions: user.stats.total_connections || 0,
      Commandes: user.stats.total_orders || 0,
      Dépensé: user.stats.total_spent || 0,
      Points: user.stats.loyalty_points || 0,
      Statut: user.status
    }));

    const csv = [
      Object.keys(csvContent[0]).join(','),
      ...csvContent.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const filteredUsers = users.filter(user => {
    const matchSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       user.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchFilter = filterStatus === 'all' || user.status === filterStatus;
    
    return matchSearch && matchFilter;
  });

  const getActivityIcon = (type) => {
    const icons = {
      'login': <FaCheckCircle className="text-success" />,
      'logout': <FaExclamationTriangle className="text-warning" />,
      'add_cart': <FaShoppingCart className="text-info" />,
      'add_favorite': <FaHeart className="text-danger" />,
      'remove_favorite': <FaHeart className="text-secondary" />,
      'purchase': <FaShoppingCart className="text-success" />,
      'view_product': <FaEye className="text-primary" />
    };
    return icons[type] || <FaChartLine />;
  };

  return (
    <div className="user-management">
      {/* Stats en temps réel */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="stat-card bg-primary text-white">
            <div className="stat-icon"><FaUser size={30} /></div>
            <div className="stat-content">
              <h3>{realTimeStats.totalUsers}</h3>
              <p>Total Utilisateurs</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card bg-success text-white">
            <div className="stat-icon"><FaCheckCircle size={30} /></div>
            <div className="stat-content">
              <h3>{realTimeStats.activeUsers}</h3>
              <p>Actuellement en ligne</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card bg-info text-white">
            <div className="stat-icon"><FaCalendar size={30} /></div>
            <div className="stat-content">
              <h3>{realTimeStats.newToday}</h3>
              <p>Nouveaux aujourd'hui</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="toolbar mb-3">
        <div className="row align-items-center">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text"><FaSearch /></span>
              <input
                type="text"
                className="form-control"
                placeholder="Rechercher un utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="online">En ligne</option>
              <option value="recently">Récemment actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <div className="col-md-5 text-end">
            <button className="btn btn-outline-primary me-2" onClick={fetchUsers}>
              <FaSync className="me-1" /> Actualiser
            </button>
            <button className="btn btn-outline-success" onClick={exportUserData}>
              <FaDownload className="me-1" /> Exporter CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table des utilisateurs */}
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Contact</th>
              <th>Membre depuis</th>
              <th>Dernière connexion</th>
              <th>Statistiques</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center">
                  <div className="spinner-border" role="status"></div>
                </td>
              </tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="d-flex align-items-center">
                    <img
                      src={user.avatar_url || '/default-avatar.png'}
                      alt={user.first_name}
                      className="rounded-circle me-2"
                      style={{ width: 40, height: 40, objectFit: 'cover' }}
                    />
                    <div>
                      <strong>{user.first_name} {user.last_name}</strong>
                      <br />
                      <small className="text-muted">{user.email}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div>
                    {user.phone && <div><FaPhone size={12} /> {user.phone}</div>}
                    {user.city && <div><FaMapMarkerAlt size={12} /> {user.city}</div>}
                  </div>
                </td>
                <td>
                  <small>{format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })}</small>
                </td>
                <td>
                  {user.stats.last_login_at ? (
                    <small>{formatDistanceToNow(new Date(user.stats.last_login_at), { 
                      addSuffix: true, 
                      locale: fr 
                    })}</small>
                  ) : (
                    <small className="text-muted">Jamais</small>
                  )}
                </td>
                <td>
                  <div className="stats-badges">
                    <span className="badge bg-light text-dark me-1">
                      <FaChartLine /> {user.stats.total_connections || 0} conn.
                    </span>
                    <span className="badge bg-light text-dark me-1">
                      <FaShoppingCart /> {user.stats.total_orders || 0} cmd.
                    </span>
                    <span className="badge bg-light text-dark me-1">
                      <FaHeart /> {user.stats.total_favorites || 0} fav.
                    </span>
                    <span className="badge bg-light text-dark">
                      <FaCoins /> {user.stats.loyalty_points || 0} pts
                    </span>
                  </div>
                </td>
                <td>{getStatusBadge(user.status)}</td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-primary me-1"
                    onClick={() => handleViewDetails(user)}
                  >
                    <FaEye />
                  </button>
                  <button
                    className={`btn btn-sm ${user.is_blocked ? 'btn-success' : 'btn-outline-danger'}`}
                    onClick={() => handleBlockUser(user.id, user.is_blocked)}
                  >
                    {user.is_blocked ? <FaCheckCircle /> : <FaBan />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal détails utilisateur */}
      {showDetailsModal && selectedUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Détails de {selectedUser.first_name} {selectedUser.last_name}
                </h5>
                <button
                  className="btn-close"
                  onClick={() => setShowDetailsModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <h6>Informations personnelles</h6>
                    <p><FaEnvelope /> {selectedUser.email}</p>
                    <p><FaPhone /> {selectedUser.phone || 'Non renseigné'}</p>
                    <p><FaMapMarkerAlt /> {selectedUser.address || 'Non renseignée'}</p>
                    <p><FaCalendar /> Né(e) le {selectedUser.date_of_birth || 'Non renseigné'}</p>
                  </div>
                  <div className="col-md-6">
                    <h6>Statistiques détaillées</h6>
                    <p>Connexions aujourd'hui: {selectedUser.stats.connections_today || 0}</p>
                    <p>Connexions ce mois: {selectedUser.stats.connections_this_month || 0}</p>
                    <p>Total dépensé: {selectedUser.stats.total_spent || 0}€</p>
                    <p>Points de fidélité: {selectedUser.stats.loyalty_points || 0}</p>
                  </div>
                </div>

                <h6>Historique des activités récentes</h6>
                <div className="activity-timeline" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {userActivities.map(activity => (
                    <div key={activity.id} className="activity-item d-flex align-items-center mb-2">
                      <span className="me-2">{getActivityIcon(activity.activity_type)}</span>
                      <div className="flex-grow-1">
                        <small className="d-block">
                          <strong>{activity.activity_type}</strong>
                          {activity.activity_details && (
                            <span className="text-muted ms-2">
                              {JSON.stringify(activity.activity_details)}
                            </span>
                          )}
                        </small>
                        <small className="text-muted">
                          {formatDistanceToNow(new Date(activity.created_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </small>
                      </div>
                    </div>
                  ))}
                  {userActivities.length === 0 && (
                    <p className="text-muted text-center">Aucune activité récente</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-management {
          padding: 20px;
        }
        
        .stat-card {
          padding: 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .stat-icon {
          margin-right: 20px;
        }
        
        .stat-content h3 {
          margin: 0;
          font-size: 2rem;
        }
        
        .stat-content p {
          margin: 0;
          opacity: 0.9;
        }
        
        .stats-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        
        .activity-item {
          padding: 10px;
          border-left: 3px solid #e0e0e0;
          transition: all 0.3s;
        }
        
        .activity-item:hover {
          border-left-color: #667eea;
          background: #f8f9fa;
        }
      `}</style>
    </div>
  );
};

export default UserManagement;
