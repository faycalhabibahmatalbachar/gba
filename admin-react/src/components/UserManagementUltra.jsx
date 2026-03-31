import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Users, ShoppingBag, Heart, Search, Download,
  RefreshCw, Eye, Activity, Ban, CheckCircle,
  Phone, MapPin, Calendar, Clock, Mail, X,
  ShieldCheck, TrendingUp, UserPlus, Trash2,
  UserX, UserCheck, AlertTriangle
} from 'lucide-react';
import './UserManagementUltra.css';
import UserActivityModal from './UserActivityModal';

const FCFA = (val) => `${Number(val || 0).toLocaleString('fr-FR')} FCFA`;

const STATUS_FR = {
  pending: 'En attente',
  confirmed: 'Confirmee',
  processing: 'En traitement',
  shipped: 'Expediee',
  delivered: 'Livree',
  cancelled: 'Annulee',
};

const PAGE_SIZE = 20;

const UserManagementUltra = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('client');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [userActivities, setUserActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [realTimeStats, setRealTimeStats] = useState({
    activeUsers: 0,
    newToday: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Single-user edit / delete
  const [editUser, setEditUser] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Create user
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ first_name: '', last_name: '', email: '', password: '', phone: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    setPage(1);
    fetchUsers(1);
  }, [roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchUsers();
    fetchRealTimeStats();

    const interval = setInterval(fetchRealTimeStats, 15000);

    const subscription = supabase
      .channel('admin_ultra_monitoring')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => { fetchUsers(); fetchRealTimeStats(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchRealTimeStats()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUsers = useCallback(async (p = page) => {
    try {
      setLoading(true);
      const from = (p - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (roleFilter === 'client') {
        query = query.or('role.is.null,role.eq.client');
      } else if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      const { data: profiles, error: profileError, count } = await query;

      if (profileError) { setUsers([]); setLoading(false); return; }

      setTotalCount(count || 0);

      const basicUsers = (profiles || []).map(profile => ({
        ...profile,
        email: profile.email || `user_${profile.id.substring(0, 8)}@gba.com`,
        created_at: profile.created_at || new Date().toISOString(),
        orders_count: 0,
        cart_count: 0,
        favorites_count: 0,
        status: profile.is_blocked ? 'blocked' : (profile.is_active !== false ? 'active' : 'inactive'),
        avatar_display: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(
          (profile.first_name || '') + ' ' + (profile.last_name || '') || 'U'
        )}&background=667eea&color=fff&bold=true`
      }));

      setUsers(basicUsers);
      setLoading(false);

      const userIds = profiles?.map(p => p.id) || [];
      if (!userIds.length) return;

      const [ordersData, cartData, favoritesData, ordersAmountData] = await Promise.all([
        supabase.from('orders').select('user_id').in('user_id', userIds),
        supabase.from('cart_items').select('user_id').in('user_id', userIds),
        supabase.from('favorites').select('user_id').in('user_id', userIds),
        supabase.from('orders').select('user_id, total_amount').in('user_id', userIds),
      ]);

      const ordersCounts = {};
      const cartCounts = {};
      const favoritesCounts = {};
      const totalSpent = {};

      (ordersData.data || []).forEach(i => { ordersCounts[i.user_id] = (ordersCounts[i.user_id] || 0) + 1; });
      (cartData.data || []).forEach(i => { cartCounts[i.user_id] = (cartCounts[i.user_id] || 0) + 1; });
      (favoritesData.data || []).forEach(i => { favoritesCounts[i.user_id] = (favoritesCounts[i.user_id] || 0) + 1; });
      (ordersAmountData.data || []).forEach(i => { totalSpent[i.user_id] = (totalSpent[i.user_id] || 0) + (i.total_amount || 0); });

      const enrichedUsers = basicUsers.map(user => ({
        ...user,
        orders_count: ordersCounts[user.id] || 0,
        cart_count: cartCounts[user.id] || 0,
        favorites_count: favoritesCounts[user.id] || 0,
        total_spent: totalSpent[user.id] || 0,
      }));

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Erreur:', error);
      setUsers([]);
      setLoading(false);
    }
  }, [page, roleFilter]);

  const fetchRealTimeStats = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true });

      const today = new Date();
      const startOfDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00.000Z`;

      const { count: newToday } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfDay);

      const { data: todayOrders } = await supabase
        .from('orders').select('total_amount').gte('created_at', startOfDay);

      const totalRevenue = (todayOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0);

      let activeUsers = 0;
      try {
        const thirtyMin = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('user_activities').select('user_id', { count: 'exact', head: true }).gte('created_at', thirtyMin);
        activeUsers = count || 0;
      } catch (_) {}

      setRealTimeStats({
        totalUsers: totalUsers || 0,
        newToday: newToday || 0,
        activeUsers,
        totalOrders: todayOrders?.length || 0,
        totalRevenue,
      });
    } catch (_) {}
  };

  const fetchUserDetails = async (userId) => {
    try {
      const [activitiesRes, ordersRes, cartRes, favRes] = await Promise.all([
        supabase.from('user_activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('*, order_items(*)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('cart_items').select('*, products(*)').eq('user_id', userId),
        supabase.from('favorites').select('*, products(*)').eq('user_id', userId),
      ]);

      setUserActivities(activitiesRes.data || []);
      setSelectedUser(prev => ({
        ...prev,
        orders: ordersRes.data || [],
        cartItems: cartRes.data || [],
        favorites: favRes.data || [],
      }));
    } catch (_) {}
  };

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setActiveTab('overview');
    setShowDetailsModal(true);
    await fetchUserDetails(user.id);
  };

  const openCreateModal = () => {
    setCreateForm({ first_name: '', last_name: '', email: '', password: '', phone: '' });
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCreateUser = async () => {
    const { first_name, last_name, email, password, phone } = createForm;
    if (!email.trim() || !password.trim()) {
      setCreateError('Email et mot de passe obligatoires.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: { data: { first_name: first_name.trim(), last_name: last_name.trim(), role: 'client' } },
      });
      if (error) throw error;
      const userId = data?.user?.id;
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          first_name: first_name.trim() || null,
          last_name: last_name.trim() || null,
          email: email.trim(),
          phone: phone.trim() || null,
          role: 'client',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
      setShowCreateModal(false);
      await fetchUsers();
    } catch (e) {
      setCreateError(e.message || 'Erreur lors de la création du compte.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditUser({ ...user });
  };

  const saveEditUser = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      await supabase.from('profiles').update({
        first_name: editUser.first_name || null,
        last_name: editUser.last_name || null,
        phone: editUser.phone || null,
        email: editUser.email || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editUser.id);
      setEditUser(null);
      await fetchUsers();
    } catch (e) {
      console.error('Edit error:', e);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = (user) => {
    setDeleteTarget(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.rpc('delete_user_complete', {
        target_user_id: deleteTarget.id,
      });
      if (error) throw error;
      console.warn(`[AUDIT] User deleted: ${deleteTarget.id} (${deleteTarget.email}) by admin at ${new Date().toISOString()}`);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBlockUser = async (userId, currentlyBlocked) => {
    try {
      await supabase.from('profiles').update({
        is_blocked: !currentlyBlocked,
        updated_at: new Date().toISOString()
      }).eq('id', userId);
      fetchUsers();
    } catch (_) {}
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const bulkAction = async (action) => {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    setBulkLoading(true);
    try {
      if (action === 'delete') {
        for (const uid of ids) {
          const { error } = await supabase.rpc('delete_user_complete', { target_user_id: uid });
          if (error) console.error('Bulk delete error for', uid, error);
          else console.warn(`[AUDIT] Bulk delete: ${uid} at ${new Date().toISOString()}`);
        }
      } else if (action === 'suspend') {
        await supabase.from('profiles').update({ is_blocked: true, updated_at: new Date().toISOString() }).in('id', ids);
      } else if (action === 'unsuspend') {
        await supabase.from('profiles').update({ is_blocked: false, updated_at: new Date().toISOString() }).in('id', ids);
      }
      setSelectedIds(new Set());
      setConfirmDialog(null);
      await fetchUsers();
    } catch (e) {
      console.error('Bulk action error:', e);
    } finally {
      setBulkLoading(false);
    }
  };

  const exportAllData = () => {
    if (!users.length) return;
    const data = users.map(user => ({
      ID: user.id,
      Email: user.email,
      Prenom: user.first_name || '',
      Nom: user.last_name || '',
      Telephone: user.phone || '',
      Ville: user.city || '',
      'Date inscription': user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy HH:mm') : '',
      Commandes: user.orders_count || 0,
      'Total depense (FCFA)': user.total_spent || 0,
      Favoris: user.favorites_count || 0,
      Bloque: user.is_blocked ? 'Oui' : 'Non'
    }));
    const csv = [Object.keys(data[0]).join(';'), ...data.map(r => Object.values(r).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `utilisateurs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // filteredUsers must be declared before toggleSelectAll uses it
  const filteredUsers = users.filter(user => {
    const q = searchTerm.toLowerCase();
    const match = !q || [user.email, user.first_name, user.last_name, user.phone]
      .some(f => f?.toLowerCase().includes(q));
    const statusMatch = statusFilter === 'all' || user.status === statusFilter;
    return match && statusMatch;
  });

  const getActivityLabel = (type) => {
    const labels = {
      login: 'Connexion', logout: 'Deconnexion', add_to_cart: 'Ajout au panier',
      remove_from_cart: 'Retrait du panier', add_favorite: 'Ajout aux favoris',
      remove_favorite: 'Retrait des favoris', purchase: 'Achat', view_product: 'Consultation produit',
      update_profile: 'Mise a jour profil', blocked: 'Bloque', unblocked: 'Debloque',
    };
    return labels[type] || type;
  };

  return (
    <div className="umu-root">
      {/* Stats */}
      <div className="umu-stats">
        <div className="umu-stat umu-stat-purple">
          <Users size={22} />
          <div><span className="umu-stat-val">{realTimeStats.totalUsers}</span><span className="umu-stat-lbl">Utilisateurs</span></div>
        </div>
        <div className="umu-stat umu-stat-green">
          <Activity size={22} />
          <div><span className="umu-stat-val">{realTimeStats.activeUsers}</span><span className="umu-stat-lbl">En ligne</span></div>
        </div>
        <div className="umu-stat umu-stat-blue">
          <UserPlus size={22} />
          <div><span className="umu-stat-val">{realTimeStats.newToday}</span><span className="umu-stat-lbl">Nouveaux</span></div>
        </div>
        <div className="umu-stat umu-stat-orange">
          <ShoppingBag size={22} />
          <div><span className="umu-stat-val">{realTimeStats.totalOrders}</span><span className="umu-stat-lbl">Commandes</span></div>
        </div>
        <div className="umu-stat umu-stat-red">
          <TrendingUp size={22} />
          <div><span className="umu-stat-val">{FCFA(realTimeStats.totalRevenue)}</span><span className="umu-stat-lbl">Revenus du jour</span></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="umu-toolbar">
        <div className="umu-search">
          <Search size={16} className="umu-search-ico" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou telephone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="umu-filter">
          <option value="all">Tous les rôles</option>
          <option value="client">Clients</option>
          <option value="driver">Livreurs</option>
          <option value="admin">Admins</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="umu-filter">
          <option value="all">Tous statuts</option>
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
          <option value="blocked">Bloqué</option>
        </select>
        <button className="umu-btn" onClick={fetchUsers}><RefreshCw size={14} /> Actualiser</button>
        <button className="umu-btn umu-btn-green" onClick={exportAllData}><Download size={14} /> Export CSV</button>
        <button className="umu-btn" onClick={openCreateModal} style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', border:'none' }}><UserPlus size={14} /> Créer un compte</button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'#667eea', color:'#fff', padding:'10px 16px', borderRadius:10, marginBottom:10, flexWrap:'wrap' }}>
          <strong>{selectedIds.size} selectionne{selectedIds.size > 1 ? 's' : ''}</strong>
          <button
            onClick={() => setConfirmDialog({ action: 'suspend', label: 'Suspendre' })}
            disabled={bulkLoading}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', padding:'6px 14px', borderRadius:7, cursor:'pointer', fontWeight:600 }}
          >
            <UserX size={14} /> Suspendre
          </button>
          <button
            onClick={() => setConfirmDialog({ action: 'unsuspend', label: 'Reactiver' })}
            disabled={bulkLoading}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', padding:'6px 14px', borderRadius:7, cursor:'pointer', fontWeight:600 }}
          >
            <UserCheck size={14} /> Reactiver
          </button>
          <button
            onClick={() => setConfirmDialog({ action: 'delete', label: 'Supprimer' })}
            disabled={bulkLoading}
            style={{ display:'flex', alignItems:'center', gap:6, background:'#ef4444', border:'none', color:'#fff', padding:'6px 14px', borderRadius:7, cursor:'pointer', fontWeight:600 }}
          >
            <Trash2 size={14} /> Supprimer
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ marginLeft:'auto', background:'none', border:'none', color:'#fff', cursor:'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Count */}
      <div className="umu-count">{totalCount} utilisateur{totalCount !== 1 ? 's' : ''} — page {page}/{Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}</div>

      {/* Table */}
      <div className="umu-table-wrap">
        <table className="umu-table">
          <thead>
            <tr>
              <th style={{ width:36 }}>
                <input
                  type="checkbox"
                  checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                  onChange={toggleSelectAll}
                  style={{ cursor:'pointer', width:16, height:16 }}
                />
              </th>
              <th>Utilisateur</th>
              <th>Contact</th>
              <th>Inscription</th>
              <th>Commandes</th>
              <th>Total depense</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td style={{ paddingLeft:16 }}><div style={{ width:16, height:16, background:'#e2e8f0', borderRadius:3 }} /></td>
                  <td><div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:36, height:36, borderRadius:'50%', background:'#e2e8f0' }} /><div><div style={{ width:120, height:12, background:'#e2e8f0', borderRadius:4, marginBottom:4 }} /><div style={{ width:160, height:10, background:'#f1f5f9', borderRadius:4 }} /></div></div></td>
                  <td><div style={{ width:100, height:12, background:'#e2e8f0', borderRadius:4 }} /></td>
                  <td><div style={{ width:80, height:12, background:'#e2e8f0', borderRadius:4 }} /></td>
                  <td><div style={{ width:50, height:12, background:'#e2e8f0', borderRadius:4 }} /></td>
                  <td><div style={{ width:90, height:12, background:'#e2e8f0', borderRadius:4 }} /></td>
                  <td><div style={{ width:50, height:20, background:'#e2e8f0', borderRadius:10 }} /></td>
                  <td><div style={{ width:100, height:12, background:'#e2e8f0', borderRadius:4 }} /></td>
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="8" className="umu-empty">Aucun utilisateur trouve</td></tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id} className={user.is_blocked ? 'umu-blocked' : ''} style={selectedIds.has(user.id) ? { background:'#eef2ff' } : {}}>
                <td style={{ paddingLeft:16 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggleSelect(user.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ cursor:'pointer', width:16, height:16 }}
                  />
                </td>
                <td>
                  <div className="umu-user-cell">
                    <img src={user.avatar_display} alt="" className="umu-avatar" />
                    <div>
                      <div className="umu-user-name">{user.first_name || ''} {user.last_name || ''}</div>
                      <div className="umu-user-email">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {user.phone && <div className="umu-contact-row"><Phone size={12} /> {user.phone}</div>}
                  {user.city && <div className="umu-contact-row"><MapPin size={12} /> {user.city}</div>}
                  {!user.phone && !user.city && <span className="umu-muted">-</span>}
                </td>
                <td>
                  <div className="umu-date-cell">
                    <span>{user.created_at ? format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr }) : '-'}</span>
                    <span className="umu-muted">
                      {user.last_sign_in_at
                        ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true, locale: fr })
                        : 'Jamais connecte'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="umu-metric-pills">
                    <span className="umu-pill" title="Commandes"><ShoppingBag size={12} /> {user.orders_count}</span>
                    <span className="umu-pill" title="Panier"><span>🛒</span> {user.cart_count}</span>
                    <span className="umu-pill" title="Favoris"><Heart size={12} /> {user.favorites_count}</span>
                  </div>
                </td>
                <td><strong className="umu-amount">{FCFA(user.total_spent)}</strong></td>
                <td>
                  {user.is_blocked ? (
                    <span className="umu-badge umu-badge-red">Bloque</span>
                  ) : user.status === 'active' ? (
                    <span className="umu-badge umu-badge-green">Actif</span>
                  ) : (
                    <span className="umu-badge umu-badge-gray">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="umu-actions">
                    <button className="umu-act-btn umu-act-view" onClick={() => handleViewUser(user)} title="Voir details"><Eye size={14} /></button>
                    <button className="umu-act-btn umu-act-track" onClick={() => handleEditUser(user)} title="Modifier" style={{ background:'#e0f2fe', color:'#0284c7' }}>✏️</button>
                    <button className="umu-act-btn umu-act-track" onClick={() => navigate(`/user-tracking/${user.id}`)} title="Activite"><Activity size={14} /></button>
                    <button
                      className={`umu-act-btn ${user.is_blocked ? 'umu-act-unblock' : 'umu-act-block'}`}
                      onClick={() => handleBlockUser(user.id, user.is_blocked)}
                      title={user.is_blocked ? 'Debloquer' : 'Bloquer'}
                    >
                      {user.is_blocked ? <CheckCircle size={14} /> : <Ban size={14} />}
                    </button>
                    <button className="umu-act-btn" onClick={() => handleDeleteUser(user)} title="Supprimer" style={{ background:'#fee2e2', color:'#dc2626' }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {Math.ceil(totalCount / PAGE_SIZE) > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:12, marginBottom:12 }}>
          <button
            disabled={page <= 1}
            onClick={() => { setPage(p => p - 1); fetchUsers(page - 1); }}
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background: page <= 1 ? '#f8fafc' : '#fff', cursor: page <= 1 ? 'default' : 'pointer', fontWeight:600, color: page <= 1 ? '#cbd5e1' : '#334155' }}
          >← Précédent</button>
          {Array.from({ length: Math.min(5, Math.ceil(totalCount / PAGE_SIZE)) }, (_, i) => {
            const totalPages = Math.ceil(totalCount / PAGE_SIZE);
            let start = Math.max(1, page - 2);
            if (start + 4 > totalPages) start = Math.max(1, totalPages - 4);
            const p = start + i;
            if (p > totalPages) return null;
            return (
              <button key={p} onClick={() => { setPage(p); fetchUsers(p); }}
                style={{ width:34, height:34, borderRadius:8, border: p === page ? 'none' : '1px solid #e2e8f0',
                  background: p === page ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#fff',
                  color: p === page ? '#fff' : '#334155', fontWeight:700, cursor:'pointer', fontSize:13 }}
              >{p}</button>
            );
          })}
          <button
            disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
            onClick={() => { setPage(p => p + 1); fetchUsers(page + 1); }}
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background: page >= Math.ceil(totalCount / PAGE_SIZE) ? '#f8fafc' : '#fff', cursor: page >= Math.ceil(totalCount / PAGE_SIZE) ? 'default' : 'pointer', fontWeight:600, color: page >= Math.ceil(totalCount / PAGE_SIZE) ? '#cbd5e1' : '#334155' }}
          >Suivant →</button>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="umu-overlay" onClick={() => setConfirmDialog(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:360, maxWidth:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <AlertTriangle size={22} color={confirmDialog.action === 'delete' ? '#ef4444' : '#f59e0b'} />
              <strong style={{ fontSize:16 }}>{confirmDialog.label} {selectedIds.size} utilisateur{selectedIds.size > 1 ? 's' : ''}</strong>
            </div>
            <p style={{ color:'#64748b', marginBottom:20, fontSize:14 }}>
              {confirmDialog.action === 'delete'
                ? 'Cette action est irreversible. Les comptes seront definitivement supprimes.'
                : confirmDialog.action === 'suspend'
                ? 'Les utilisateurs selectionnes ne pourront plus acceder a l\'application.'
                : 'Les utilisateurs selectionnes pourront a nouveau acceder a l\'application.'}
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDialog(null)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer' }}>Annuler</button>
              <button
                onClick={() => bulkAction(confirmDialog.action)}
                disabled={bulkLoading}
                style={{ padding:'8px 18px', borderRadius:8, border:'none', background: confirmDialog.action === 'delete' ? '#ef4444' : '#667eea', color:'#fff', cursor:'pointer', fontWeight:600 }}
              >
                {bulkLoading ? 'En cours...' : confirmDialog.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Dialog ── */}
      {editUser && (
        <div className="umu-overlay" onClick={() => setEditUser(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:420, maxWidth:'95%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <strong style={{ fontSize:16 }}>✏️ Modifier le compte</strong>
              <button onClick={() => setEditUser(null)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18} /></button>
            </div>
            {[['Prénom','first_name'],['Nom','last_name'],['Email','email'],['Téléphone','phone']].map(([label, key]) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:4 }}>{label}</label>
                <input
                  type="text"
                  value={editUser[key] || ''}
                  onChange={e => setEditUser(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:14, boxSizing:'border-box' }}
                />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:18 }}>
              <button onClick={() => setEditUser(null)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer' }}>Annuler</button>
              <button
                onClick={saveEditUser}
                disabled={editSaving}
                style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', cursor:'pointer', fontWeight:600 }}
              >
                {editSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete User Confirm ── */}
      {deleteTarget && (
        <div className="umu-overlay" onClick={() => setDeleteTarget(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:360, maxWidth:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <AlertTriangle size={22} color="#ef4444" />
              <strong style={{ fontSize:16 }}>Supprimer ce compte ?</strong>
            </div>
            <p style={{ color:'#64748b', marginBottom:4, fontSize:14 }}>
              <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> — {deleteTarget.email}
            </p>
            <p style={{ color:'#ef4444', fontSize:13, marginBottom:20 }}>Cette action est irréversible.</p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer' }}>Annuler</button>
              <button
                onClick={confirmDeleteUser}
                disabled={deleteLoading}
                style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', cursor:'pointer', fontWeight:600 }}
              >
                {deleteLoading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Dialog ── */}
      {showCreateModal && (
        <div className="umu-overlay" onClick={() => setShowCreateModal(false)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:440, maxWidth:'95%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <strong style={{ fontSize:16 }}>Créer un compte client</strong>
              <button onClick={() => setShowCreateModal(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18} /></button>
            </div>
            {[['Prénom','first_name','text'],['Nom','last_name','text'],['Email','email','email'],['Mot de passe','password','password'],['Téléphone','phone','tel']].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:4 }}>{label}{(key==='email'||key==='password') ? ' *' : ''}</label>
                <input
                  type={type}
                  value={createForm[key]}
                  onChange={e => setCreateForm(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:14, boxSizing:'border-box' }}
                  placeholder={key==='password' ? 'Minimum 6 caractères' : ''}
                />
              </div>
            ))}
            {createError && <p style={{ color:'#ef4444', fontSize:13, marginBottom:12 }}>{createError}</p>}
            <p style={{ color:'#94a3b8', fontSize:12, marginBottom:16 }}>
              Un email de confirmation sera envoyé à l'utilisateur.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer' }}>Annuler</button>
              <button
                onClick={handleCreateUser}
                disabled={createLoading}
                style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', cursor:'pointer', fontWeight:600 }}
              >
                {createLoading ? 'Création...' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      <UserActivityModal open={showActivityModal} onClose={() => setShowActivityModal(false)} user={selectedUser} />

      {/* Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="umu-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="umu-modal" onClick={e => e.stopPropagation()}>
            <div className="umu-modal-head">
              <div className="umu-modal-head-left">
                <img
                  src={selectedUser.avatar_display || selectedUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((selectedUser.first_name || '') + ' ' + (selectedUser.last_name || '') || 'U')}&background=667eea&color=fff`}
                  alt="" className="umu-modal-avatar"
                />
                <div>
                  <h2>{selectedUser.first_name} {selectedUser.last_name}</h2>
                  <span>{selectedUser.email}</span>
                </div>
              </div>
              <button className="umu-modal-close" onClick={() => setShowDetailsModal(false)}><X size={20} /></button>
            </div>

            <div className="umu-modal-tabs">
              {['overview', 'activities', 'orders', 'cart'].map(tab => (
                <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                  {{overview: 'Apercu', activities: 'Activites', orders: 'Commandes', cart: 'Panier'}[tab]}
                </button>
              ))}
            </div>

            <div className="umu-modal-body">
              {activeTab === 'overview' && (
                <div className="umu-overview">
                  <div className="umu-info-card">
                    <h3>Informations</h3>
                    <div className="umu-info-row"><Mail size={14} /> {selectedUser.email}</div>
                    <div className="umu-info-row"><Phone size={14} /> {selectedUser.phone || 'Non renseigne'}</div>
                    <div className="umu-info-row"><MapPin size={14} /> {selectedUser.address || selectedUser.city || 'Non renseignee'}</div>
                    <div className="umu-info-row"><Calendar size={14} /> Inscrit le {selectedUser.created_at ? format(new Date(selectedUser.created_at), 'dd MMMM yyyy', { locale: fr }) : '-'}</div>
                  </div>
                  <div className="umu-info-card">
                    <h3>Statistiques</h3>
                    <div className="umu-stat-row"><span>Total depense</span><strong>{FCFA(selectedUser.total_spent)}</strong></div>
                    <div className="umu-stat-row"><span>Commandes</span><strong>{selectedUser.orders_count || 0}</strong></div>
                    <div className="umu-stat-row"><span>Favoris</span><strong>{selectedUser.favorites_count || 0}</strong></div>
                    <div className="umu-stat-row"><span>Panier</span><strong>{selectedUser.cart_count || 0}</strong></div>
                    <div className="umu-stat-row"><span>Points fidelite</span><strong>{selectedUser.loyalty_points || 0}</strong></div>
                  </div>
                </div>
              )}

              {activeTab === 'activities' && (
                <div className="umu-activities">
                  {userActivities.length > 0 ? userActivities.map(a => (
                    <div key={a.id} className="umu-activity-item">
                      <div className="umu-activity-dot" />
                      <div className="umu-activity-text">
                        <strong>{getActivityLabel(a.activity_type)}</strong>
                        <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: fr })}</span>
                      </div>
                    </div>
                  )) : <p className="umu-empty-msg">Aucune activite enregistree</p>}
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="umu-orders">
                  {selectedUser.orders?.length > 0 ? selectedUser.orders.map(o => (
                    <div key={o.id} className="umu-order-card">
                      <div className="umu-order-top">
                        <span className="umu-order-id">#{o.id?.slice(0, 8)}</span>
                        <span className={`umu-badge umu-badge-${o.status === 'delivered' ? 'green' : o.status === 'cancelled' ? 'red' : 'blue'}`}>
                          {STATUS_FR[o.status] || o.status}
                        </span>
                      </div>
                      <div className="umu-order-bottom">
                        <span>{format(new Date(o.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                        <strong>{FCFA(o.total_amount)}</strong>
                      </div>
                    </div>
                  )) : <p className="umu-empty-msg">Aucune commande</p>}
                </div>
              )}

              {activeTab === 'cart' && (
                <div className="umu-cart-list">
                  {selectedUser.cartItems?.length > 0 ? selectedUser.cartItems.map(item => (
                    <div key={item.id} className="umu-cart-item">
                      <div><strong>{item.products?.name || 'Produit'}</strong><span className="umu-muted">x{item.quantity}</span></div>
                      <strong className="umu-amount">{FCFA(item.products?.price)}</strong>
                    </div>
                  )) : <p className="umu-empty-msg">Panier vide</p>}
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
