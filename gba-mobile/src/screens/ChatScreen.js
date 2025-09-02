import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

export default function ChatScreen({ navigation }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: 'Bonjour! Comment puis-je vous aider aujourd\'hui?',
      sender: 'support',
      time: '10:00',
      avatar: 'https://via.placeholder.com/50',
    },
    {
      id: '2',
      text: 'J\'ai une question concernant ma dernière commande',
      sender: 'user',
      time: '10:02',
    },
    {
      id: '3',
      text: 'Bien sûr! Pouvez-vous me donner votre numéro de commande?',
      sender: 'support',
      time: '10:03',
      avatar: 'https://via.placeholder.com/50',
    },
  ]);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom when new message is added
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = () => {
    if (message.trim() === '') return;

    const newMessage = {
      id: Date.now().toString(),
      text: message,
      sender: 'user',
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setMessage('');

    // Simulate support response
    setTimeout(() => {
      const supportMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Merci pour votre message. Un agent va vous répondre dans quelques instants.',
        sender: 'support',
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        avatar: 'https://via.placeholder.com/50',
      };
      setMessages(prevMessages => [...prevMessages, supportMessage]);
    }, 2000);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.supportMessageContainer
      ]}>
        {!isUser && (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.supportMessage
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.supportMessageText
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isUser ? styles.userMessageTime : styles.supportMessageTime
          ]}>
            {item.time}
          </Text>
        </View>
      </View>
    );
  };

  const quickReplies = [
    'État de ma commande',
    'Problème de livraison',
    'Retour produit',
    'Autre question',
  ];

  const handleQuickReply = (reply) => {
    setMessage(reply);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={90}
      >
        {/* Chat Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <View style={styles.onlineIndicator} />
            <View>
              <Text style={styles.headerTitle}>Support GBA Store</Text>
              <Text style={styles.headerSubtitle}>En ligne</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="phone" size={24} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="videocam" size={24} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Quick Replies */}
        {message === '' && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.quickRepliesContainer}
          >
            {quickReplies.map((reply, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickReply}
                onPress={() => handleQuickReply(reply)}
              >
                <Text style={styles.quickReplyText}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Icon name="attach-file" size={24} color="#999" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Tapez votre message..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
            maxHeight={100}
          />
          <TouchableOpacity style={styles.emojiButton}>
            <Icon name="mood" size={24} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, message.trim() === '' && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={message.trim() === ''}
          >
            <LinearGradient
              colors={message.trim() === '' ? ['#ccc', '#aaa'] : ['#667eea', '#764ba2']}
              style={styles.sendButtonGradient}
            >
              <Icon name="send" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#4CAF50',
  },
  headerButton: {
    padding: 8,
    marginLeft: 10,
  },
  messagesContainer: {
    padding: 15,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 15,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  supportMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 20,
  },
  userMessage: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 5,
  },
  supportMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  supportMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 5,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  supportMessageTime: {
    color: '#999',
  },
  quickRepliesContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 50,
  },
  quickReply: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  quickReplyText: {
    color: '#667eea',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  attachButton: {
    padding: 8,
    marginRight: 5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxHeight: 100,
  },
  emojiButton: {
    padding: 8,
    marginLeft: 5,
  },
  sendButton: {
    marginLeft: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
