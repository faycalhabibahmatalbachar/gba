import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabase';
import { Send, Users, Search, Power, User } from 'lucide-react';
import './SimpleAdminChat.css';

const ADMIN_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

const SimpleAdminChat = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    console.log('Composant SimpleAdminChat monté');
    loadUsers();
    
    // Souscription aux messages
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chat_messages' 
      }, () => {
        loadMessages();
        loadUsers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadMessages();
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleBlockUser = async (userId, shouldBlock) => {
    try {
      console.log(`Tentative de ${shouldBlock ? 'blocage' : 'déblocage'} pour l'utilisateur ${userId}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          is_blocked: shouldBlock,
          blocked_at: shouldBlock ? new Date().toISOString() : null,
          blocked_by: shouldBlock ? ADMIN_ID : null,
          block_reason: shouldBlock ? 'Bloqué par l\'administrateur' : null
        })
        .eq('id', userId)
        .select();

      if (error) {
        console.error('Erreur SQL:', error);
        throw error;
      }

      console.log('Mise à jour réussie:', data);
      
      // Mettre à jour l'état local immédiatement
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, is_blocked: shouldBlock }
            : user
        )
      );
      
      // Notification visuelle
      const message = shouldBlock ? '🔒 Utilisateur bloqué' : '🔓 Utilisateur débloqué';
      console.log(message);
      
      // Recharger la liste après un délai court
      setTimeout(() => loadUsers(), 500);
      
    } catch (error) {
      console.error('Erreur blocage/déblocage:', error);
      alert(`Erreur: ${error.message}\nVérifiez les permissions dans Supabase`);
    }
  };

  const loadUsers = async () => {
    try {
      console.log('Début chargement utilisateurs...');
      setLoading(true);
      
      // Charger TOUS les profils clients (pas seulement ceux avec conversations)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', ADMIN_ID) // Exclure l'admin
        .order('created_at', { ascending: false });
      
      console.log('Profils chargés:', profilesData?.length || 0);
      console.log('Profils data:', profilesData);
      
      if (profilesError) {
        console.error('Erreur chargement profils:', profilesError);
        throw profilesError;
      }

      // Charger toutes les conversations
      const { data: conversationsData, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (convError) throw convError;

      // Charger les derniers messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (messagesError) throw messagesError;

      // Combiner les données pour chaque profil
      const usersWithData = profilesData?.map(profile => {
        const userConversations = conversationsData?.filter(c => c.user_id === profile.id) || [];
        const userMessages = messagesData?.filter(m => 
          userConversations.some(c => c.id === m.conversation_id)
        ) || [];
        
        const lastMessage = userMessages[0];
        
        return {
          ...profile,
          conversations: userConversations,
          lastMessage: lastMessage?.message,
          lastMessageTime: lastMessage?.created_at,
          unreadCount: userMessages.filter(m => !m.is_read && m.sender_id === profile.id).length,
          hasConversation: userConversations.length > 0
        };
      }) || [];

      // Trier pour mettre en premier ceux qui ont des messages récents
      usersWithData.sort((a, b) => {
        if (a.lastMessageTime && !b.lastMessageTime) return -1;
        if (!a.lastMessageTime && b.lastMessageTime) return 1;
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        }
        return 0;
      });

      setUsers(usersWithData);
      console.log('Utilisateurs finaux:', usersWithData);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setUsers([]); // S'assurer que la liste est vide en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedUser) return;

    try {
      const userConversations = selectedUser.conversations || [];
      if (userConversations.length === 0) return;

      const conversationIds = userConversations.map(c => c.id);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);
      markMessagesAsRead(conversationIds);
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
    }
  };

  const markMessagesAsRead = async (conversationIds) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .in('conversation_id', conversationIds)
        .eq('is_read', false);
    } catch (error) {
      console.error('Erreur lors du marquage des messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    setSending(true);
    
    try {
      let conversationId = selectedUser.conversations?.[0]?.id;
      
      if (!conversationId) {
        // Créer une nouvelle conversation
        const { data: newConv, error: convError } = await supabase
          .from('chat_conversations')
          .insert([{
            user_id: selectedUser.id,
            admin_id: ADMIN_ID,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (convError) throw convError;
        conversationId = newConv.id;
        
        // Mettre à jour l'utilisateur sélectionné
        setSelectedUser(prev => ({
          ...prev,
          conversations: [newConv]
        }));
      }
      
      // Envoyer le message
      const messageData = {
        conversation_id: conversationId,
        sender_id: ADMIN_ID,
        message: newMessage.trim(),
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;

      // Ajouter le message localement
      setMessages(prev => [...prev, data]);
      setNewMessage('');

      // Mettre à jour la conversation
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      // Recharger les utilisateurs pour mettre à jour le dernier message
      loadUsers();
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="simple-chat-container">
      {/* Liste des utilisateurs */}
      <div className="users-sidebar">
        <div className="sidebar-header">
          <h2>Messages</h2>
        </div>
        
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="users-list">
          {loading ? (
            <div className="loading">Chargement...</div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <div
                key={user.id}
                className={`user-item ${selectedUser?.id === user.id ? 'active' : ''} ${!user.hasConversation ? 'no-conversation' : ''}`}
                onClick={() => setSelectedUser(user)}
              >
                <div className="user-avatar">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={`${user.first_name} ${user.last_name}`} />
                  ) : (
                    <div className="avatar-placeholder">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div className="user-info">
                  <div className="user-info-text">
                    <div className="user-name">
                      {user.first_name || 'Client'} {user.last_name || ''}
                      {user.unreadCount > 0 && (
                        <span className="badge">{user.unreadCount}</span>
                      )}
                      {user.is_blocked && (
                        <span className="blocked-badge">Bloqué</span>
                      )}
                    </div>
                    <div className="user-preview">
                      {user.hasConversation ? (
                        user.lastMessage || 'Aucun message'
                      ) : (
                        <span style={{fontStyle: 'italic', opacity: 0.7}}>Cliquez pour démarrer une conversation</span>
                      )}
                    </div>
                  </div>
                  <div 
                    className="block-switch-container"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!user.is_blocked}
                        onChange={() => toggleBlockUser(user.id, !user.is_blocked)}
                      />
                      <span className="slider">
                        <Power className="power-icon" size={14} />
                      </span>
                    </label>
                  </div>
                </div>
                {user.lastMessageTime && (
                  <div className="user-time">
                    {formatTime(user.lastMessageTime)}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-users">Aucun utilisateur</div>
          )}
        </div>
      </div>

      {/* Zone de chat */}
      <div className="chat-main">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="header-user">
                <div className="user-avatar">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={`${selectedUser.first_name} ${selectedUser.last_name}`} />
                  ) : (
                    <div className="avatar-placeholder">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div className="header-info">
                  <div className="header-name">
                    {selectedUser.first_name || 'Client'} {selectedUser.last_name || ''}
                  </div>
                  <div className="header-status">
                    {selectedUser.email || 'En ligne'}
                  </div>
                </div>
              </div>
            </div>

            <div className="messages-area">
              {messages.length > 0 ? (
                messages.map(msg => {
                  const isAdmin = msg.sender_id === ADMIN_ID;
                  return (
                    <div key={msg.id} className={`message ${isAdmin ? 'sent' : 'received'}`}>
                      {!isAdmin && (
                        <div className="message-avatar">
                          {selectedUser.avatar_url ? (
                            <img src={selectedUser.avatar_url} alt="" />
                          ) : (
                            <div className="avatar-small">
                              <User size={14} />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="message-bubble">
                        {msg.message}
                        <div className="message-time">
                          {formatTime(msg.created_at)}
                          {isAdmin && (
                            <span className="message-status">
                              {msg.is_read ? <CheckCheck size={14} /> : <Check size={14} />}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-messages">
                  <p>Aucun message avec {selectedUser.first_name || 'ce client'}</p>
                  <p className="hint">Envoyez un message pour démarrer la conversation</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <input
                type="text"
                placeholder="Tapez votre message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                disabled={sending}
              />
              <button 
                onClick={sendMessage} 
                disabled={!newMessage.trim() || sending}
                className="send-button"
              >
                <Send size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat">
            <User size={48} />
            <p>Sélectionnez une conversation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleAdminChat;
