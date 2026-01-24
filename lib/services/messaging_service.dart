import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/conversation.dart';

class MessagingService extends ChangeNotifier {
  final SupabaseClient _supabase = Supabase.instance.client;

  static const String _conversationsCachePrefix = 'cache_chat_conversations_v1_';
  static const String _messagesCachePrefix = 'cache_chat_messages_v1_';
  
  // Streams et subscriptions
  StreamSubscription? _messagesSubscription;
  StreamSubscription? _conversationsSubscription;
  StreamController<Message> _newMessageController = StreamController.broadcast();

  bool _realtimeInitialized = false;
  
  // Cache local
  List<Conversation> _conversations = [];
  Map<String, List<Message>> _messagesCache = {};
  Map<String, bool> _typingIndicators = {};

  Future<void> _hydrateConversationsFromPrefs(String userId) async {
    if (_conversations.isNotEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_conversationsCachePrefix$userId');
      if (raw == null || raw.trim().isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;
      _conversations = decoded
          .whereType<Map>()
          .map((e) => Conversation.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {}
  }

  Future<void> _persistConversationsToPrefs(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = jsonEncode(_conversations.map((c) => c.toJson()).toList());
      await prefs.setString('$_conversationsCachePrefix$userId', raw);
    } catch (_) {}
  }

  Future<void> _hydrateMessagesFromPrefs(String userId, String conversationId) async {
    if (_messagesCache.containsKey(conversationId)) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_messagesCachePrefix$userId:$conversationId');
      if (raw == null || raw.trim().isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;
      _messagesCache[conversationId] = decoded
          .whereType<Map>()
          .map((e) => Message.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {}
  }

  Future<void> _persistMessagesToPrefs(String userId, String conversationId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final messages = _messagesCache[conversationId] ?? const <Message>[];
      final raw = jsonEncode(messages.map((m) => m.toJson()).toList());
      await prefs.setString('$_messagesCachePrefix$userId:$conversationId', raw);
    } catch (_) {}
  }
  
  // Getters
  List<Conversation> get conversations => _conversations;
  int get unreadCount => _conversations.where((c) => c.unreadCount > 0).length;
  Stream<Message> get newMessageStream => _newMessageController.stream;
  
  // Logging robuste
  void _log(String message, {String level = 'INFO'}) {
    final timestamp = DateTime.now().toIso8601String();
    final icon = '🔷';
    final logMessage = '$icon [$timestamp] [MessagingService.$level] $message';
    debugPrint(logMessage);
    
    // Enregistrer les erreurs critiques pour debug
    if (level == 'ERROR') {
      debugPrint('STACK TRACE: ${StackTrace.current}');
    }
  }

  // Initialisation du service
  Future<void> initialize() async {
    _log('Initialisation du service de messagerie');
    
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId != null) {
        await _hydrateConversationsFromPrefs(userId);
        if (_conversations.isNotEmpty) notifyListeners();
      }
      await loadConversations();
      _ensureRealtimeListeners();
      _log('Service de messagerie initialisé avec succès', level: 'SUCCESS');
    } catch (e, stackTrace) {
      _log('Erreur initialisation: $e\n$stackTrace', level: 'ERROR');
      rethrow;
    }
  }

  void _ensureRealtimeListeners() {
    if (_realtimeInitialized) return;
    _realtimeInitialized = true;
    _initializeRealtimeListeners();
  }

  // Charger les conversations
  Future<void> loadConversations() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) {
      _log('Utilisateur non connecté', level: 'WARNING');
      return;
    }

    await _hydrateConversationsFromPrefs(userId);
    if (_conversations.isNotEmpty) notifyListeners();

    _ensureRealtimeListeners();

