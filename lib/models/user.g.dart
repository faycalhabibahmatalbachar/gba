// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UserProfileImpl _$$UserProfileImplFromJson(Map<String, dynamic> json) =>
    _$UserProfileImpl(
      id: json['id'] as String,
      email: json['email'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      phone: json['phone'] as String?,
      bio: json['bio'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      postalCode: json['postal_code'] as String?,
      country: json['country'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      loyaltyPoints: (json['loyalty_points'] as num?)?.toInt() ?? 0,
      isPremium: json['is_premium'] as bool? ?? false,
      notificationPreferences:
          json['notification_preferences'] as Map<String, dynamic>?,
      memberSince: json['member_since'] == null
          ? null
          : DateTime.parse(json['member_since'] as String),
      createdAt: json['created_at'] == null
          ? null
          : DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$UserProfileImplToJson(_$UserProfileImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
      'phone': instance.phone,
      'bio': instance.bio,
      'address': instance.address,
      'city': instance.city,
      'postal_code': instance.postalCode,
      'country': instance.country,
      'avatar_url': instance.avatarUrl,
      'loyalty_points': instance.loyaltyPoints,
      'is_premium': instance.isPremium,
      'notification_preferences': instance.notificationPreferences,
      'member_since': instance.memberSince?.toIso8601String(),
      'created_at': instance.createdAt?.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
