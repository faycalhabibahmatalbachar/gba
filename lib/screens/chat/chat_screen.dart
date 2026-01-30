import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import '../../localization/app_localizations.dart';
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
  
  // Subscription pour éviter l'erreur setState après dispose
  var _messageSubscription;
  
  @override
  void initState() {
    super.initState();
    _initAnimations();
    _loadConversation();
    _messageController.addListener(_onTypingChanged);
  }

  Future<void> _shareUrl(String url) async {
    try {
      await Share.share(url);
    } catch (e) {
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              localizations.translateParams(
                'share_unavailable_with_details',
                {'error': e.toString()},
              ),
            ),
          ),
        );
      }
    }
  }

  Future<void> _copyToClipboard(String text) async {
    try {
      await Clipboard.setData(ClipboardData(text: text));
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(localizations.translate('link_copied'))),
        );
      }
    } catch (e) {
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              localizations.translateParams(
                'copy_unavailable_with_details',
                {'error': e.toString()},
              ),
            ),
          ),
        );
      }
    }
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

  Future<void> _launchExternal(String url) async {
    try {
      final uri = Uri.parse(url);
      final ok = await launchUrl(
        uri,
        mode: kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication,
      );
      if (!ok && mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(localizations.translate('open_link_unavailable'))),
        );
      }
    } catch (e) {
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              localizations.translateParams(
                'error_with_details',
                {'error': e.toString()},
              ),
            ),
          ),
        );
      }
    }
  }

  void _openImageFullScreen(String imageUrl) {
    showDialog(
      context: context,
      barrierColor: Colors.black,
      builder: (context) {
        final localizations = AppLocalizations.of(context);
        return Dialog.fullscreen(
          backgroundColor: Colors.black,
          child: Scaffold(
            backgroundColor: Colors.black,
            appBar: AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              elevation: 0,
              title: Text(localizations.translate('image')),
              actions: [
                IconButton(
                  tooltip: localizations.translate('download'),
                  icon: const Icon(Icons.download_rounded),
                  onPressed: () => _launchExternal(imageUrl),
                ),
                IconButton(
                  tooltip: localizations.translate('share'),
                  icon: const Icon(Icons.share_rounded),
                  onPressed: () => _shareUrl(imageUrl),
                ),
              ],
            ),
            body: Center(
              child: InteractiveViewer(
                minScale: 0.5,
                maxScale: 4,
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.contain,
                  placeholder: (context, _) => const Center(
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    ),
                  ),
                  errorWidget: (context, _, __) => const Center(
                    child: Icon(Icons.broken_image_outlined, color: Colors.white70, size: 44),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _showImageActions(String imageUrl) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (context) {
        final localizations = AppLocalizations.of(context);
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.fullscreen_rounded),
                title: Text(localizations.translate('view_fullscreen')),
                onTap: () {
                  Navigator.of(context).pop();
                  _openImageFullScreen(imageUrl);
                },
              ),
              ListTile(
                leading: const Icon(Icons.download_rounded),
                title: Text(localizations.translate('download')),
                onTap: () {
                  Navigator.of(context).pop();
                  _launchExternal(imageUrl);
                },
              ),
              ListTile(
                leading: const Icon(Icons.share_rounded),
                title: Text(localizations.translate('share')),
                onTap: () {
                  Navigator.of(context).pop();
                  _shareUrl(imageUrl);
                },
              ),
              ListTile(
                leading: const Icon(Icons.copy_rounded),
                title: Text(localizations.translate('copy_link')),
                onTap: () {
                  Navigator.of(context).pop();
                  _copyToClipboard(imageUrl);
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
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
      final toRead = _messages
          .where((m) => !m.isRead && m.senderType != 'customer')
          .map((m) => m.id)
          .toList();
      await messagingService.markMessagesAsRead(toRead);
      
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
      
      // Scroll vers le bas
      _scrollToBottom();
      
      // Écouter les nouveaux messages (avec subscription pour cleanup)
      _messageSubscription = messagingService.newMessageStream.listen((message) {
        if (message.conversationId == _conversation!.id) {
          // Vérifier si le widget est toujours monté avant setState
          if (mounted) {
            setState(() {
              _messages.add(message);
            });
            _scrollToBottom();
          }
        }
      });
    } catch (e) {
      print('❌ Erreur chargement conversation: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
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
    
    if (mounted) {
      setState(() {
        _isSending = true;
      });
    }
    
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
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              localizations.translateParams(
                'chat_error_sending_with_details',
                {'error': e.toString()},
              ),
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
      }
    }
  }

  Future<void> _pickImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
    
    if (image != null) {
      if (_conversation == null) return;

      final localizations = AppLocalizations.of(context);

      if (mounted) {
        setState(() {
          _isSending = true;
        });
      }

      try {
        final messagingService = Provider.of<MessagingService>(context, listen: false);
        final imageUrl = await messagingService.uploadChatImage(
          conversationId: _conversation!.id,
          imageFile: image,
        );

        if (imageUrl == null || imageUrl.trim().isEmpty) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(localizations.translate('image_upload_failed')),
                backgroundColor: Colors.red,
              ),
            );
          }
          return;
        }

        await messagingService.sendMessage(
          conversationId: _conversation!.id,
          content: imageUrl,
          messageType: 'image',
          attachmentUrls: [imageUrl],
        );

        _focusNode.requestFocus();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                localizations.translateParams(
                  'chat_error_sending_image_with_details',
                  {'error': e.toString()},
                ),
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() {
            _isSending = false;
          });
        }
      }
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
    final localizations = AppLocalizations.of(context);
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
          Text(
            localizations.translate('support_client'),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          if (_conversation != null)
            Text(
              widget.orderId != null 
                  ? localizations.translateParams(
                      'order_number',
                      {'id': widget.orderId!},
                    )
                  : localizations.translateParams(
                      'conversation_number',
                      {'id': _conversation!.id.substring(0, 8)},
                    ),
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
    final localizations = AppLocalizations.of(context);
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
              localizations.translate('start_conversation'),
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              localizations.translate('we_are_here_to_help'),
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
    final contentText = (message.content ?? message.message).trim();
    final isImage = contentText.startsWith('http') &&
        (contentText.contains('/storage/v1/object/public/chat/') ||
            contentText.endsWith('.jpg') ||
            contentText.endsWith('.jpeg') ||
            contentText.endsWith('.png') ||
            contentText.endsWith('.webp') ||
            contentText.endsWith('.gif'));

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
              padding: isImage
                  ? const EdgeInsets.all(0)
                  : const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
              decoration: BoxDecoration(
                gradient: isImage
                    ? null
                    : (isMe
                        ? LinearGradient(
                            colors: [
                              Theme.of(context).primaryColor,
                              Theme.of(context).primaryColor.withOpacity(0.9),
                            ],
                          )
                        : null),
                color: isImage ? Colors.transparent : (isMe ? null : Colors.grey[100]),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(20),
                  topRight: const Radius.circular(20),
                  bottomLeft: Radius.circular(isMe ? 20 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 20),
                ),
                boxShadow: isImage
                    ? [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ]
                    : [
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
                  if (isImage)
                    GestureDetector(
                      onTap: () => _openImageFullScreen(contentText),
                      onLongPress: () => _showImageActions(contentText),
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Colors.black.withOpacity(0.12),
                            width: 1,
                          ),
                          borderRadius: BorderRadius.circular(14),
                          color: Colors.white,
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(13),
                          child: CachedNetworkImage(
                            imageUrl: contentText,
                            width: 220,
                            height: 220,
                            fit: BoxFit.cover,
                            placeholder: (context, _) => Container(
                              width: 220,
                              height: 220,
                              color: Colors.black.withOpacity(0.06),
                              child: const Center(
                                child: SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                ),
                              ),
                            ),
                            errorWidget: (context, _, __) => Container(
                              width: 220,
                              height: 220,
                              color: Colors.black.withOpacity(0.06),
                              child: const Center(
                                child: Icon(Icons.broken_image_outlined),
                              ),
                            ),
                          ),
                        ),
                      ),
                    )
                  else
                    Text(
                      contentText,
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
                          color: isImage
                              ? Colors.grey[600]
                              : (isMe ? Colors.white.withOpacity(0.7) : Colors.grey[600]),
                        ),
                      ),
                      if (isMe) ...[
                        const SizedBox(width: 4),
                        Icon(
                          message.isRead 
                              ? Icons.done_all 
                              : Icons.done,
                          size: 14,
                          color: isImage
                              ? (message.isRead ? Colors.blue[300] : Colors.grey[600])
                              : (message.isRead ? Colors.blue[300] : Colors.white.withOpacity(0.7)),
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
    final localizations = AppLocalizations.of(context);
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
                  decoration: InputDecoration(
                    hintText: localizations.translate('type_your_message'),
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
        final localizations = AppLocalizations.of(context);
        final maxHeight = MediaQuery.of(context).size.height * 0.6;
        return SafeArea(
          child: Container(
            constraints: BoxConstraints(maxHeight: maxHeight),
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
            ),
            child: SingleChildScrollView(
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
                      Expanded(
                        child: Text(
                          localizations.translate('conversation_info_title'),
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _buildInfoRow(localizations.translate('label_id'), _conversation?.id ?? 'N/A'),
                  _buildInfoRow(
                    localizations.translate('label_status'),
                    _conversation != null ? _localizeConversationStatus(_conversation!.status) : 'N/A',
                  ),
                  _buildInfoRow(
                    localizations.translate('label_priority'),
                    _conversation != null ? _localizeConversationPriority(_conversation!.priority) : 'normal',
                  ),
                  if (_conversation?.orderId != null)
                    _buildInfoRow(localizations.translate('label_order'), '#${_conversation!.orderId}'),
                  _buildInfoRow(
                    localizations.translate('label_created_at'),
                    _conversation != null
                        ? DateFormat('dd/MM/yyyy HH:mm').format(_conversation!.createdAt)
                        : 'N/A',
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _localizeConversationStatus(String status) {
    final localizations = AppLocalizations.of(context);
    switch (status) {
      case 'active':
        return localizations.translate('conversation_status_active');
      case 'resolved':
        return localizations.translate('conversation_status_resolved');
      case 'archived':
        return localizations.translate('conversation_status_archived');
      case 'pending':
        return localizations.translate('conversation_status_pending');
      default:
        return status;
    }
  }

  String _localizeConversationPriority(String priority) {
    final localizations = AppLocalizations.of(context);
    switch (priority) {
      case 'urgent':
        return localizations.translate('conversation_priority_urgent');
      case 'high':
        return localizations.translate('conversation_priority_high');
      case 'normal':
        return localizations.translate('conversation_priority_normal');
      case 'low':
        return localizations.translate('conversation_priority_low');
      default:
        return priority;
    }
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
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
    final localizations = AppLocalizations.of(context);
    if (_isSameDay(date, now)) {
      return localizations.translate('today');
    } else if (_isSameDay(date, now.subtract(const Duration(days: 1)))) {
      return localizations.translate('yesterday');
    } else {
      final locale = Localizations.localeOf(context).languageCode;
      return DateFormat('dd MMMM yyyy', locale).format(date);
    }
  }

  @override
  void dispose() {
    // Annuler la subscription pour éviter setState après dispose
    _messageSubscription?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    _sendButtonController.dispose();
    _typingIndicatorController.dispose();
    super.dispose();
  }
}
