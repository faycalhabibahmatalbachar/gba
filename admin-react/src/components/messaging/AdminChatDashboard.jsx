import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import './AdminChat.css';

const AdminChatDashboard = () => {
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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stats pour le dashboard
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    avgResponseTime: '0 min',
    satisfaction: 0
  });

  useEffect(() => {
    console.log('🚀 Admin Chat Dashboard initialized');
    loadConversations();
    loadQuickResponses();
    setupRealtimeSubscriptions();
    calculateStats();

    return () => {
      console.log('🔄 Cleaning up subscriptions');
      supabase.removeAllChannels();
    };
  }, []);

  const loadConversations = async () => {
    try {
      console.log('📥 Loading conversations...');
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          participants:conversation_participants(
            user_id,
            role,
            last_read_at
          ),
          messages(
            id,
            content,
            sender_id,
            sender_type,
            created_at,
            is_read
          )
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Loaded ${data?.length || 0} conversations`);
      setConversations(data || []);
      
      // Calculer les non-lus
      const unread = data?.reduce((acc, conv) => {
        const unreadMessages = conv.messages?.filter(m => 
          m.sender_type === 'customer' && !m.is_read
        ).length || 0;
        return acc + unreadMessages;
      }, 0) || 0;
      
      setUnreadCount(unread);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      console.log(`📨 Loading messages for conversation: ${conversationId}`);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          attachments:message_attachments(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      console.log(`✅ Loaded ${data?.length || 0} messages`);
      setMessages(data || []);
      
      // Marquer comme lus
      await markAsRead(conversationId);
      
      // Scroll vers le bas
      scrollToBottom();
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const loadQuickResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('quick_responses')
        .select('*')
        .order('usage_count', { ascending: false })
        .limit(10);

      if (error) throw error;
      setQuickResponses(data || []);
    } catch (error) {
      console.error('❌ Error loading quick responses:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    console.log('🔴 Setting up realtime subscriptions...');

    // Écouter les nouvelles conversations
    supabase
      .channel('conversations')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('📣 Conversation change:', payload);
          loadConversations();
        }
      )
      .subscribe();

    // Écouter les nouveaux messages
    supabase
      .channel('messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('💬 New message:', payload);
          const newMsg = payload.new;
          
          // Ajouter au messages si c'est la conversation active
          if (selectedConversation?.id === newMsg.conversation_id) {
            setMessages(prev => [...prev, newMsg]);
            scrollToBottom();
          }
          
          // Notification sonore pour les messages clients
          if (newMsg.sender_type === 'customer') {
            playNotificationSound();
            showDesktopNotification(newMsg);
          }
          
          // Rafraîchir les conversations
          loadConversations();
        }
      )
      .subscribe();

    // Écouter les indicateurs de frappe
    supabase
      .channel('typing')
      .on('presence', { event: 'sync' }, () => {
        console.log('⌨️ Typing status sync');
      })
      .on('presence', { event: 'join' }, (payload) => {
        console.log('⌨️ User started typing:', payload);
        setTypingUsers(prev => new Set(prev).add(payload.user_id));
      })
      .on('presence', { event: 'leave' }, (payload) => {
        console.log('⌨️ User stopped typing:', payload);
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(payload.user_id);
          return newSet;
        });
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    console.log(`📤 Sending message to conversation: ${selectedConversation.id}`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          sender_type: 'admin',
          content: newMessage.trim(),
          message_type: 'text'
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Message sent successfully');
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      
      // Mettre à jour last_message_at de la conversation
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      scrollToBottom();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'customer');

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      console.log('✅ Messages marked as read');
    } catch (error) {
      console.error('❌ Error marking as read:', error);
    }
  };

  const changeConversationStatus = async (conversationId, status) => {
    try {
      const { error } = await supabase
        .from('conversations')
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
        .from('conversations')
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
    
    // Incrémenter le compteur d'utilisation
    supabase
      .from('quick_responses')
      .update({ usage_count: response.usage_count + 1 })
      .eq('id', response.id)
      .then(() => console.log('✅ Quick response usage updated'));
  };

  const calculateStats = async () => {
    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('status');
      
      const total = convData?.length || 0;
      const active = convData?.filter(c => c.status === 'active').length || 0;
      const resolved = convData?.filter(c => c.status === 'resolved').length || 0;
      
      setStats({
        total,
        active,
        resolved,
        avgResponseTime: '5 min',
        satisfaction: 4.5
      });
    } catch (error) {
      console.error('❌ Error calculating stats:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  const showDesktopNotification = (message) => {
    if (Notification.permission === 'granted') {
      new Notification('Nouveau message client', {
        body: message.content,
        icon: '/icon-192.png'
      });
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conv.customer_id?.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || conv.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || conv.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="admin-chat-dashboard">
      {/* Header avec stats */}
      <div className="chat-header">
        <div className="header-content">
          <h1 className="header-title">
            <MessageCircle className="header-icon" />
            Centre de Messagerie
          </h1>
          <div className="header-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-card active">
              <span className="stat-value">{stats.active}</span>
              <span className="stat-label">Actives</span>
            </div>
            <div className="stat-card resolved">
              <span className="stat-value">{stats.resolved}</span>
              <span className="stat-label">Résolues</span>
            </div>
            <div className="stat-card">
              <Clock size={16} />
              <span className="stat-value">{stats.avgResponseTime}</span>
              <span className="stat-label">Temps moyen</span>
            </div>
            <div className="stat-card">
              <Star size={16} />
              <span className="stat-value">{stats.satisfaction}/5</span>
              <span className="stat-label">Satisfaction</span>
            </div>
          </div>
        </div>
      </div>

      <div className="chat-container">
        {/* Sidebar avec liste des conversations */}
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <div className="search-bar">
              <Search size={18} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filters">
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actives</option>
                <option value="pending">En attente</option>
                <option value="resolved">Résolues</option>
                <option value="archived">Archivées</option>
              </select>
              <select 
                value={filterPriority} 
                onChange={(e) => setFilterPriority(e.target.value)}
                className="filter-select"
              >
                <option value="all">Toutes priorités</option>
                <option value="urgent">Urgent</option>
                <option value="high">Haute</option>
                <option value="normal">Normale</option>
                <option value="low">Basse</option>
              </select>
            </div>
          </div>

          <div className="conversations-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Chargement des conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="empty-state">
                <MessageCircle size={48} />
                <p>Aucune conversation trouvée</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedConversation(conv);
                    loadMessages(conv.id);
                  }}
                >
                  <div className="conversation-header">
                    <div className="conversation-info">
                      <h4>{conv.subject}</h4>
                      <p className="customer-id">Client: {conv.customer_id?.substring(0, 8)}...</p>
                    </div>
                    <div className="conversation-meta">
                      <span className="time">
                        {formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: true,
                          locale: fr
                        })}
                      </span>
                      {conv.messages?.filter(m => m.sender_type === 'customer' && !m.is_read).length > 0 && (
                        <span className="unread-badge">
                          {conv.messages.filter(m => m.sender_type === 'customer' && !m.is_read).length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="conversation-preview">
                    {conv.messages?.[conv.messages.length - 1]?.content || 'Pas de message'}
                  </div>
                  <div className="conversation-tags">
                    <span className={`status-tag ${conv.status}`}>
                      {conv.status === 'active' && <CheckCircle size={12} />}
                      {conv.status === 'pending' && <Clock size={12} />}
                      {conv.status === 'resolved' && <Archive size={12} />}
                      {conv.status}
                    </span>
                    {conv.priority !== 'normal' && (
                      <span className={`priority-tag ${conv.priority}`}>
                        <Flag size={12} />
                        {conv.priority}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Zone de chat principale */}
        <div className="chat-main">
          {selectedConversation ? (
            <>
              <div className="chat-main-header">
                <div className="chat-info">
                  <h2>{selectedConversation.subject}</h2>
                  <p>
                    Client ID: {selectedConversation.customer_id} 
                    {selectedConversation.order_id && ` • Commande: #${selectedConversation.order_id}`}
                  </p>
                </div>
                <div className="chat-actions">
                  <div className="action-group">
                    <select 
                      value={selectedConversation.status}
                      onChange={(e) => changeConversationStatus(selectedConversation.id, e.target.value)}
                      className="status-select"
                    >
                      <option value="active">Active</option>
                      <option value="pending">En attente</option>
                      <option value="resolved">Résolue</option>
                      <option value="archived">Archivée</option>
                    </select>
                    <select 
                      value={selectedConversation.priority}
                      onChange={(e) => changePriority(selectedConversation.id, e.target.value)}
                      className="priority-select"
                    >
                      <option value="low">Priorité basse</option>
                      <option value="normal">Priorité normale</option>
                      <option value="high">Priorité haute</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <button className="action-btn">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>

              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="empty-messages">
                    <MessageCircle size={48} />
                    <p>Aucun message dans cette conversation</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`message ${msg.sender_type === 'admin' ? 'sent' : 'received'}`}
                    >
                      <div className="message-bubble">
                        <div className="message-content">{msg.content}</div>
                        {msg.attachments?.length > 0 && (
                          <div className="message-attachments">
                            {msg.attachments.map(att => (
                              <a 
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="attachment"
                              >
                                {att.type === 'image' ? <ImageIcon size={16} /> : <Paperclip size={16} />}
                                {att.filename}
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="message-meta">
                          <span className="message-time">
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {msg.sender_type === 'admin' && msg.is_read && (
                            <span className="read-indicator">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {typingUsers.size > 0 && (
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="message-input-container">
                {showQuickResponses && (
                  <div className="quick-responses">
                    <div className="quick-responses-header">
                      <h4>Réponses rapides</h4>
                      <button onClick={() => setShowQuickResponses(false)}>
                        <X size={16} />
                      </button>
                    </div>
                    <div className="quick-responses-list">
                      {quickResponses.map(qr => (
                        <button
                          key={qr.id}
                          className="quick-response"
                          onClick={() => useQuickResponse(qr)}
                        >
                          {qr.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="message-input">
                  <button 
                    className="input-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={20} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={(e) => {
                      // TODO: Gérer l'upload de fichiers
                      console.log('File selected:', e.target.files[0]);
                    }}
                  />
                  <button 
                    className="input-btn"
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
                      <div className="spinner small"></div>
                    ) : (
                      <Send size={20} />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="no-conversation">
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

export default AdminChatDashboard;
