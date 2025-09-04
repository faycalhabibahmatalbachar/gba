import 'package:freezed_annotation/freezed_annotation.dart';

part 'profile.freezed.dart';
part 'profile.g.dart';

@freezed
class Profile with _$Profile {
  const factory Profile({
    required String id,
    @JsonKey(name: 'first_name') String? firstName,
    @JsonKey(name: 'last_name') String? lastName,
    String? email,
    String? phone,
    @JsonKey(name: 'avatar_url') String? avatarUrl,
    String? bio,
    @JsonKey(name: 'date_of_birth') DateTime? dateOfBirth,
    String? gender,
    String? address,
    String? city,
    String? country,
    @JsonKey(name: 'postal_code') String? postalCode,
    @JsonKey(name: 'total_orders') @Default(0) int totalOrders,
    @JsonKey(name: 'total_spent') @Default(0.0) double totalSpent,
    @JsonKey(name: 'member_since') DateTime? memberSince,
    @JsonKey(name: 'last_updated') DateTime? lastUpdated,
    @JsonKey(name: 'loyalty_points') @Default(0) int loyaltyPoints,
    @JsonKey(name: 'language_preference') @Default('fr') String languagePreference,
    @JsonKey(name: 'notification_preferences') @Default({
      'email': true,
      'push': true,
      'sms': false,
    }) Map<String, bool> notificationPreferences,
  }) = _Profile;

  factory Profile.fromJson(Map<String, dynamic> json) => _$ProfileFromJson(json);
}
