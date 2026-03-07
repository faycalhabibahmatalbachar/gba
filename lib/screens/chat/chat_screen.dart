import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import 'package:gal/gal.dart';
import '../../localization/app_localizations.dart';
import '../../services/messaging_service.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/adaptive_back_button.dart';
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
  StreamSubscription<List<Map<String, dynamic>>>? _realtimeSub;
  
  @override
  void initState() {
    super.initState();
    _initAnimations();
    _loadConversation();
    _messageController.addListener(_onTypingChanged);
  }

  Future<void> _downloadImageToDevice(String imageUrl) async {
    try {
      // Check and request gallery permission
      final hasAccess = await Gal.hasAccess(toAlbum: false);
      if (!hasAccess) {
        final granted = await Gal.requestAccess(toAlbum: false);
        if (!granted) {
          if (mounted) {
            final localizations = AppLocalizations.of(context);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(localizations.translate('permission_denied'))),
            );
          }
          return;
        }
      }
      // Download to temp file then save to gallery
      final tempDir = await getTemporaryDirectory();
      final fileName = 'gba_image_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final filePath = '${tempDir.path}/$fileName';
      await Dio().download(imageUrl, filePath);
      await Gal.putImage(filePath);
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(localizations.translate('image_saved_to_gallery')),
            backgroundColor: Colors.green.shade600,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(localizations.translateParams('error_with_details', {'error': e.toString()})),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _shareUrl(String url) async {
    try {
      // If the URL looks like an image, download it and share the file instead of the link
      final lower = url.toLowerCase();
      final isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.contains('content-type=image');
      if (isImage) {
        // Download to a temp file
        final tempDir = await getTemporaryDirectory();
        final fileName = 'gba_shared_${DateTime.now().millisecondsSinceEpoch}${lower.endsWith('.png') ? '.png' : '.jpg'}';
        final filePath = '${tempDir.path}/$fileName';
        await Dio().download(url, filePath);

        // Use share_plus to share the actual image file
        try {
          final xfile = XFile(filePath);
          await Share.shareXFiles([xfile]);
          return;
        } catch (_) {
          // fallback to sharing the URL if file sharing isn't available on this platform
          await Share.share(url);
          return;
        }
      }

      // default: share url
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
                  onPressed: () => _downloadImageToDevice(imageUrl),
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
    final theme = Theme.of(context);
    final bgColor = theme.colorScheme.surface;
    final textColor = theme.colorScheme.onSurface;
    final iconColor = theme.colorScheme.primary;
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      backgroundColor: bgColor,
      builder: (context) {
        final localizations = AppLocalizations.of(context);
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(Icons.fullscreen_rounded, color: iconColor),
                title: Text(
                  localizations.translate('view_fullscreen'),
                  style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
                ),
                onTap: () {
                  Navigator.of(context).pop();
                  _openImageFullScreen(imageUrl);
                },
              ),
              ListTile(
                leading: Icon(Icons.download_rounded, color: iconColor),
                title: Text(
                  localizations.translate('download'),
                  style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
                ),
                onTap: () {
                  Navigator.of(context).pop();
                  _downloadImageToDevice(imageUrl);
                },
              ),
              ListTile(
                leading: Icon(Icons.share_rounded, color: iconColor),
                title: Text(
                  localizations.translate('share'),
                  style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
                ),
                onTap: () {
                  Navigator.of(context).pop();
                  _shareUrl(imageUrl);
                },
              ),
              ListTile(
                leading: Icon(Icons.copy_rounded, color: iconColor),
                title: Text(
                  localizations.translate('copy_link'),
                  style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
                ),
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
      
      // Always ensure conversations are loaded first
      await messagingService.loadConversations();
      
      if (widget.conversationId != null) {
        // Try to find existing conversation, fallback to getOrCreate
        try {
          _conversation = messagingService.conversations
              .firstWhere((c) => c.id == widget.conversationId!);
        } catch (_) {
          // Conversation not found in list, use getOrCreate
          _conversation = await messagingService.getOrCreateConversation(
            orderId: widget.orderId,
          );
        }
      } else {
        // Créer nouvelle conversation
        _conversation = await messagingService.getOrCreateConversation(
          orderId: widget.orderId,
        );
      }
      
      // Charger les messages
      _messages = await messagingService.loadMessages(_conversation!.id);
      
      // Marquer comme lus — messages des autres (admin/driver)
      final currentUserId = Supabase.instance.client.auth.currentUser?.id;
      final toRead = _messages
          .where((m) => !m.isRead && m.senderId != currentUserId)
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
      
      // Écouter les nouveaux messages via Supabase Realtime directement
      // (plus fiable que MessagingService.newMessageStream)
      _realtimeSub = Supabase.instance.client
          .from('chat_messages')
          .stream(primaryKey: ['id'])
          .eq('conversation_id', _conversation!.id)
          .listen((data) {
        if (!mounted) return;
        final updated = data
            .map((row) => Message.fromJson(row))
            .toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
        setState(() => _messages = updated);
        _scrollToBottom();
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
            colors: Theme.of(context).brightness == Brightness.dark
                ? [
                    const Color(0xFF1a1a2e),
                    const Color(0xFF16213e),
                  ]
                : [
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
      leading: // Use adaptive back button that respects RTL/LTR
        AdaptiveBackButton(color: Colors.white),
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
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.2),
            ),
            const SizedBox(height: 16),
            Text(
              localizations.translate('start_conversation'),
              style: TextStyle(
                fontSize: 18,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              localizations.translate('we_are_here_to_help'),
              style: TextStyle(
                fontSize: 14,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
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
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _formatDate(message.createdAt),
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
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
                color: isImage ? Colors.transparent : (isMe ? null : Theme.of(context).colorScheme.surfaceContainerHighest),
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
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
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
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
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
                        color: isMe
                            ? Colors.white
                            : Theme.of(context).colorScheme.onSurface,
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
                              ? Theme.of(context).colorScheme.onSurfaceVariant
                              : (isMe
                                  ? Colors.white.withValues(alpha: 0.7)
                                  : Theme.of(context).colorScheme.onSurfaceVariant),
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
                              ? (message.isRead ? Colors.blue[300] : Theme.of(context).colorScheme.onSurfaceVariant)
                              : (message.isRead ? Colors.blue[300] : Colors.white.withValues(alpha: 0.7)),
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
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
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
                  color: cs.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(25),
                ),
                child: TextField(
                  controller: _messageController,
                  focusNode: _focusNode,
                  maxLines: null,
                  keyboardType: TextInputType.multiline,
                  textCapitalization: TextCapitalization.sentences,
                  style: TextStyle(color: cs.onSurface),
                  decoration: InputDecoration(
                    hintText: localizations.translate('type_your_message'),
                    hintStyle: TextStyle(color: cs.onSurfaceVariant),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
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
                          ? cs.surfaceContainerHighest
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
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: const BorderRadius.only(
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
    // Annuler les subscriptions pour éviter setState après dispose
    _messageSubscription?.cancel();
    _realtimeSub?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    _sendButtonController.dispose();
    _typingIndicatorController.dispose();
    super.dispose();
  }
}
