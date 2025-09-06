import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class AdminChatScreen extends StatefulWidget {
  const AdminChatScreen({Key? key}) : super(key: key);

  @override
  State<AdminChatScreen> createState() => _AdminChatScreenState();
}

class _AdminChatScreenState extends State<AdminChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final supabase = Supabase.instance.client;
  
  static const String ADMIN_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  
  List<Map<String, dynamic>> _messages = [];
  String? _conversationId;
  bool _isLoading = true;
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    _loadOrCreateConversation();
  }

  Future<void> _loadOrCreateConversation() async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) {
        throw Exception('Utilisateur non connecté');
      }

      // Chercher une conversation existante avec l'admin
      final existingConv = await supabase
          .from('chat_conversations')
          .select()
          .eq('user_id', userId)
          .eq('admin_id', ADMIN_ID)
          .maybeSingle();

      if (existingConv != null) {
        _conversationId = existingConv['id'];
      } else {
        // Créer une nouvelle conversation
        final newConv = await supabase
            .from('chat_conversations')
            .insert({
              'user_id': userId,
              'admin_id': ADMIN_ID,
              'status': 'active',
              'created_at': DateTime.now().toIso8601String(),
              'updated_at': DateTime.now().toIso8601String(),
            })
            .select()
            .single();
        
        _conversationId = newConv['id'];
      }

      await _loadMessages();
      _setupRealtimeSubscription();
    } catch (e) {
      print('Erreur lors du chargement de la conversation: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMessages() async {
    if (_conversationId == null) return;

    try {
      final messages = await supabase
          .from('chat_messages')
          .select()
          .eq('conversation_id', _conversationId!)
          .order('created_at', ascending: true);

      setState(() {
        _messages = List<Map<String, dynamic>>.from(messages);
      });

      _scrollToBottom();
    } catch (e) {
      print('Erreur lors du chargement des messages: $e');
    }
  }

  void _setupRealtimeSubscription() {
    if (_conversationId == null) return;

    supabase
        .channel('admin_messages')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'chat_messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: _conversationId,
          ),
          callback: (payload) {
            setState(() {
              _messages.add(payload.newRecord);
            });
            _scrollToBottom();
            
            // Marquer comme lu si c'est un message de l'admin
            if (payload.newRecord['sender_id'] == ADMIN_ID) {
              _markAsRead(payload.newRecord['id']);
            }
          },
        )
        .subscribe();
  }

  Future<void> _markAsRead(String messageId) async {
    try {
      await supabase
          .from('chat_messages')
          .update({'is_read': true})
          .eq('id', messageId);
    } catch (e) {
      print('Erreur marquage lu: $e');
    }
  }

  Future<void> _sendMessage() async {
    if (_messageController.text.trim().isEmpty || _conversationId == null) return;

    final messageText = _messageController.text.trim();
    _messageController.clear();

    setState(() => _isSending = true);

    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) throw Exception('Utilisateur non connecté');

      await supabase.from('chat_messages').insert({
        'conversation_id': _conversationId,
        'sender_id': userId,
        'message': messageText,
        'is_read': false,
        'created_at': DateTime.now().toIso8601String(),
      });

      // Mettre à jour l'heure de dernière activité
      await supabase
          .from('chat_conversations')
          .update({'updated_at': DateTime.now().toIso8601String()})
          .eq('id', _conversationId!);

    } catch (e) {
      print('Erreur envoi message: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur lors de l\'envoi: $e')),
      );
      _messageController.text = messageText; // Restaurer le message
    } finally {
      setState(() => _isSending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _formatTime(String dateStr) {
    final date = DateTime.parse(dateStr);
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) {
      return DateFormat('HH:mm').format(date);
    } else if (diff.inDays == 1) {
      return 'Hier ${DateFormat('HH:mm').format(date)}';
    } else if (diff.inDays < 7) {
      return DateFormat('EEEE HH:mm', 'fr_FR').format(date);
    } else {
      return DateFormat('dd/MM/yyyy HH:mm').format(date);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = supabase.auth.currentUser?.id;

    return Scaffold(
      appBar: AppBar(
        elevation: 2,
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        title: Row(
          children: [
            // Icône Admin
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.admin_panel_settings,
                color: Colors.orange.shade700,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Support Admin',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  'Service client disponible',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.orange.shade50,
              Colors.white,
            ],
          ),
        ),
        child: Column(
          children: [
            // Zone des messages
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _messages.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.support_agent,
                                size: 80,
                                color: Colors.grey[300],
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'Démarrez une conversation',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey[600],
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Notre équipe est là pour vous aider',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[500],
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final msg = _messages[index];
                            final isMe = msg['sender_id'] == userId;
                            final isAdmin = msg['sender_id'] == ADMIN_ID;

                            return Align(
                              alignment: isMe
                                  ? Alignment.centerRight
                                  : Alignment.centerLeft,
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    if (isAdmin) ...[
                                      Container(
                                        width: 32,
                                        height: 32,
                                        decoration: BoxDecoration(
                                          color: Colors.orange.shade200,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          Icons.support_agent,
                                          size: 20,
                                          color: Colors.orange.shade700,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                    ],
                                    Flexible(
                                      child: Container(
                                        constraints: BoxConstraints(
                                          maxWidth: MediaQuery.of(context).size.width * 0.7,
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 16,
                                          vertical: 10,
                                        ),
                                        decoration: BoxDecoration(
                                          color: isMe
                                              ? Theme.of(context).primaryColor
                                              : isAdmin
                                                  ? Colors.orange.shade100
                                                  : Colors.grey[200],
                                          borderRadius: BorderRadius.only(
                                            topLeft: const Radius.circular(18),
                                            topRight: const Radius.circular(18),
                                            bottomLeft: Radius.circular(isMe ? 18 : 4),
                                            bottomRight: Radius.circular(isMe ? 4 : 18),
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              msg['message'] ?? '',
                                              style: TextStyle(
                                                color: isMe
                                                    ? Colors.white
                                                    : Colors.black87,
                                                fontSize: 15,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  _formatTime(msg['created_at']),
                                                  style: TextStyle(
                                                    color: isMe
                                                        ? Colors.white70
                                                        : Colors.grey[600],
                                                    fontSize: 11,
                                                  ),
                                                ),
                                                if (isMe) ...[
                                                  const SizedBox(width: 4),
                                                  Icon(
                                                    msg['is_read'] == true
                                                        ? Icons.done_all
                                                        : Icons.done,
                                                    size: 14,
                                                    color: Colors.white70,
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),

            // Zone de saisie
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      maxLines: null,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: InputDecoration(
                        hintText: 'Tapez votre message...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(25),
                          borderSide: BorderSide.none,
                        ),
                        filled: true,
                        fillColor: Colors.grey[100],
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 10,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: _isSending
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Icon(Icons.send, color: Colors.white),
                      onPressed: _isSending ? null : _sendMessage,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}
