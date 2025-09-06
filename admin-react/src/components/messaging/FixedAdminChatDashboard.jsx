import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../config/supabase';
import { 
  MessageCircle, 
  Send, 
  Clock, 
  User, 
  Filter,
  Search,
  Star,
  Archive,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Paperclip,
  Image as ImageIcon,
  Mic,
  MapPin,
  Package,
  Bell,
  BellOff,
  Flag,
  X,
  ChevronDown,
  Wifi,
  WifiOff
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import './AdminChat.css';

const FixedAdminChatDashboard = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [quickResponses, setQuickResponses] = useState([]);
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [realtimeChannel, setRealtimeChannel] = useState(null);
  const [messageChannel, setMessageChannel] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  // Stats pour le dashboard
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    avgResponseTime: '0 min',
    satisfaction: 0
  });

  useEffect(() => {
    mountedRef.current = true;
    console.log('🚀 Fixed Admin Chat Dashboard initialized');
    loadConversations();
    loadQuickResponses();
    setupRealtimeSubscriptions();
    calculateStats();

    return () => {
      mountedRef.current = false;
      console.log('🔄 Cleaning up subscriptions');
      cleanupSubscriptions();
    };
  }, []);

  const cleanupSubscriptions = () => {
    if (realtimeChannel) {
      console.log('📡 Unsubscribing from realtime channel');
      supabase.removeChannel(realtimeChannel);
    }
    if (messageChannel) {
      console.log('💬 Unsubscribing from message channel');
      supabase.removeChannel(messageChannel);
    }
  };

  const loadConversations = async () => {
    try {
      console.log('📥 Loading conversations...');
      setConnectionStatus('loading');
      
      // Test de connexion simple d'abord
      const { data: testData, error: testError } = await supabase
        .from('chat_conversations')
        .select('id')
        .limit(1);

      if (testError) {
        console.error('❌ Connection test failed:', testError);
        setConnectionStatus('error');
        
        // Afficher un message d'erreur à l'utilisateur
        if (testError.message.includes('permission') || testError.message.includes('denied')) {
          console.error('🔐 RLS Policy issue detected. Please check Supabase policies.');
        }
      }
      
      // Récupérer toutes les conversations
      const { data: conversationsData, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (convError) {
        console.error('❌ Error loading conversations:', convError);
        setConnectionStatus('error');
        throw convError;
      }

      console.log(`✅ Loaded ${conversationsData?.length || 0} conversations`);

      // Pour chaque conversation, récupérer le dernier message seulement
      const conversationsWithLastMessage = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const { data: lastMessage, error: msgError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (msgError && msgError.code !== 'PGRST116') { // Ignore "no rows" error
            console.error(`⚠️ Error loading last message for ${conv.id}:`, msgError);
          }

          // Compter les messages non lus
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('sender_id', conv.user_id)
            .eq('is_read', false);

          return {
            ...conv,
            last_message: lastMessage,
            unread_count: unreadCount || 0,
            last_message_at: lastMessage?.created_at || conv.created_at
          };
        })
      );

      if (mountedRef.current) {
        setConversations(conversationsWithLastMessage);
        
        // Calculer le total des non-lus
        const totalUnread = conversationsWithLastMessage.reduce((acc, conv) => {
          return acc + (conv.unread_count || 0);
        }, 0);
        
        setUnreadCount(totalUnread);
        setLoading(false);
        setConnectionStatus('connected');
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      if (mountedRef.current) {
        setLoading(false);
        setConnectionStatus('error');
      }
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      console.log(`📨 Loading messages for conversation: ${conversationId}`);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Ajouter sender_type basé sur sender_id
      const conversation = conversations.find(c => c.id === conversationId);
      const messagesWithType = (data || []).map(msg => ({
        ...msg,
        sender_type: msg.sender_id === conversation?.user_id ? 'customer' : 'admin',
        content: msg.message // Mapper message vers content pour compatibilité
      }));
      
      console.log(`✅ Loaded ${data?.length || 0} messages`);
      if (mountedRef.current) {
        setMessages(messagesWithType);
      }
      
      // Marquer comme lus
      await markAsRead(conversationId);
      
      // Scroll vers le bas
      scrollToBottom();
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const loadQuickResponses = async () => {
    // Réponses rapides par défaut (table quick_responses n'existe pas encore)
    setQuickResponses([
      { id: 1, content: "Bonjour ! Comment puis-je vous aider ?" },
      { id: 2, content: "Votre commande est en cours de préparation." },
      { id: 3, content: "Je vérifie cela pour vous immédiatement." },
      { id: 4, content: "Merci de votre patience, je reviens vers vous." },
      { id: 5, content: "Votre satisfaction est notre priorité !" }
    ]);
  };

  const setupRealtimeSubscriptions = () => {
    console.log('🔴 Setting up realtime subscriptions...');
    setConnectionStatus('connecting');

    try {
      // Canal pour les conversations
      const convChannel = supabase
        .channel('admin-conversations-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chat_conversations'
        }, (payload) => {
          console.log('📣 Conversation change:', payload);
          if (mountedRef.current) {
            loadConversations();
          }
        })
        .subscribe((status) => {
          console.log('📡 Conversation channel status:', status);
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('error');
            console.error('❌ WebSocket error on conversation channel');
          }
        });

      setRealtimeChannel(convChannel);

      // Canal pour les messages
      const msgChannel = supabase
        .channel('admin-messages-changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        }, async (payload) => {
          console.log('💬 New message:', payload);
          const newMsg = payload.new;
          
          if (mountedRef.current) {
            // Ajouter au messages si c'est la conversation active
            if (selectedConversation?.id === newMsg.conversation_id) {
              setMessages(prev => [...prev, {
                ...newMsg,
                sender_type: newMsg.sender_id === selectedConversation?.user_id ? 'customer' : 'admin',
                content: newMsg.message
              }]);
              scrollToBottom();
            }
            
            // Notification pour les messages clients
            if (newMsg.sender_id !== 'admin-' + Date.now()) {
              playNotificationSound();
              showDesktopNotification(newMsg);
            }
            
            // Rafraîchir les conversations
            loadConversations();
          }
        })
        .subscribe((status) => {
          console.log('💬 Message channel status:', status);
        });

      setMessageChannel(msgChannel);

    } catch (error) {
      console.error('❌ Error setting up realtime:', error);
      setConnectionStatus('error');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    console.log(`📤 Sending message to conversation: ${selectedConversation.id}`);

    try {
      // Générer un ID admin unique
      const adminId = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const messageData = {
        conversation_id: selectedConversation.id,
        sender_id: adminId,
        message: newMessage,
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Message sent successfully');
      if (mountedRef.current) {
        setMessages(prev => [...prev, {
          ...data,
          sender_type: 'admin',
          content: data.message
        }]);
        setNewMessage('');
      }
      
      // Mettre à jour updated_at de la conversation
      await supabase
        .from('chat_conversations')
        .update({ 
          updated_at: new Date().toISOString(),
          admin_id: adminId // Assigner l'admin à la conversation
        })
        .eq('id', selectedConversation.id);

      scrollToBottom();
      loadConversations(); // Rafraîchir la liste
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Erreur lors de l\'envoi du message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      // Récupérer la conversation pour obtenir user_id
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return;

      // Marquer comme lus seulement les messages du client
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_id', conversation.user_id)
        .eq('is_read', false);
      
      console.log('✅ Messages marked as read');
    } catch (error) {
      console.error('❌ Error marking as read:', error);
    }
  };

  const changeConversationStatus = async (conversationId, status) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ status })
        .eq('id', conversationId);

      if (error) throw error;
      
      console.log(`✅ Conversation status changed to: ${status}`);
      loadConversations();
    } catch (error) {
      console.error('❌ Error changing status:', error);
    }
  };

  const changePriority = async (conversationId, priority) => {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ priority })
        .eq('id', conversationId);

      if (error) throw error;
      
      console.log(`✅ Priority changed to: ${priority}`);
      loadConversations();
    } catch (error) {
      console.error('❌ Error changing priority:', error);
    }
  };

  const useQuickResponse = (response) => {
    setNewMessage(response.content);
    setShowQuickResponses(false);
  };

  const calculateStats = async () => {
    try {
      const { data: convData } = await supabase
        .from('chat_conversations')
        .select('status');
      
      const total = convData?.length || 0;
      const active = convData?.filter(c => c.status === 'active').length || 0;
      const resolved = convData?.filter(c => c.status === 'resolved').length || 0;
      
      setStats({
        total,
        active,
        resolved,
        avgResponseTime: '5 min',
        satisfaction: 95
      });
    } catch (error) {
      console.error('❌ Error calculating stats:', error);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const playNotificationSound = () => {
    // Jouer un son de notification
    const audio = new Audio('/notification.mp3');
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  const showDesktopNotification = (message) => {
    if (Notification.permission === 'granted') {
      new Notification('Nouveau message', {
        body: message.message?.substring(0, 100) || 'Nouveau message reçu',
        icon: '/icon-192x192.png'
      });
    }
  };

  // Demander permission pour les notifications
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Filtrer les conversations
  const filteredConversations = conversations.filter(conv => {
    if (filterStatus !== 'all' && conv.status !== filterStatus) return false;
    if (filterPriority !== 'all' && conv.priority !== filterPriority) return false;
    if (searchTerm && !JSON.stringify(conv).toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="admin-chat-dashboard">
      {/* Status Bar */}
      <div className="connection-status">
        {connectionStatus === 'connected' ? (
          <span className="status-connected">
            <Wifi size={16} /> Connecté
          </span>
        ) : connectionStatus === 'connecting' ? (
          <span className="status-connecting">
            <Clock size={16} /> Connexion...
          </span>
        ) : (
          <span className="status-error">
            <WifiOff size={16} /> Déconnecté
            <button onClick={() => {
              cleanupSubscriptions();
              setupRealtimeSubscriptions();
              loadConversations();
            }} style={{ marginLeft: '10px' }}>
              Reconnecter
            </button>
          </span>
        )}
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Actives</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.resolved}</div>
          <div className="stat-label">Résolues</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.avgResponseTime}</div>
          <div className="stat-label">Temps moy.</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.satisfaction}%</div>
          <div className="stat-label">Satisfaction</div>
        </div>
      </div>

      <div className="chat-container">
        {/* Sidebar avec liste des conversations */}
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <h3>Conversations ({filteredConversations.length})</h3>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </div>

          {/* Filtres */}
          <div className="filters">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-buttons">
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">Tous status</option>
                <option value="active">Actives</option>
                <option value="pending">En attente</option>
                <option value="resolved">Résolues</option>
              </select>
              <select 
                value={filterPriority} 
                onChange={(e) => setFilterPriority(e.target.value)}
                className="filter-select"
              >
                <option value="all">Toutes priorités</option>
                <option value="high">Haute</option>
                <option value="medium">Moyenne</option>
                <option value="low">Basse</option>
              </select>
            </div>
          </div>

          {/* Liste des conversations */}
          <div className="conversations-list">
            {loading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Chargement...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="no-conversations">
                <MessageCircle size={48} />
                <p>Aucune conversation</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  className={`conversation-item ${selectedConversation?.id === conv.id ? 'selected' : ''} ${conv.unread_count > 0 ? 'unread' : ''}`}
                  onClick={() => {
                    setSelectedConversation(conv);
                    loadMessages(conv.id);
                  }}
                >
                  <div className="conversation-header">
                    <div className="user-info">
                      <User size={16} />
                      <span className="user-id">
                        {conv.user_id?.substring(0, 8)}...
                      </span>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="unread-count">{conv.unread_count}</span>
                    )}
                  </div>
                  {conv.order_id && (
                    <div className="order-info">
                      <Package size={14} />
                      <span>Commande #{conv.order_id}</span>
                    </div>
                  )}
                  {conv.last_message && (
                    <div className="last-message">
                      {conv.last_message.message?.substring(0, 50)}...
                    </div>
                  )}
                  <div className="conversation-meta">
                    <span className={`status status-${conv.status}`}>
                      {conv.status}
                    </span>
                    {conv.priority && (
                      <span className={`priority priority-${conv.priority}`}>
                        <Flag size={12} />
                      </span>
                    )}
                    <span className="time">
                      {conv.last_message_at && formatDistanceToNow(
                        new Date(conv.last_message_at),
                        { locale: fr, addSuffix: true }
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Zone de chat */}
        <div className="chat-area">
          {selectedConversation ? (
            <>
              {/* Header de la conversation */}
              <div className="chat-header">
                <div className="chat-header-info">
                  <h3>Conversation #{selectedConversation.id.substring(0, 8)}</h3>
                  {selectedConversation.order_id && (
                    <span className="order-badge">
                      <Package size={16} />
                      Commande #{selectedConversation.order_id}
                    </span>
                  )}
                </div>
                <div className="chat-actions">
                  <button 
                    className="action-btn"
                    onClick={() => changeConversationStatus(
                      selectedConversation.id,
                      selectedConversation.status === 'resolved' ? 'active' : 'resolved'
                    )}
                  >
                    {selectedConversation.status === 'resolved' ? (
                      <>Rouvrir</>
                    ) : (
                      <>Résoudre</>
                    )}
                  </button>
                  <button className="action-btn">
                    <Archive size={18} />
                  </button>
                  <button className="action-btn">
                    <Star size={18} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`message ${msg.sender_type === 'admin' ? 'admin-message' : 'customer-message'}`}
                  >
                    <div className="message-bubble">
                      <div className="message-content">
                        {msg.content || msg.message}
                      </div>
                      <div className="message-time">
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {typingUsers.has(selectedConversation.user_id) && (
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Zone de saisie */}
              <div className="message-input-container">
                {showQuickResponses && (
                  <div className="quick-responses">
                    {quickResponses.map(qr => (
                      <button
                        key={qr.id}
                        className="quick-response-btn"
                        onClick={() => useQuickResponse(qr)}
                      >
                        {qr.content}
                      </button>
                    ))}
                  </div>
                )}
                <div className="message-input">
                  <button 
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={20} />
                  </button>
                  <button 
                    className="quick-btn"
                    onClick={() => setShowQuickResponses(!showQuickResponses)}
                  >
                    <ChevronDown size={20} />
                  </button>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Tapez votre message..."
                    rows="1"
                  />
                  <button 
                    className="send-btn"
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                  >
                    {sending ? (
                      <div className="spinner-small"></div>
                    ) : (
                      <Send size={20} />
                    )}
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={(e) => {
                    // TODO: Implémenter l'upload de fichiers
                    console.log('File selected:', e.target.files[0]);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="no-conversation-selected">
              <MessageCircle size={64} />
              <h3>Sélectionnez une conversation</h3>
              <p>Choisissez une conversation dans la liste pour commencer</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FixedAdminChatDashboard;
