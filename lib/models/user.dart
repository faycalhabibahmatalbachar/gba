import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
class UserProfile with _$UserProfile {
  const factory UserProfile({
    required String id,
    String? email,
    @JsonKey(name: 'first_name') String? firstName,
    @JsonKey(name: 'last_name') String? lastName,
    String? phone,
    String? bio,
    String? address,
    String? city,
    @JsonKey(name: 'postal_code') String? postalCode,
    String? country,
    @JsonKey(name: 'avatar_url') String? avatarUrl,
    @JsonKey(name: 'loyalty_points') @Default(0) int loyaltyPoints,
    @JsonKey(name: 'is_premium') @Default(false) bool isPremium,
    @JsonKey(name: 'notification_preferences') Map<String, dynamic>? notificationPreferences,
    @JsonKey(name: 'member_since') DateTime? memberSince,
    @JsonKey(name: 'created_at') DateTime? createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
  }) = _UserProfile;

  factory UserProfile.fromJson(Map<String, dynamic> json) => _$UserProfileFromJson(json);
}
