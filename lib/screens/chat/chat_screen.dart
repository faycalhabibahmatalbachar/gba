import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../services/messaging_service.dart';
import '../../widgets/app_drawer.dart';
import '../../models/conversation.dart';

class ChatScreen extends StatefulWidget {
  final String? conversationId;
  final String? orderId;

  const ChatScreen({
    Key? key,
    this.conversationId,
    this.orderId,
  }) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with TickerProviderStateMixin {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();
  
  late AnimationController _sendButtonController;
  late Animation<double> _sendButtonAnimation;
  late AnimationController _typingIndicatorController;
  
  List<Message> _messages = [];
  Conversation? _conversation;
  bool _isLoading = true;
  bool _isSending = false;
  bool _isTyping = false;
  
  @override
  void initState() {
    super.initState();
    _initAnimations();
    _loadConversation();
    _messageController.addListener(_onTypingChanged);
  }

  void _initAnimations() {
    _sendButtonController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _sendButtonAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _sendButtonController,
      curve: Curves.elasticOut,
    ));
    
    _typingIndicatorController = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    )..repeat();
  }

  void _onTypingChanged() {
    final hasText = _messageController.text.trim().isNotEmpty;
    if (hasText && !_isTyping) {
      _isTyping = true;
      _sendButtonController.forward();
      // Notifier le service que l'utilisateur tape
      if (_conversation != null) {
        context.read<MessagingService>().setTypingIndicator(_conversation!.id, true);
      }
    } else if (!hasText && _isTyping) {
      _isTyping = false;
      _sendButtonController.reverse();
      if (_conversation != null) {
        context.read<MessagingService>().setTypingIndicator(_conversation!.id, false);
      }
    }
  }

  Future<void> _loadConversation() async {
    try {
      final messagingService = context.read<MessagingService>();
      
      if (widget.conversationId != null) {
        // Charger conversation existante
        _conversation = messagingService.conversations
            .firstWhere((c) => c.id == widget.conversationId!);
      } else {
        // Créer nouvelle conversation
        _conversation = await messagingService.getOrCreateConversation(
          orderId: widget.orderId,
        );
      }
      
      // Charger les messages
      _messages = await messagingService.loadMessages(_conversation!.id);
      
      // Marquer comme lus
      await messagingService.markMessagesAsRead([_conversation!.id]);
      
      setState(() {
        _isLoading = false;
      });
      
      // Scroll vers le bas
      _scrollToBottom();
      
      // Écouter les nouveaux messages
      messagingService.newMessageStream.listen((message) {
        if (message.conversationId == _conversation!.id) {
          setState(() {
            _messages.add(message);
          });
          _scrollToBottom();
        }
      });
    } catch (e) {
      print('❌ Erreur chargement conversation: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _conversation == null) return;
    
    setState(() {
      _isSending = true;
    });
    
    // Vibration feedback
    HapticFeedback.lightImpact();
    
    try {
      await Provider.of<MessagingService>(context, listen: false).sendMessage(
        conversationId: _conversation!.id,
        content: text,
      );
      
      _messageController.clear();
      _focusNode.requestFocus();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erreur envoi: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isSending = false;
      });
    }
  }

  Future<void> _pickImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
    
    if (image != null) {
      // TODO: Upload image to Supabase Storage and send as attachment
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Envoi d\'images bientôt disponible'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Theme.of(context).primaryColor.withOpacity(0.05),
              Colors.white,
            ],
          ),
        ),
        child: Column(
          children: [
            if (_isLoading)
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(),
                ),
              )
            else
              Expanded(
                child: _buildMessagesList(),
              ),
            _buildMessageInput(),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      elevation: 0,
      flexibleSpace: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Theme.of(context).primaryColor,
              Theme.of(context).primaryColor.withOpacity(0.8),
            ],
          ),
        ),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Support Client',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          if (_conversation != null)
            Text(
              widget.orderId != null 
                  ? 'Commande #${widget.orderId}'
                  : 'Conversation #${_conversation!.id.substring(0, 8)}',
              style: TextStyle(
                fontSize: 12,
                color: Colors.white.withOpacity(0.9),
              ),
            ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.info_outline, color: Colors.white),
          onPressed: () {
            _showConversationInfo();
          },
        ),
      ],
    );
  }

  Widget _buildMessagesList() {
    if (_messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.chat_bubble_outline,
              size: 80,
              color: Colors.grey[300],
            ),
            const SizedBox(height: 16),
            Text(
              'Commencez la conversation',
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Nous sommes là pour vous aider',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final message = _messages[index];
        final isMe = message.senderType == 'customer';
        final showDate = index == 0 || 
            !_isSameDay(_messages[index - 1].createdAt, message.createdAt);

        return Column(
          children: [
            if (showDate)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _formatDate(message.createdAt),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[700],
                    ),
                  ),
                ),
              ),
            _buildMessageBubble(message, isMe),
          ],
        );
      },
    );
  }

  Widget _buildMessageBubble(Message message, bool isMe) {
    return Padding(
      padding: EdgeInsets.only(
        left: isMe ? 50 : 0,
        right: isMe ? 0 : 50,
        bottom: 8,
      ),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: Theme.of(context).primaryColor,
              child: const Icon(
                Icons.support_agent,
                size: 20,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              padding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                gradient: isMe
                    ? LinearGradient(
                        colors: [
                          Theme.of(context).primaryColor,
                          Theme.of(context).primaryColor.withOpacity(0.9),
                        ],
                      )
                    : null,
                color: isMe ? null : Colors.grey[100],
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(20),
                  topRight: const Radius.circular(20),
                  bottomLeft: Radius.circular(isMe ? 20 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 20),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 5,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.content ?? message.message,
                    style: TextStyle(
                      fontSize: 15,
                      color: isMe ? Colors.white : Colors.black87,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        DateFormat('HH:mm').format(message.createdAt),
                        style: TextStyle(
                          fontSize: 11,
                          color: isMe 
                              ? Colors.white.withOpacity(0.7)
                              : Colors.grey[600],
                        ),
                      ),
                      if (isMe) ...[
                        const SizedBox(width: 4),
                        Icon(
                          message.isRead 
                              ? Icons.done_all 
                              : Icons.done,
                          size: 14,
                          color: message.isRead
                              ? Colors.blue[300]
                              : Colors.white.withOpacity(0.7),
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
    );
  }

  Widget _buildMessageInput() {
    return Container(
      padding: const EdgeInsets.all(12),
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
      child: SafeArea(
        child: Row(
          children: [
            IconButton(
              icon: Icon(
                Icons.attach_file,
                color: Theme.of(context).primaryColor,
              ),
              onPressed: _pickImage,
            ),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(25),
                ),
                child: TextField(
                  controller: _messageController,
                  focusNode: _focusNode,
                  maxLines: null,
                  keyboardType: TextInputType.multiline,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Tapez votre message...',
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            AnimatedBuilder(
              animation: _sendButtonAnimation,
              builder: (context, child) {
                return Transform.scale(
                  scale: 0.8 + (_sendButtonAnimation.value * 0.2),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: _messageController.text.trim().isNotEmpty
                          ? LinearGradient(
                              colors: [
                                Theme.of(context).primaryColor,
                                Theme.of(context).primaryColor.withOpacity(0.8),
                              ],
                            )
                          : null,
                      color: _messageController.text.trim().isEmpty
                          ? Colors.grey[300]
                          : null,
                    ),
                    child: IconButton(
                      icon: _isSending
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(
                              Icons.send,
                              color: Colors.white,
                            ),
                      onPressed: _messageController.text.trim().isNotEmpty && !_isSending
                          ? _sendMessage
                          : null,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showConversationInfo() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.info,
                    color: Theme.of(context).primaryColor,
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Informations de la conversation',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _buildInfoRow('ID', _conversation?.id ?? 'N/A'),
              _buildInfoRow('Statut', _conversation?.status ?? 'N/A'),
              _buildInfoRow('Priorité', _conversation?.priority ?? 'normal'),
              if (_conversation?.orderId != null)
                _buildInfoRow('Commande', '#${_conversation!.orderId}'),
              _buildInfoRow(
                'Créée le',
                _conversation != null
                    ? DateFormat('dd/MM/yyyy HH:mm').format(_conversation!.createdAt)
                    : 'N/A',
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 14,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    if (_isSameDay(date, now)) {
      return "Aujourd'hui";
    } else if (_isSameDay(date, now.subtract(const Duration(days: 1)))) {
      return "Hier";
    } else {
      return DateFormat('dd MMMM yyyy', 'fr').format(date);
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    _sendButtonController.dispose();
    _typingIndicatorController.dispose();
    super.dispose();
  }
}