    try {
      _log('Chargement des conversations pour user: $userId');
      _log('Table utilisée: chat_conversations');
      _log('Colonnes demandées: id, user_id, admin_id, status, created_at, updated_at');

      final DateTime? lastUpdated = _conversations.isEmpty
          ? null
          : _conversations
              .map((c) => c.updatedAt)
              .reduce((a, b) => a.isAfter(b) ? a : b);
      
      // Requête simplifiée pour éviter les erreurs de colonnes
      var query = _supabase
          .from('chat_conversations')
          .select('''
            id,
            user_id,
            admin_id, 
            status,
            created_at,
            updated_at
          ''')
          .eq('user_id', userId);

      if (lastUpdated != null) {
        query = query.gt('updated_at', lastUpdated.toIso8601String());
      }

      final response = await query.order('created_at', ascending: false);

      _log('Réponse reçue: ${response.runtimeType}');
      
      if (response == null) {
        _log('Réponse nulle reçue de Supabase', level: 'WARNING');
        _conversations = _conversations;
      } else {
        _log('Nombre d\'éléments reçus: ${(response as List).length}');

        final incoming = (response as List)
            .map((data) {
              _log('Parsing conversation: ${data['id']}');
              return Conversation.fromJson(data);
            })
            .toList();

        final byId = <String, Conversation>{
          for (final c in _conversations) c.id: c,
        };
        for (final c in incoming) {
          byId[c.id] = c;
        }
        _conversations = byId.values.toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      }
      
      _log('${_conversations.length} conversations chargées', level: 'SUCCESS');
      await _persistConversationsToPrefs(userId);
      notifyListeners();
    } catch (e, stackTrace) {
      _log('Erreur chargement conversations: $e', level: 'ERROR');
      _log('Type d\'erreur: ${e.runtimeType}', level: 'ERROR');
      if (e.toString().contains('PGRST')) {
        _log('Erreur PostgreSQL détectée - vérifier le schéma de la table', level: 'ERROR');
      }
      _log('Stack trace: $stackTrace', level: 'ERROR');
      rethrow;
    }
  }

  // Créer ou récupérer une conversation
  Future<Conversation> getOrCreateConversation({
    String? orderId,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Non connecté');

    try {
      _log('Création/récupération conversation - Order: $orderId');
      
      // Vérifier si une conversation existe déjà
      if (orderId != null) {
        final existing = _conversations.firstWhere(
          (c) => c.orderId == orderId,
          orElse: () => Conversation.empty(),
        );
        
        if (existing.id.isNotEmpty) {
          _log('Conversation existante trouvée: ${existing.id}');
          return existing;
        }
      }

      // Créer nouvelle conversation
      _log('Création nouvelle conversation');
      _log('Colonnes à insérer: user_id, status');
      
      final data = {
        'user_id': userId,
        'status': 'active',
      };
      
      _log('Données à insérer: $data');

      final response = await _supabase
          .from('chat_conversations')
          .insert(data)
          .select('id, user_id, admin_id, status, created_at, updated_at')
          .single();
      
      _log('Conversation créée avec succès: $response');

      final newConversation = Conversation.fromJson(response);
      _conversations.insert(0, newConversation);
      
      _log('Nouvelle conversation créée: ${newConversation.id}', level: 'SUCCESS');
      notifyListeners();
      
      return newConversation;
    } catch (e, stackTrace) {
      _log('Erreur création conversation: $e', level: 'ERROR');
      _log('Type d\'erreur: ${e.runtimeType}', level: 'ERROR');
      if (e.toString().contains('PGRST204')) {
        _log('Colonne manquante détectée dans la requête', level: 'ERROR');
      }
      if (e.toString().contains('PGRST205')) {
        _log('Table manquante détectée dans la requête', level: 'ERROR');
      }
      _log('Stack trace: $stackTrace', level: 'ERROR');
      rethrow;
    }
  }

  // Charger les messages d'une conversation
  Future<List<Message>> loadMessages(String conversationId) async {
    try {
      _log('Chargement messages pour conversation: $conversationId');
      _log('Table utilisée: chat_messages');

      final userId = _supabase.auth.currentUser?.id;
      if (userId != null) {
        await _hydrateMessagesFromPrefs(userId, conversationId);
      }
      
      // Vérifier le cache
      if (_messagesCache.containsKey(conversationId)) {
        _log('Messages trouvés dans le cache (peut être complété incrémentalement)');
      }

      final existing = _messagesCache[conversationId] ?? <Message>[];
      final DateTime? lastCreatedAt = existing.isEmpty
          ? null
          : existing.map((m) => m.createdAt).reduce((a, b) => a.isAfter(b) ? a : b);

      _log('Requête des messages depuis Supabase');
      _log('Colonnes demandées: id, conversation_id, sender_id, message, is_read, created_at');
      
      // Requête simplifiée pour éviter les erreurs
      var query = _supabase
          .from('chat_messages')
          .select('''
            id,
            conversation_id,
            sender_id,
            message,
            is_read,
            created_at
          ''')
          .eq('conversation_id', conversationId);

      if (lastCreatedAt != null) {
        query = query.gt('created_at', lastCreatedAt.toIso8601String());
      }

      final response = await query.order('created_at', ascending: true);

      _log('Réponse reçue: ${response.runtimeType}');
      
      if (response == null) {
        _log('Réponse nulle reçue', level: 'WARNING');
        return existing;
      }
      
      final messages = (response as List)
          .map((data) {
            _log('Parsing message: ${data['id']}');
            return Message.fromJson(data);
          })
          .toList();
      
      // Mettre en cache (merge)
      final byId = <String, Message>{
        for (final m in existing) m.id: m,
      };
      for (final m in messages) {
        byId[m.id] = m;
      }
      final merged = byId.values.toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));
      _messagesCache[conversationId] = merged;

      if (userId != null) {
        await _persistMessagesToPrefs(userId, conversationId);
      }
      
      _log('${_messagesCache[conversationId]!.length} messages chargés', level: 'SUCCESS');
      return _messagesCache[conversationId]!;
    } catch (e, stackTrace) {
      _log('Erreur chargement messages: $e', level: 'ERROR');
      _log('Type d\'erreur: ${e.runtimeType}', level: 'ERROR');
      if (e.toString().contains('PGRST')) {
        _log('Erreur PostgreSQL détectée', level: 'ERROR');
      }
      _log('Stack trace: $stackTrace', level: 'ERROR');
      return _messagesCache[conversationId] ?? <Message>[];
    }
  }

  // Envoyer un message
  Future<void> sendMessage({
    required String conversationId,
    required String content,
    String messageType = 'text',
    Map<String, dynamic>? metadata,
    List<String>? attachmentUrls,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Non connecté');

    try {
      _log('Envoi message dans conversation: $conversationId');
      _log('Contenu: $content');
      _log('Type: $messageType');
      _log('Sender: $userId');

      // Créer le message avec les colonnes existantes uniquement
      final messageData = {
        'conversation_id': conversationId,
        'sender_id': userId,
        'message': content,
        'is_read': false,
      };
      
      _log('Données du message à insérer: $messageData');

      // Mettre à jour updated_at au lieu de last_message_at qui n'existe pas
      await _supabase
          .from('chat_conversations')
          .update({'updated_at': DateTime.now().toIso8601String()})
          .eq('id', conversationId);
      
      _log('Conversation mise à jour avec succès');

      final response = await _supabase
          .from('chat_messages')
          .insert(messageData)
          .select('id, conversation_id, sender_id, message, is_read, created_at')
          .single();
      
      _log('Message envoyé avec succès: ${response['id']}');

      final newMessage = Message.fromJson(response);

      // Ajouter les pièces jointes si présentes
      if (attachmentUrls != null && attachmentUrls.isNotEmpty) {
        for (final url in attachmentUrls) {
          await _supabase.from('message_attachments').insert({
            'message_id': newMessage.id,
            'file_url': url,
            'file_name': url.split('/').last,
          });
        }
      }

      // Mettre à jour le cache - NE PAS émettre l'événement ici
      // car le listener realtime va le faire
      _messagesCache.putIfAbsent(conversationId, () => <Message>[]);
      if (_messagesCache[conversationId]!.indexWhere((m) => m.id == newMessage.id) == -1) {
        _messagesCache[conversationId]!.add(newMessage);
        _messagesCache[conversationId]!.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      }

      if (userId != null) {
        await _persistMessagesToPrefs(userId, conversationId);
      }
      
      _log('Message envoyé avec succès: ${newMessage.id}', level: 'SUCCESS');
      notifyListeners();
    } catch (e, stackTrace) {
      _log('Erreur envoi message: $e', level: 'ERROR');
      _log('Type d\'erreur: ${e.runtimeType}', level: 'ERROR');
      if (e.toString().contains('violates foreign key constraint')) {
        _log('Erreur de clé étrangère - vérifier conversation_id et sender_id', level: 'ERROR');
      }
      _log('Stack trace: $stackTrace', level: 'ERROR');
      rethrow;
    }
  }

  // Marquer des messages comme lus
  Future<void> markMessagesAsRead(List<String> messageIds) async {
    if (messageIds.isEmpty) return;
    
    try {
      _log('Marquage ${messageIds.length} messages comme lus');
      _log('IDs des messages: ${messageIds.join(', ')}');
      
      // Utiliser uniquement is_read car read_at n'existe peut-être pas
      await _supabase
          .from('chat_messages')
          .update({'is_read': true})
          .inFilter('id', messageIds);
      
      _log('Messages marqués comme lus', level: 'SUCCESS');
    } catch (e) {
      _log('Erreur marquage messages: $e', level: 'ERROR');
    }
  }

  // Initialiser les listeners temps réel
  void _initializeRealtimeListeners() {
    _log('Initialisation listeners Realtime');
    
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) {
      _log('Utilisateur non connecté - pas de listeners', level: 'WARNING');
      return;
    }

    try {
      _log('Configuration listener pour chat_messages');
      
      // Listener pour nouveaux messages
      _messagesSubscription = _supabase
          .from('chat_messages')
          .stream(primaryKey: ['id'])
          .listen((List<Map<String, dynamic>> data) {
        _log('Événement Realtime reçu: ${data.length} messages');
        
        for (final messageData in data) {
          try {
            final message = Message.fromJson(messageData);
            
            // Mettre à jour le cache
            final conversationId = message.conversationId;
            if (_messagesCache.containsKey(conversationId)) {
              final existingIndex = _messagesCache[conversationId]!
                  .indexWhere((m) => m.id == message.id);
              
              if (existingIndex == -1) {
                _messagesCache[conversationId]!.add(message);
                _messagesCache[conversationId]!
                    .sort((a, b) => a.createdAt.compareTo(b.createdAt));
                _newMessageController.add(message);
                _log('Nouveau message ajouté: ${message.id}', level: 'SUCCESS');

                final uid = _supabase.auth.currentUser?.id;
                if (uid != null) {
                  _persistMessagesToPrefs(uid, conversationId);
                }
              }
            }
          } catch (e) {
            _log('Erreur parsing message realtime: $e', level: 'ERROR');
          }
        }
        
        notifyListeners();
      }, onError: (error) {
        _log('Erreur listener messages: $error', level: 'ERROR');
        _log('Détails erreur: ${error.runtimeType}', level: 'ERROR');
      });

      _log('Configuration listener pour chat_conversations');
      
      // Listener pour changements dans les conversations  
      _conversationsSubscription = _supabase
          .from('chat_conversations')
          .stream(primaryKey: ['id'])
          .eq('user_id', userId)
          .listen((List<Map<String, dynamic>> data) {
        _log('Mise à jour conversations: ${data.length} conversations');
        loadConversations();
      }, onError: (error) {
        _log('Erreur listener conversations: $error', level: 'ERROR');
        _log('Détails erreur: ${error.runtimeType}', level: 'ERROR');
      });
      
      _log('Listeners Realtime initialisés', level: 'SUCCESS');
    } catch (e) {
      _log('Erreur initialisation listeners: $e', level: 'ERROR');
      _log('Type erreur: ${e.runtimeType}', level: 'ERROR');
    }
  }

  // Indicateur de frappe
  void setTypingIndicator(String conversationId, bool isTyping) {
    _typingIndicators[conversationId] = isTyping;
    _log('Indicateur frappe - ConvId: $conversationId, Typing: $isTyping');
    notifyListeners();
  }

  Future<String?> uploadChatImage({
    required String conversationId,
    required XFile imageFile,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Non connecté');

    try {
      final bytes = await imageFile.readAsBytes();

      final name = imageFile.name.trim().isEmpty ? 'image.jpg' : imageFile.name.trim();
      final dot = name.lastIndexOf('.');
      final ext = (dot >= 0 && dot < name.length - 1) ? name.substring(dot + 1).toLowerCase() : 'jpg';
      final safeExt = (ext.length <= 5) ? ext : 'jpg';

      final objectPath = '$userId/$conversationId/${DateTime.now().millisecondsSinceEpoch}.$safeExt';
      await _supabase.storage.from('chat').uploadBinary(
            objectPath,
            bytes,
            fileOptions: const FileOptions(
              cacheControl: '3600',
              upsert: true,
            ),
          );
      return _supabase.storage.from('chat').getPublicUrl(objectPath);
    } catch (e, stackTrace) {
      _log('Erreur upload image chat: $e\n$stackTrace', level: 'ERROR');
      return null;
    }
  }

  bool isUserTyping(String conversationId) {
    return _typingIndicators[conversationId] ?? false;
  }

  // Nettoyage
  @override
  void dispose() {
    _log('Nettoyage du service de messagerie');
    _messagesSubscription?.cancel();
    _conversationsSubscription?.cancel();
    _newMessageController.close();
    super.dispose();
  }
}

// Les modèles sont maintenant dans lib/models/conversation.dart

class MessageAttachment {
  final String id;
  final String messageId;
  final String fileName;
  final String? fileType;
  final int? fileSize;
  final String fileUrl;
  final String? thumbnailUrl;

  MessageAttachment({
    required this.id,
    required this.messageId,
    required this.fileName,
    this.fileType,
    this.fileSize,
    required this.fileUrl,
    this.thumbnailUrl,
  });

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    return MessageAttachment(
      id: json['id'],
      messageId: json['message_id'],
      fileName: json['file_name'],
      fileType: json['file_type'],
      fileSize: json['file_size'],
      fileUrl: json['file_url'],
      thumbnailUrl: json['thumbnail_url'],
    );
  }
}
