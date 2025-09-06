import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Search, Filter, MoreVertical, Phone, Video, 
  Paperclip, Smile, Mic, Image, File, MapPin, 
  Star, Archive, Trash2, Check, CheckCheck, Clock,
  User, ShoppingBag, Calendar, DollarSign, TrendingUp,
  MessageCircle, Bell, Settings, X, ChevronDown, Info
} from 'lucide-react';
import { supabase } from '../../config/supabase';
import './PremiumAdminChat.css';

const PremiumAdminChat = () => {
  // Admin ID fixe qui doit exister dans la table profiles
  const ADMIN_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  // États
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [typing, setTyping] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showUserInfo, setShowUserInfo] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Emojis populaires
  const popularEmojis = ['😊', '👍', '❤️', '😂', '🎉', '👏', '🔥', '✨', '💪', '🙏'];


  useEffect(() => {
    loadUsers();
    setupRealtimeSubscription();
    
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // D'abord, récupérer tous les user_id uniques des conversations
      const { data: conversationsData, error: convError } = await supabase
        .from('chat_conversations')
        .select('user_id')
        .not('user_id', 'is', null);

      if (convError) throw convError;

      // Obtenir les user_ids uniques
      const uniqueUserIds = [...new Set(conversationsData?.map(c => c.user_id) || [])];
      
      if (uniqueUserIds.length === 0) {
        setUsers([]);
        setConnectionStatus('connected');
        return;
      }

      // Récupérer les profils de ces utilisateurs
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uniqueUserIds)
        .order('last_updated', { ascending: false });

      if (usersError) throw usersError;
      
      // Pour chaque utilisateur, récupérer ses conversations et son dernier message
      const usersWithDetails = await Promise.all(
        (usersData || []).map(async (user) => {
          // Récupérer les conversations de l'utilisateur
          const { data: userConvs } = await supabase
            .from('chat_conversations')
            .select('id, status, updated_at')
            .eq('user_id', user.id);
            
          // Récupérer le dernier message de l'utilisateur
          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('message, created_at')
            .eq('sender_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          return {
            ...user,
            chat_conversations: userConvs || [],
            lastMessage: lastMessage?.message || '',
            lastMessageTime: lastMessage?.created_at || user.last_updated
          };
        })
      );
      
      setUsers(usersWithDetails);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error loading users:', error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const loadUserConversations = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setConversations(data || []);
      
      // Charger automatiquement la conversation la plus récente
      if (data && data.length > 0) {
        setSelectedConversation(data[0]);
        await loadMessages(data[0].id);
      }
    } catch (error) {
      console.error('Error loading user conversations:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);
      markAsRead(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    subscriptionRef.current = supabase
      .channel('admin-chat-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        handleRealtimeMessage(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations'
      }, (payload) => {
        handleRealtimeConversation(payload);
      })
      .subscribe();
  };

  const handleRealtimeMessage = (payload) => {
    if (payload.eventType === 'INSERT') {
      if (selectedConversation?.id === payload.new.conversation_id) {
        setMessages(prev => [...prev, payload.new]);
        markAsRead(payload.new.conversation_id);
      }
      // Jouer un son de notification
      playNotificationSound();
    }
  };

  const handleRealtimeConversation = (payload) => {
    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
      loadConversations();
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    setSending(true);
    setTyping(false);

    try {
      // Utiliser l'admin ID défini en constante
      const adminId = ADMIN_ID;
      
      // Vérifier s'il existe une conversation active ou en créer une
      let conversationId = selectedConversation?.id;
      
      if (!conversationId) {
        // Créer une nouvelle conversation
        const { data: newConv, error: convError } = await supabase
          .from('chat_conversations')
          .insert([{
            user_id: selectedUser.id,
            admin_id: adminId,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (convError) throw convError;
        conversationId = newConv.id;
        setSelectedConversation(newConv);
      }
      
      const messageData = {
        conversation_id: conversationId,
        sender_id: adminId,
        message: newMessage.trim(),
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        console.error('Erreur détaillée:', error);
        throw error;
      }

      // Ajouter le message localement
      setMessages(prev => [...prev, data]);
      setNewMessage('');

      // Mettre à jour la conversation
      await supabase
        .from('chat_conversations')
        .update({ 
          updated_at: new Date().toISOString() 
        })
        .eq('id', conversationId);
      
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (conversationId) => {
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', 'admin-001');
  };

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    await loadUserConversations(user.id);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Ici, implémenter l'upload de fichier
    console.log('File to upload:', file);
    setShowAttachmentMenu(false);
  };

  const insertQuickResponse = (response) => {
    setNewMessage(response);
  };

  const playNotificationSound = () => {
    // Jouer un son de notification
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBimg0fDTgjMGHm7A7+OZURE');
    audio.play().catch(e => console.log('Could not play notification sound'));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    }
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const getConversationTitle = (conv) => {
    if (conv.user_id) return `Client ${conv.user_id.slice(-6)}`;
    return 'Conversation';
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'resolved': return '#9E9E9E';
      default: return '#2196F3';
    }
  };

  const getUserFullName = (user) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email || `User ${user.id.slice(-6)}`;
  };

  const getUserStatus = (user) => {
    // Calculer le statut basé sur les conversations
    if (!user.chat_conversations || user.chat_conversations.length === 0) return 'inactive';
    
    const hasActive = user.chat_conversations.some(c => c.status === 'active');
    const hasPending = user.chat_conversations.some(c => c.status === 'pending');
    
    if (hasActive) return 'active';
    if (hasPending) return 'pending';
    return 'resolved';
  };

  const getUnreadCount = (userId) => {
    // Cette fonction devrait compter les messages non lus
    // Pour l'instant retourne 0
    return 0;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = getUserFullName(user)
      .toLowerCase()
      .includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const userStatus = getUserStatus(user);
    const matchesFilter = filterStatus === 'all' || userStatus === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="premium-chat-container">
      {/* Sidebar */}
      <div className="chat-sidebar">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <h2>Messages</h2>
          <div className="header-actions">
            <button className="icon-btn" title="Notifications">
              <Bell size={20} />
            </button>
            <button className="icon-btn" title="Paramètres">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            Tous
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'active' ? 'active' : ''}`}
            onClick={() => setFilterStatus('active')}
          >
            Actifs
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            En attente
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('resolved')}
          >
            Résolus
          </button>
        </div>

        {/* Users List */}
        <div className="conversations-list">
          {loading ? (
            <div className="loading-skeleton">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="skeleton-item">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-content">
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-line long"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <div
                key={user.id}
                className={`conversation-item ${selectedUser?.id === user.id ? 'active' : ''}`}
                onClick={() => handleUserSelect(user)}
              >
                <div className="conversation-avatar">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={getUserFullName(user)} className="avatar-img" />
                  ) : (
                    <div className="avatar-placeholder">
                      <User size={16} />
                    </div>
                  )}
                  <span 
                    className="status-dot" 
                    style={{ backgroundColor: getStatusColor(getUserStatus(user)) }}
                  />
                </div>
                <div className="conversation-info">
                  <div className="conversation-header">
                    <div className="font-semibold text-gray-800">
                      {getUserFullName(user)}
                    </div>
                    {getUnreadCount(user.id) > 0 && (
                      <span className="unread-badge">{getUnreadCount(user.id)}</span>
                    )}
                  </div>
                  <div className="conversation-preview">
                    <div className="text-sm text-gray-500 truncate">
                      {user.lastMessage || 'Démarrer une conversation'}
                    </div>
                    {user.lastMessageTime && (
                      <span className="text-xs text-gray-400">
                        {formatTime(user.lastMessageTime)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <MessageCircle size={48} />
              <p>Aucun utilisateur</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="user-avatar">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={getUserFullName(selectedUser)} className="avatar-img" />
                  ) : (
                    <div className="avatar-placeholder">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div className="chat-user-details">
                  <h3>{getUserFullName(selectedUser)}</h3>
                  <span className="user-status">
                    {getUserStatus(selectedUser) || 'Active'}
                  </span>
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="icon-btn" title="Appel vocal">
                  <Phone size={20} />
                </button>
                <button className="icon-btn" title="Appel vidéo">
                  <Video size={20} />
                </button>
                <button 
                  className="icon-btn" 
                  title="Informations"
                  onClick={() => setShowUserInfo(!showUserInfo)}
                >
                  <Info size={20} />
                </button>
                <button className="icon-btn" title="Plus d'options">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="messages-container">
              <div className="messages-scroll">
                {messages.map((msg, index) => {
                  const isAdmin = msg.sender_id === ADMIN_ID || msg.sender_id === 'admin-001' || msg.sender_id?.startsWith('admin');
                  const showDate = index === 0 || 
                    formatDate(msg.created_at) !== formatDate(messages[index-1]?.created_at);
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="date-separator">
                          <span>{formatDate(msg.created_at)}</span>
                        </div>
                      )}
                      <div className={`message-wrapper ${isAdmin ? 'sent' : 'received'}`}>
                        {!isAdmin && (
                          <div className="message-avatar">
                            {selectedUser?.avatar_url ? (
                              <img 
                                src={selectedUser.avatar_url} 
                                alt="" 
                                className="message-avatar-img" 
                              />
                            ) : (
                              <div className="message-avatar-placeholder">
                                <User size={14} />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="message-content-wrapper">
                          <div className="message-bubble">
                            <p className="message-text">{msg.message}</p>
                            <div className="message-meta">
                              <span className="message-time">
                                {formatTime(msg.created_at)}
                              </span>
                              {isAdmin && (
                                <span className="message-status">
                                  {msg.is_read ? <CheckCheck size={14} /> : <Check size={14} />}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="message-avatar admin-avatar">
                            <div className="message-avatar-placeholder admin">
                              <Settings size={14} />
                            </div>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                {typing && (
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>


            {/* Input Area */}
            <div className="chat-input-container">
              <div className="input-actions-left">
                <button 
                  className="icon-btn"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  title="Joindre"
                >
                  <Paperclip size={20} />
                </button>
                {showAttachmentMenu && (
                  <div className="attachment-menu">
                    <button onClick={() => fileInputRef.current?.click()}>
                      <Image size={18} /> Photo
                    </button>
                    <button onClick={() => fileInputRef.current?.click()}>
                      <File size={18} /> Document
                    </button>
                    <button>
                      <MapPin size={18} /> Localisation
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={handleFileUpload}
                />
              </div>
              
              <div className="message-input-wrapper">
                <input
                  type="text"
                  className="message-input"
                  placeholder="Tapez votre message..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    setTyping(e.target.value.length > 0);
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />
                <button 
                  className="emoji-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile size={20} />
                </button>
                {showEmojiPicker && (
                  <div className="emoji-picker">
                    {popularEmojis.map(emoji => (
                      <span
                        key={emoji}
                        className="emoji"
                        onClick={() => {
                          setNewMessage(prev => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                className={`send-btn ${sending ? 'sending' : ''}`}
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <div className="spinner"></div>
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="chat-empty-state">
            <div className="empty-state-content">
              <MessageCircle size={64} />
              <h3>Sélectionnez une conversation</h3>
              <p>Choisissez une conversation dans la liste pour commencer à discuter</p>
            </div>
          </div>
        )}
      </div>

      {/* User Info Panel */}
      {showUserInfo && selectedConversation && (
        <div className="user-info-panel">
          <div className="panel-header">
            <h3>Informations Client</h3>
            <button 
              className="icon-btn"
              onClick={() => setShowUserInfo(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="panel-content">
            <div className="user-profile">
              <div className="profile-avatar">
                {selectedConversation.user?.avatar_url ? (
                  <img src={selectedConversation.user.avatar_url} alt="" />
                ) : (
                  <User size={48} />
                )}
              </div>
              <h4>{getConversationTitle(selectedConversation)}</h4>
              <p>{selectedConversation.user?.phone}</p>
            </div>
            
            {selectedConversation.order && (
              <div className="order-details">
                <h5>Détails de la commande</h5>
                <div className="detail-item">
                  <ShoppingBag size={16} />
                  <span>Commande #{selectedConversation.order.order_number}</span>
                </div>
                <div className="detail-item">
                  <DollarSign size={16} />
                  <span>{selectedConversation.order.total_amount} €</span>
                </div>
                <div className="detail-item">
                  <TrendingUp size={16} />
                  <span className={`status-badge ${selectedConversation.order.status}`}>
                    {selectedConversation.order.status}
                  </span>
                </div>
              </div>
            )}
            
            <div className="panel-actions">
              <button className="action-btn">
                <Star size={16} />
                Marquer comme important
              </button>
              <button className="action-btn">
                <Archive size={16} />
                Archiver
              </button>
              <button className="action-btn danger">
                <Trash2 size={16} />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className={`connection-status-bar ${connectionStatus}`}>
        {connectionStatus === 'connected' && '✓ Connecté'}
        {connectionStatus === 'connecting' && '⟳ Connexion...'}
        {connectionStatus === 'error' && '✗ Erreur de connexion'}
      </div>
    </div>
  );
};

export default PremiumAdminChat;
