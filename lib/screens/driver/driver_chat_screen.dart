import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Chat screen for drivers to communicate with customers about their orders.
/// Uses the same `chat_conversations` and `chat_messages` tables as the
/// client app and the web admin.
class DriverChatScreen extends StatefulWidget {
  final String customerId;
  final String? customerName;
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
  final _audioRecorder = AudioRecorder();
  final _audioPlayer = AudioPlayer();

  String? _conversationId;
  List<Map<String, dynamic>> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  bool _isRecording = false;
  int _recordingSecs = 0;
  String? _playingMessageId;
  StreamSubscription<void>? _audioCompleteSub;
  StreamSubscription? _messagesSub;
  Timer? _recordTimer;

  static const _purple = Color(0xFF667eea);
  static const _violet = Color(0xFF764ba2);

  @override
  void initState() {
    super.initState();
    _audioCompleteSub = _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) setState(() => _playingMessageId = null);
    });
    _initConversation();
  }

  @override
  void dispose() {
    _recordTimer?.cancel();
    _messageCtrl.dispose();
    _scrollCtrl.dispose();
    _messagesSub?.cancel();
    _audioCompleteSub?.cancel();
    _audioRecorder.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _initConversation() async {
    final driverId = _supabase.auth.currentUser?.id;
    if (driverId == null) return;

    setState(() => _isLoading = true);

    try {
      final existing = await _supabase
          .from('chat_conversations')
          .select('id')
          .eq('user_id', widget.customerId)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (existing != null) {
        _conversationId = existing['id'].toString();
      } else {
        final result = await _supabase
            .from('chat_conversations')
            .insert({
              'user_id': widget.customerId,
              'status': 'active',
              'updated_at': DateTime.now().toUtc().toIso8601String(),
            })
            .select('id')
            .single();
        _conversationId = result['id'].toString();
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
          .limit(300);
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
      if (!mounted) return;
      setState(() {
        _messages = List<Map<String, dynamic>>.from(data)
          ..sort((a, b) => (a['created_at'] ?? '').compareTo(b['created_at'] ?? ''));
      });
      _scrollToBottom();
    });
  }

  Future<void> _sendPayload({
    required String body,
    required String type,
    List<Map<String, dynamic>> attachments = const [],
    String? imageUrl,
  }) async {
    if (_conversationId == null) return;
    final driverId = _supabase.auth.currentUser?.id;
    if (driverId == null) return;

    await _supabase.from('chat_messages').insert({
      'conversation_id': _conversationId,
      'sender_id': driverId,
      'message': body,
      'message_type': type,
      'attachments': attachments,
      'image_url': imageUrl,
      'is_read': false,
    });

    await _supabase.from('chat_conversations').update({
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', _conversationId!);
  }

  Future<void> _sendMessage() async {
    final text = _messageCtrl.text.trim();
    if (text.isEmpty || _conversationId == null) return;
    setState(() {
      _isSending = true;
    });
    _messageCtrl.clear();
    try {
      await _sendPayload(body: text, type: 'text');
      HapticFeedback.lightImpact();
    } catch (e) {
      debugPrint('[DriverChat] send text error: $e');
      _messageCtrl.text = text;
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<String?> _uploadBinary({
    required String fileName,
    required List<int> bytes,
    required String contentType,
  }) async {
    final driverId = _supabase.auth.currentUser?.id;
    if (driverId == null || _conversationId == null) return null;
    final safeName = fileName.replaceAll(RegExp(r'[^a-zA-Z0-9_.-]'), '_');
    final objectPath = '$driverId/$_conversationId/${DateTime.now().millisecondsSinceEpoch}_$safeName';
    final buckets = ['chat-attachments', 'chat', 'gba-chat'];
    for (final bucket in buckets) {
      try {
        await _supabase.storage.from(bucket).uploadBinary(
              objectPath,
              Uint8List.fromList(bytes),
              fileOptions: FileOptions(cacheControl: '3600', upsert: true, contentType: contentType),
            );
        return _supabase.storage.from(bucket).getPublicUrl(objectPath);
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  Future<void> _pickAndSendImage() async {
    if (_conversationId == null) return;
    final picker = ImagePicker();
    final XFile? image = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1400,
      maxHeight: 1400,
      imageQuality: 85,
    );
    if (image == null) return;
    setState(() => _isSending = true);
    try {
      final bytes = await image.readAsBytes();
      final ext = image.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
      final url = await _uploadBinary(
        fileName: 'image.$ext',
        bytes: bytes,
        contentType: ext == 'png' ? 'image/png' : 'image/jpeg',
      );
      if (url == null || url.isEmpty) throw Exception('Upload image échoué');
      await _sendPayload(
        body: url,
        type: 'image',
        imageUrl: url,
        attachments: [
          {
            'url': url,
            'name': image.name,
            'size': bytes.length,
            'type': ext == 'png' ? 'image/png' : 'image/jpeg',
          }
        ],
      );
      HapticFeedback.lightImpact();
    } catch (e) {
      debugPrint('[DriverChat] image send error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur envoi image: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _toggleVoiceRecord() async {
    if (_conversationId == null) return;
    if (_isRecording) {
      final path = await _audioRecorder.stop();
      _recordTimer?.cancel();
      if (mounted) setState(() => _isRecording = false);
      if (path != null && path.isNotEmpty) {
        setState(() => _isSending = true);
        try {
          final file = File(path);
          final bytes = await file.readAsBytes();
          final url = await _uploadBinary(
            fileName: 'voice.m4a',
            bytes: bytes,
            contentType: 'audio/mp4',
          );
          if (url == null || url.isEmpty) throw Exception('Upload vocal échoué');
          await _sendPayload(
            body: url,
            type: 'audio',
            attachments: [
              {
                'url': url,
                'name': 'voice.m4a',
                'size': bytes.length,
                'type': 'audio/mp4',
                'duration_sec': _recordingSecs,
              }
            ],
          );
          HapticFeedback.mediumImpact();
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Erreur vocal: $e'), backgroundColor: Colors.red),
            );
          }
        } finally {
          if (mounted) {
            setState(() {
              _isSending = false;
              _recordingSecs = 0;
            });
          }
        }
      }
      return;
    }

    final p = await Permission.microphone.request();
    if (p.isPermanentlyDenied) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Microphone bloque. Activez-le dans les parametres.')),
        );
      }
      await openAppSettings();
      return;
    }
    if (p.isDenied || p.isRestricted || p.isLimited) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Permission micro refusée')),
        );
      }
      return;
    }
    if (!await _audioRecorder.hasPermission()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Micro indisponible')),
        );
      }
      return;
    }

    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/driver_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    try {
      await _audioRecorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted || !_isRecording) return;
        setState(() => _recordingSecs += 1);
      });
      if (mounted) {
        setState(() {
          _isRecording = true;
          _recordingSecs = 0;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Impossible de démarrer le vocal: $e')),
        );
      }
    }
  }

  Future<void> _toggleAudioPlayback(String messageId, String url) async {
    if (_playingMessageId == messageId) {
      await _audioPlayer.pause();
      if (mounted) setState(() => _playingMessageId = null);
      return;
    }
    await _audioPlayer.stop();
    await _audioPlayer.play(UrlSource(url));
    if (mounted) setState(() => _playingMessageId = messageId);
  }

  List<Map<String, dynamic>> _extractAttachments(Map<String, dynamic> msg) {
    final raw = msg['attachments'];
    if (raw is List) {
      return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    if (raw is String && raw.trim().isNotEmpty) {
      try {
        final parsed = jsonDecode(raw);
        if (parsed is List) {
          return parsed.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        }
      } catch (_) {}
    }
    return const [];
  }

  String? _audioUrl(Map<String, dynamic> msg) {
    final type = (msg['message_type'] ?? '').toString().toLowerCase();
    final at = _extractAttachments(msg);
    if (at.isNotEmpty && at.first['url'] is String) {
      final u = (at.first['url'] as String).trim();
      final ct = (at.first['type'] ?? '').toString().toLowerCase();
      if (type == 'audio' || ct.startsWith('audio/') || _looksLikeAudioUrl(u)) return u;
    }
    final body = (msg['message'] ?? '').toString().trim();
    if (type == 'audio' && body.startsWith('http')) return body;
    if (body.startsWith('http') && _looksLikeAudioUrl(body)) return body;
    return null;
  }

  bool _looksLikeAudioUrl(String u) {
    final lower = u.toLowerCase();
    return lower.endsWith('.m4a') ||
        lower.endsWith('.aac') ||
        lower.endsWith('.mp3') ||
        lower.endsWith('.ogg') ||
        lower.contains('/audio') ||
        lower.contains('voice');
  }

  int? _audioDuration(Map<String, dynamic> msg) {
    final at = _extractAttachments(msg);
    if (at.isNotEmpty && at.first['duration_sec'] is num) return (at.first['duration_sec'] as num).toInt();
    return null;
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
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                  if (widget.orderId != null)
                    Text(
                      'Commande #${widget.orderId!.length > 8 ? widget.orderId!.substring(0, 8).toUpperCase() : widget.orderId}',
                      style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.75)),
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
                              text: (msg['message'] ?? msg['content'] ?? '').toString(),
                              imageUrl: msg['image_url']?.toString(),
                              messageType: (msg['message_type'] ?? 'text').toString(),
                              audioUrl: _audioUrl(msg),
                              audioDurationSec: _audioDuration(msg),
                              isPlayingAudio: _playingMessageId == (msg['id']?.toString() ?? ''),
                              onAudioTap: () {
                                final u = _audioUrl(msg);
                                final id = msg['id']?.toString() ?? '';
                                if (u != null && id.isNotEmpty) {
                                  _toggleAudioPlayback(id, u);
                                }
                              },
                              isMe: isMe,
                              time: DateTime.tryParse((msg['created_at'] ?? '').toString()) ?? DateTime.now(),
                            );
                          },
                        ),
                ),
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
                  colors: [_purple.withValues(alpha: 0.15), _violet.withValues(alpha: 0.15)],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.chat_bubble_outline, size: 40, color: _purple),
            ),
            const SizedBox(height: 20),
            const Text(
              'Démarrer la conversation',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF2D3436)),
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
      padding: EdgeInsets.fromLTRB(16, 8, 8, MediaQuery.of(context).padding.bottom + 8),
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
          GestureDetector(
            onTap: _isSending ? null : _pickAndSendImage,
            child: Container(
              width: 40,
              height: 40,
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(color: _purple.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(Icons.attach_file_rounded, color: _purple, size: 20),
            ),
          ),
          GestureDetector(
            onTap: _isSending ? null : _toggleVoiceRecord,
            child: Container(
              width: 40,
              height: 40,
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(
                color: _isRecording ? Colors.red.withValues(alpha: 0.15) : _purple.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _isRecording ? Icons.stop_circle : Icons.mic_none_rounded,
                color: _isRecording ? Colors.red : _purple,
                size: 20,
              ),
            ),
          ),
          if (_isRecording)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text(
                '${(_recordingSecs ~/ 60).toString().padLeft(2, '0')}:${(_recordingSecs % 60).toString().padLeft(2, '0')}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.red),
              ),
            ),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(24)),
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
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final String text;
  final String? imageUrl;
  final String messageType;
  final String? audioUrl;
  final int? audioDurationSec;
  final bool isPlayingAudio;
  final VoidCallback? onAudioTap;
  final bool isMe;
  final DateTime time;

  const _MessageBubble({
    required this.text,
    this.imageUrl,
    required this.messageType,
    this.audioUrl,
    this.audioDurationSec,
    this.isPlayingAudio = false,
    this.onAudioTap,
    required this.isMe,
    required this.time,
  });

  bool get _isImage {
    if (messageType == 'audio') return false;
    if (imageUrl != null && imageUrl!.isNotEmpty) return true;
    final t = text.trim().toLowerCase();
    if (t.endsWith('.m4a') ||
        t.endsWith('.aac') ||
        t.endsWith('.mp3') ||
        t.endsWith('.ogg') ||
        t.endsWith('.wav') ||
        t.contains('audio/')) {
      return false;
    }
    return t.startsWith('http') &&
        (t.contains('/storage/v1/object/public/chat/') ||
            t.endsWith('.jpg') ||
            t.endsWith('.jpeg') ||
            t.endsWith('.png') ||
            t.endsWith('.webp'));
  }

  String get _imgSrc => (imageUrl != null && imageUrl!.isNotEmpty) ? imageUrl! : text.trim();

  @override
  Widget build(BuildContext context) {
    final isAudio = messageType == 'audio' && audioUrl != null && audioUrl!.isNotEmpty;
    final isImg = !isAudio && (messageType == 'image' || _isImage);
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(isMe ? 18 : 4),
      bottomRight: Radius.circular(isMe ? 4 : 18),
    );

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        margin: const EdgeInsets.only(bottom: 8),
        padding: isImg
            ? const EdgeInsets.all(4)
            : const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          gradient: isMe ? const LinearGradient(colors: [Color(0xFF667eea), Color(0xFF764ba2)]) : null,
          color: isMe ? null : Colors.white,
          borderRadius: radius,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (isImg)
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: CachedNetworkImage(
                  imageUrl: _imgSrc,
                  width: 220,
                  height: 220,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(
                    width: 220,
                    height: 220,
                    color: Colors.grey.shade200,
                    child: const Center(
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  ),
                  errorWidget: (_, __, ___) => Container(
                    width: 220,
                    height: 220,
                    color: Colors.grey.shade200,
                    child: const Center(child: Icon(Icons.broken_image_outlined, size: 32)),
                  ),
                ),
              )
            else if (isAudio)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    iconSize: 30,
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      isPlayingAudio ? Icons.pause_circle_filled : Icons.play_circle_fill,
                      color: isMe ? Colors.white : const Color(0xFF667eea),
                    ),
                    onPressed: onAudioTap,
                  ),
                  Text(
                    audioDurationSec != null
                        ? '${(audioDurationSec! ~/ 60).toString().padLeft(2, '0')}:${(audioDurationSec! % 60).toString().padLeft(2, '0')}'
                        : 'Message vocal',
                    style: TextStyle(
                      color: isMe ? Colors.white : const Color(0xFF2D3436),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              )
            else
              Text(
                text,
                style: TextStyle(
                  color: isMe ? Colors.white : const Color(0xFF2D3436),
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
            const SizedBox(height: 4),
            Padding(
              padding: isImg ? const EdgeInsets.symmetric(horizontal: 8, vertical: 2) : EdgeInsets.zero,
              child: Text(
                '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
                style: TextStyle(
                  color: isMe ? Colors.white.withValues(alpha: 0.7) : Colors.grey.shade400,
                  fontSize: 10,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
