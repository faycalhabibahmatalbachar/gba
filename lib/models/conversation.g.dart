// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'conversation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConversationImpl _$$ConversationImplFromJson(Map<String, dynamic> json) =>
    _$ConversationImpl(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      adminId: json['admin_id'] as String?,
      orderId: json['order_id'] as String?,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      messages: (json['messages'] as List<dynamic>?)
              ?.map((e) => Message.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      recentMessages: (json['recent_messages'] as List<dynamic>?)
              ?.map((e) => Message.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      priority: json['priority'] as String? ?? 'normal',
    );

Map<String, dynamic> _$$ConversationImplToJson(_$ConversationImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'user_id': instance.userId,
      'admin_id': instance.adminId,
      'order_id': instance.orderId,
      'status': instance.status,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt.toIso8601String(),
      'unreadCount': instance.unreadCount,
      'messages': instance.messages,
      'recent_messages': instance.recentMessages,
      'priority': instance.priority,
    };

_$MessageImpl _$$MessageImplFromJson(Map<String, dynamic> json) =>
    _$MessageImpl(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      senderId: json['sender_id'] as String,
      message: json['message'] as String,
      content: json['content'] as String?,
      senderType: json['sender_type'] as String? ?? 'customer',
      isRead: json['is_read'] as bool,
      createdAt: DateTime.parse(json['created_at'] as String),
    );

Map<String, dynamic> _$$MessageImplToJson(_$MessageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'conversation_id': instance.conversationId,
      'sender_id': instance.senderId,
      'message': instance.message,
      'content': instance.content,
      'sender_type': instance.senderType,
      'is_read': instance.isRead,
      'created_at': instance.createdAt.toIso8601String(),
    };
