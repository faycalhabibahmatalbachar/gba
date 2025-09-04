import 'package:freezed_annotation/freezed_annotation.dart';

part 'conversation.freezed.dart';
part 'conversation.g.dart';

@freezed
class Conversation with _$Conversation {
  const Conversation._();
  const factory Conversation({
    required String id,
    @JsonKey(name: 'user_id') required String userId,
    @JsonKey(name: 'admin_id') String? adminId,
    @JsonKey(name: 'order_id') String? orderId,
    required String status,
    @JsonKey(name: 'created_at') required DateTime createdAt,
    @JsonKey(name: 'updated_at') required DateTime updatedAt,
    @Default(0) int unreadCount,
    @Default([]) List<Message> messages,
    @JsonKey(name: 'recent_messages') @Default([]) List<Message> recentMessages,
    @Default('normal') String priority,
  }) = _Conversation;

  factory Conversation.fromJson(Map<String, dynamic> json) =>
      _$ConversationFromJson(json);
  
  factory Conversation.empty() {
    return Conversation(
      id: '',
      userId: '',
      status: 'active',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }
}

// Extension pour la compatibilité avec l'ancien code
extension ConversationExtension on Conversation {
  DateTime get lastMessageAt => updatedAt;
}

@freezed
class Message with _$Message {
  const factory Message({
    required String id,
    @JsonKey(name: 'conversation_id') required String conversationId,
    @JsonKey(name: 'sender_id') required String senderId,
    required String message,
    String? content,
    @JsonKey(name: 'sender_type') @Default('customer') String senderType,
    @JsonKey(name: 'is_read') required bool isRead,
    @JsonKey(name: 'created_at') required DateTime createdAt,
  }) = _Message;

  factory Message.fromJson(Map<String, dynamic> json) =>
      _$MessageFromJson(json);
}
