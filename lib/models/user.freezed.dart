// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UserProfile _$UserProfileFromJson(Map<String, dynamic> json) {
  return _UserProfile.fromJson(json);
}

/// @nodoc
mixin _$UserProfile {
  String get id => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  @JsonKey(name: 'first_name')
  String? get firstName => throw _privateConstructorUsedError;
  @JsonKey(name: 'last_name')
  String? get lastName => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get bio => throw _privateConstructorUsedError;
  String? get address => throw _privateConstructorUsedError;
  String? get city => throw _privateConstructorUsedError;
  @JsonKey(name: 'postal_code')
  String? get postalCode => throw _privateConstructorUsedError;
  String? get country => throw _privateConstructorUsedError;
  @JsonKey(name: 'avatar_url')
  String? get avatarUrl => throw _privateConstructorUsedError;
  @JsonKey(name: 'loyalty_points')
  int get loyaltyPoints => throw _privateConstructorUsedError;
  @JsonKey(name: 'is_premium')
  bool get isPremium => throw _privateConstructorUsedError;
  @JsonKey(name: 'notification_preferences')
  Map<String, dynamic>? get notificationPreferences =>
      throw _privateConstructorUsedError;
  @JsonKey(name: 'member_since')
  DateTime? get memberSince => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  DateTime? get createdAt => throw _privateConstructorUsedError;
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this UserProfile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UserProfile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UserProfileCopyWith<UserProfile> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UserProfileCopyWith<$Res> {
  factory $UserProfileCopyWith(
          UserProfile value, $Res Function(UserProfile) then) =
      _$UserProfileCopyWithImpl<$Res, UserProfile>;
  @useResult
  $Res call(
      {String id,
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
      @JsonKey(name: 'loyalty_points') int loyaltyPoints,
      @JsonKey(name: 'is_premium') bool isPremium,
      @JsonKey(name: 'notification_preferences')
      Map<String, dynamic>? notificationPreferences,
      @JsonKey(name: 'member_since') DateTime? memberSince,
      @JsonKey(name: 'created_at') DateTime? createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$UserProfileCopyWithImpl<$Res, $Val extends UserProfile>
    implements $UserProfileCopyWith<$Res> {
  _$UserProfileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UserProfile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = freezed,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? bio = freezed,
    Object? address = freezed,
    Object? city = freezed,
    Object? postalCode = freezed,
    Object? country = freezed,
    Object? avatarUrl = freezed,
    Object? loyaltyPoints = null,
    Object? isPremium = null,
    Object? notificationPreferences = freezed,
    Object? memberSince = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      bio: freezed == bio
          ? _value.bio
          : bio // ignore: cast_nullable_to_non_nullable
              as String?,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      loyaltyPoints: null == loyaltyPoints
          ? _value.loyaltyPoints
          : loyaltyPoints // ignore: cast_nullable_to_non_nullable
              as int,
      isPremium: null == isPremium
          ? _value.isPremium
          : isPremium // ignore: cast_nullable_to_non_nullable
              as bool,
      notificationPreferences: freezed == notificationPreferences
          ? _value.notificationPreferences
          : notificationPreferences // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      memberSince: freezed == memberSince
          ? _value.memberSince
          : memberSince // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$UserProfileImplCopyWith<$Res>
    implements $UserProfileCopyWith<$Res> {
  factory _$$UserProfileImplCopyWith(
          _$UserProfileImpl value, $Res Function(_$UserProfileImpl) then) =
      __$$UserProfileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
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
      @JsonKey(name: 'loyalty_points') int loyaltyPoints,
      @JsonKey(name: 'is_premium') bool isPremium,
      @JsonKey(name: 'notification_preferences')
      Map<String, dynamic>? notificationPreferences,
      @JsonKey(name: 'member_since') DateTime? memberSince,
      @JsonKey(name: 'created_at') DateTime? createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class __$$UserProfileImplCopyWithImpl<$Res>
    extends _$UserProfileCopyWithImpl<$Res, _$UserProfileImpl>
    implements _$$UserProfileImplCopyWith<$Res> {
  __$$UserProfileImplCopyWithImpl(
      _$UserProfileImpl _value, $Res Function(_$UserProfileImpl) _then)
      : super(_value, _then);

  /// Create a copy of UserProfile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = freezed,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? bio = freezed,
    Object? address = freezed,
    Object? city = freezed,
    Object? postalCode = freezed,
    Object? country = freezed,
    Object? avatarUrl = freezed,
    Object? loyaltyPoints = null,
    Object? isPremium = null,
    Object? notificationPreferences = freezed,
    Object? memberSince = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_$UserProfileImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      bio: freezed == bio
          ? _value.bio
          : bio // ignore: cast_nullable_to_non_nullable
              as String?,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      loyaltyPoints: null == loyaltyPoints
          ? _value.loyaltyPoints
          : loyaltyPoints // ignore: cast_nullable_to_non_nullable
              as int,
      isPremium: null == isPremium
          ? _value.isPremium
          : isPremium // ignore: cast_nullable_to_non_nullable
              as bool,
      notificationPreferences: freezed == notificationPreferences
          ? _value._notificationPreferences
          : notificationPreferences // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      memberSince: freezed == memberSince
          ? _value.memberSince
          : memberSince // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$UserProfileImpl implements _UserProfile {
  const _$UserProfileImpl(
      {required this.id,
      this.email,
      @JsonKey(name: 'first_name') this.firstName,
      @JsonKey(name: 'last_name') this.lastName,
      this.phone,
      this.bio,
      this.address,
      this.city,
      @JsonKey(name: 'postal_code') this.postalCode,
      this.country,
      @JsonKey(name: 'avatar_url') this.avatarUrl,
      @JsonKey(name: 'loyalty_points') this.loyaltyPoints = 0,
      @JsonKey(name: 'is_premium') this.isPremium = false,
      @JsonKey(name: 'notification_preferences')
      final Map<String, dynamic>? notificationPreferences,
      @JsonKey(name: 'member_since') this.memberSince,
      @JsonKey(name: 'created_at') this.createdAt,
      @JsonKey(name: 'updated_at') this.updatedAt})
      : _notificationPreferences = notificationPreferences;

  factory _$UserProfileImpl.fromJson(Map<String, dynamic> json) =>
      _$$UserProfileImplFromJson(json);

  @override
  final String id;
  @override
  final String? email;
  @override
  @JsonKey(name: 'first_name')
  final String? firstName;
  @override
  @JsonKey(name: 'last_name')
  final String? lastName;
  @override
  final String? phone;
  @override
  final String? bio;
  @override
  final String? address;
  @override
  final String? city;
  @override
  @JsonKey(name: 'postal_code')
  final String? postalCode;
  @override
  final String? country;
  @override
  @JsonKey(name: 'avatar_url')
  final String? avatarUrl;
  @override
  @JsonKey(name: 'loyalty_points')
  final int loyaltyPoints;
  @override
  @JsonKey(name: 'is_premium')
  final bool isPremium;
  final Map<String, dynamic>? _notificationPreferences;
  @override
  @JsonKey(name: 'notification_preferences')
  Map<String, dynamic>? get notificationPreferences {
    final value = _notificationPreferences;
    if (value == null) return null;
    if (_notificationPreferences is EqualUnmodifiableMapView)
      return _notificationPreferences;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  @JsonKey(name: 'member_since')
  final DateTime? memberSince;
  @override
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'UserProfile(id: $id, email: $email, firstName: $firstName, lastName: $lastName, phone: $phone, bio: $bio, address: $address, city: $city, postalCode: $postalCode, country: $country, avatarUrl: $avatarUrl, loyaltyPoints: $loyaltyPoints, isPremium: $isPremium, notificationPreferences: $notificationPreferences, memberSince: $memberSince, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UserProfileImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.bio, bio) || other.bio == bio) &&
            (identical(other.address, address) || other.address == address) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.avatarUrl, avatarUrl) ||
                other.avatarUrl == avatarUrl) &&
            (identical(other.loyaltyPoints, loyaltyPoints) ||
                other.loyaltyPoints == loyaltyPoints) &&
            (identical(other.isPremium, isPremium) ||
                other.isPremium == isPremium) &&
            const DeepCollectionEquality().equals(
                other._notificationPreferences, _notificationPreferences) &&
            (identical(other.memberSince, memberSince) ||
                other.memberSince == memberSince) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      email,
      firstName,
      lastName,
      phone,
      bio,
      address,
      city,
      postalCode,
      country,
      avatarUrl,
      loyaltyPoints,
      isPremium,
      const DeepCollectionEquality().hash(_notificationPreferences),
      memberSince,
      createdAt,
      updatedAt);

  /// Create a copy of UserProfile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UserProfileImplCopyWith<_$UserProfileImpl> get copyWith =>
      __$$UserProfileImplCopyWithImpl<_$UserProfileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UserProfileImplToJson(
      this,
    );
  }
}

abstract class _UserProfile implements UserProfile {
  const factory _UserProfile(
          {required final String id,
          final String? email,
          @JsonKey(name: 'first_name') final String? firstName,
          @JsonKey(name: 'last_name') final String? lastName,
          final String? phone,
          final String? bio,
          final String? address,
          final String? city,
          @JsonKey(name: 'postal_code') final String? postalCode,
          final String? country,
          @JsonKey(name: 'avatar_url') final String? avatarUrl,
          @JsonKey(name: 'loyalty_points') final int loyaltyPoints,
          @JsonKey(name: 'is_premium') final bool isPremium,
          @JsonKey(name: 'notification_preferences')
          final Map<String, dynamic>? notificationPreferences,
          @JsonKey(name: 'member_since') final DateTime? memberSince,
          @JsonKey(name: 'created_at') final DateTime? createdAt,
          @JsonKey(name: 'updated_at') final DateTime? updatedAt}) =
      _$UserProfileImpl;

  factory _UserProfile.fromJson(Map<String, dynamic> json) =
      _$UserProfileImpl.fromJson;

  @override
  String get id;
  @override
  String? get email;
  @override
  @JsonKey(name: 'first_name')
  String? get firstName;
  @override
  @JsonKey(name: 'last_name')
  String? get lastName;
  @override
  String? get phone;
  @override
  String? get bio;
  @override
  String? get address;
  @override
  String? get city;
  @override
  @JsonKey(name: 'postal_code')
  String? get postalCode;
  @override
  String? get country;
  @override
  @JsonKey(name: 'avatar_url')
  String? get avatarUrl;
  @override
  @JsonKey(name: 'loyalty_points')
  int get loyaltyPoints;
  @override
  @JsonKey(name: 'is_premium')
  bool get isPremium;
  @override
  @JsonKey(name: 'notification_preferences')
  Map<String, dynamic>? get notificationPreferences;
  @override
  @JsonKey(name: 'member_since')
  DateTime? get memberSince;
  @override
  @JsonKey(name: 'created_at')
  DateTime? get createdAt;
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of UserProfile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UserProfileImplCopyWith<_$UserProfileImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
