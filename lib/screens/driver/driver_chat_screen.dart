import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Chat screen for drivers to communicate with customers about their orders.
/// Uses the same `chat_conversations` and `chat_messages` tables as the
/// client app and the web admin `PremiumAdminChat.jsx`.
class DriverChatScreen extends StatefulWidget {
  /// The customer's user ID to open or create a conversation with.
  final String customerId;

  /// Optional label (name) to display in the app bar.
  final String? customerName;

  /// Optional order context to reference in the conversation.
  final String? orderId;

  const DriverChatScreen({
    super.key,
    required this.customerId,
    this.customerName,
    this.orderId,
  });

  @override
  State<DriverChatScreen> createState() => _DriverChatScreenState();
}

class _DriverChatScreenState extends State<DriverChatScreen> {
  final _supabase = Supabase.instance.client;
  final _messageCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  String? _conversationId;
  List<Map<String, dynamic>> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  StreamSubscription? _messagesSub;

  static const _purple = Color(0xFF667eea);
  static const _violet = Color(0xFF764ba2);

  @override
  void initState() {
    super.initState();
    _initConversation();
  }

  @override
  void dispose() {
    _messageCtrl.dispose();
    _scrollCtrl.dispose();
    _messagesSub?.cancel();
    super.dispose();
  }

  /// Find or open the customer's existing support conversation.
  /// The driver joins the same conversation the customer has with support.
  Future<void> _initConversation() async {
    final driverId = _supabase.auth.currentUser?.id;
    if (driverId == null) return;

    setState(() => _isLoading = true);

    try {
      // Look for the customer's existing conversation (user_id = customerId)
      final existing = await _supabase
          .from('chat_conversations')
          .select('id')
          .eq('user_id', widget.customerId)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (existing != null) {
        _conversationId = existing['id'].toString();
        debugPrint('[DriverChat] found existing conv: $_conversationId');
      } else {
        // Create a conversation on behalf of the customer
        final result = await _supabase.from('chat_conversations').insert({
          'user_id': widget.customerId,
          'status': 'active',
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        }).select('id').single();
        _conversationId = result['id'].toString();
        debugPrint('[DriverChat] created conv: $_conversationId');
      }

      await _loadMessages();
      _subscribeToMessages();
    } catch (e) {
      debugPrint('[DriverChat] init error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMessages() async {
    if (_conversationId == null) return;
    try {
      final data = await _supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', _conversationId!)
          .order('created_at', ascending: true)
          .limit(200);

      if (mounted) {
        setState(() => _messages = List<Map<String, dynamic>>.from(data));
        _scrollToBottom();
      }
    } catch (e) {
      debugPrint('[DriverChat] load error: $e');
    }
  }

  void _subscribeToMessages() {
    if (_conversationId == null) return;
    _messagesSub = _supabase
        .from('chat_messages')
        .stream(primaryKey: ['id'])
        .eq('conversation_id', _conversationId!)
        .listen((data) {
      if (mounted) {
        setState(() {
          _messages = List<Map<String, dynamic>>.from(data)
            ..sort((a, b) =>
                (a['created_at'] ?? '').compareTo(b['created_at'] ?? ''));
        });
        _scrollToBottom();
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageCtrl.text.trim();
    if (text.isEmpty || _conversationId == null) return;

    final driverId = _supabase.auth.currentUser?.id;
    if (driverId == null) return;

    setState(() => _isSending = true);
    _messageCtrl.clear();

    try {
      await _supabase.from('chat_messages').insert({
        'conversation_id': _conversationId,
        'sender_id': driverId,
        'message': text,
        'is_read': false,
      });

      // Update conversation timestamp
      await _supabase.from('chat_conversations').update({
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('id', _conversationId!);

      HapticFeedback.lightImpact();
    } catch (e) {
      debugPrint('[DriverChat] send error: $e');
      _messageCtrl.text = text; // restore on failure
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final driverId = _supabase.auth.currentUser?.id;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [_purple, _violet]),
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.person, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.customerName ?? 'Client',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (widget.orderId != null)
                    Text(
                      'Commande #${widget.orderId!.length > 8 ? widget.orderId!.substring(0, 8).toUpperCase() : widget.orderId}',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.75),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: _purple))
          : Column(
              children: [
                // Messages list
                Expanded(
                  child: _messages.isEmpty
                      ? _buildEmptyChat()
                      : ListView.builder(
                          controller: _scrollCtrl,
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final msg = _messages[index];
                            final isMe = msg['sender_id'] == driverId;
                            return _MessageBubble(
                              text: msg['message'] ?? msg['content'] ?? '',
                              isMe: isMe,
                              time: DateTime.tryParse(
                                      msg['created_at'] ?? '') ??
                                  DateTime.now(),
                            );
                          },
                        ),
                ),

                // Input bar
                _buildInputBar(),
              ],
            ),
    );
  }

  Widget _buildEmptyChat() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    _purple.withValues(alpha: 0.15),
                    _violet.withValues(alpha: 0.15),
                  ],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.chat_bubble_outline,
                  size: 40, color: _purple),
            ),
            const SizedBox(height: 20),
            const Text(
              'Démarrer la conversation',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Envoyez un message au client concernant sa commande.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 8, 8, MediaQuery.of(context).padding.bottom + 8),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _messageCtrl,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _sendMessage(),
                maxLines: 3,
                minLines: 1,
                decoration: const InputDecoration(
                  hintText: 'Écrire un message…',
                  border: InputBorder.none,
                  hintStyle: TextStyle(color: Colors.grey),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _isSending ? null : _sendMessage,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_purple, _violet]),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: _purple.withValues(alpha: 0.4),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: _isSending
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Message bubble ───────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final String text;
  final bool isMe;
  final DateTime time;

  const _MessageBubble({
    required this.text,
    required this.isMe,
    required this.time,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          gradient: isMe
              ? const LinearGradient(
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)])
              : null,
          color: isMe ? null : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(isMe ? 18 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 18),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              text,
              style: TextStyle(
                color: isMe ? Colors.white : const Color(0xFF2D3436),
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
              style: TextStyle(
                color: isMe
                    ? Colors.white.withValues(alpha: 0.7)
                    : Colors.grey.shade400,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
