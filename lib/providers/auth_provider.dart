import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/supabase_service.dart';
import '../routes/navigation_keys.dart';
import '../utils/auth_errors.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

class AuthState {
  final User? user;
  final UserProfile? profile;
  final bool isLoading;
  final String? error;
  final String? errorCode;
  final bool needsEmailConfirmation;

  AuthState({
    this.user,
    this.profile,
    this.isLoading = false,
    this.error,
    this.errorCode,
    this.needsEmailConfirmation = false,
  });

  AuthState copyWith({
    User? user,
    UserProfile? profile,
    bool? isLoading,
    String? error,
    String? errorCode,
    bool? needsEmailConfirmation,
  }) {
    return AuthState(
      user: user ?? this.user,
      profile: profile ?? this.profile,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      errorCode: errorCode,
      needsEmailConfirmation: needsEmailConfirmation ?? this.needsEmailConfirmation,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  static const _kRememberMe = 'auth_remember_me';
  static const _kSavedEmail = 'auth_saved_email';

  AuthNotifier() : super(AuthState()) {
    _init();
  }

  Future<void> refreshProfile() async {
    await _loadProfile();
  }

  void _log(String message) {
    debugPrint('[Auth] $message');
  }

  String _normalizeEmail(String email) {
    return email
        .trim()
        .replaceAll(RegExp(r'[\u200B-\u200D\uFEFF]'), '')
        .toLowerCase();
  }


  Map<String, String?> _splitFullName(String fullName) {
    final normalized = fullName.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized.isEmpty) {
      return {'first_name': null, 'last_name': null};
    }

    final parts = normalized.split(' ');
    if (parts.length == 1) {
      return {'first_name': parts[0], 'last_name': null};
    }

    return {
      'first_name': parts.first,
      'last_name': parts.sublist(1).join(' '),
    };
  }

  void _init() {
    final user = SupabaseService.currentUser;
    if (user != null) {
      _log('Initial user detected: ${user.id}');
      state = state.copyWith(user: user);
      _loadProfile();
    } else {
      _log('Initial user: null');
    }

    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      final event = data.event;
      final user = data.session?.user;
      _log('onAuthStateChange: $event, userId=${user?.id}, hasSession=${data.session != null}');
      state = state.copyWith(user: user, needsEmailConfirmation: false, errorCode: null);

      if (event == AuthChangeEvent.passwordRecovery) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final ctx = NavigationKeys.rootNavigatorKey.currentContext;
          if (ctx == null) {
            _log('Password recovery detected but navigator context is null');
            return;
          }
          _log('Password recovery detected -> go(/reset-password)');
          GoRouter.of(ctx).go('/reset-password');
        });
      }

      if (user != null) {
        _loadProfile();
      } else {
        state = state.copyWith(profile: null);
      }
    });
  }

  Future<void> _loadProfile() async {
    _log('Loading profile...');
    final profile = await SupabaseService.getUserProfile();
    if (profile != null) {
      _log('Profile loaded: id=${profile.id}');
      state = state.copyWith(profile: profile);
    } else {
      _log('Profile not found');
      final user = state.user;
      if (user != null) {
        final fullName = (user.userMetadata?['full_name'] ?? user.userMetadata?['name'])?.toString();
        _log('Attempting profile recovery upsert: userId=${user.id}, fullName=$fullName');
        try {
          final nameParts = _splitFullName(fullName ?? '');
          await SupabaseService.updateUserProfile({
            'email': user.email,
            if (nameParts['first_name'] != null) 'first_name': nameParts['first_name'],
            if (nameParts['last_name'] != null) 'last_name': nameParts['last_name'],
          });
          _log('Profile recovery upsert: OK');
          final recoveredProfile = await SupabaseService.getUserProfile();
          if (recoveredProfile != null) {
            _log('Recovered profile loaded: id=${recoveredProfile.id}');
            state = state.copyWith(profile: recoveredProfile);
          }
        } catch (e) {
          _log('Profile recovery upsert failed: $e');
        }
      }
    }
  }

  Future<void> signIn(String email, String password, {bool rememberMe = true}) async {
    final normalizedEmail = _normalizeEmail(email);
    _log('signIn start: email=$normalizedEmail, rememberMe=$rememberMe');
    state = state.copyWith(isLoading: true, error: null, errorCode: null);
    try {
      final response = await Supabase.instance.client.auth.signInWithPassword(
        email: normalizedEmail,
        password: password,
      );
      
      if (response.user != null) {
        _log('signIn success: userId=${response.user!.id}, hasSession=${response.session != null}');
        state = state.copyWith(user: response.user, isLoading: false);
        await _loadProfile();
        
        // Handle remember me preference
        await setRememberMe(rememberMe);
        if (rememberMe) {
          await _saveEmail(normalizedEmail);
        } else {
          await _clearSavedEmail();
        }
      } else {
        _log('signIn finished but user is null');
        state = state.copyWith(isLoading: false, error: 'Connexion échouée.');
      }
    } catch (e) {
      _log('signIn error: $e');
      String? code;

      if (e is AuthApiException) {
        code = e.code;
        _log('signIn AuthApiException: statusCode=${e.statusCode}, code=${e.code}, message=${e.message}');
      }

      String message = localizeAuthError(e);
      if (e is AuthApiException && e.code == 'invalid_credentials') {
        message =
            'Connexion refusée. Vérifiez le mot de passe ou confirmez votre e-mail (lien dans la boîte de réception).';
      }

      state = state.copyWith(isLoading: false, error: message, errorCode: code);
    }
  }

  Future<void> signUp(String email, String password, String fullName, {String? locale}) async {
    final normalizedEmail = _normalizeEmail(email);
    final normalizedFullName = fullName.trim();
    final normalizedLocale = locale?.trim();
    _log('signUp start: email=$normalizedEmail, fullName=$normalizedFullName, locale=$normalizedLocale');
    state = state.copyWith(isLoading: true, error: null, errorCode: null);
    try {
      final response = await Supabase.instance.client.auth.signUp(
        email: normalizedEmail,
        password: password,
        data: {
          'full_name': normalizedFullName,
          if (normalizedLocale != null && normalizedLocale.isNotEmpty) 'locale': normalizedLocale,
        },
      );
      
      final createdUserId = response.user?.id;
      _log('signUp response: userId=$createdUserId, hasSession=${response.session != null}');

      if (response.user == null) {
        state = state.copyWith(isLoading: false, error: 'Inscription échouée.');
        return;
      }

      if (response.session == null) {
        state = state.copyWith(
          isLoading: false,
          user: null,
          profile: null,
          needsEmailConfirmation: true,
        );
        _log('signUp requires email confirmation (no session).');
        return;
      }

      try {
        final nameParts = _splitFullName(normalizedFullName);
        await SupabaseService.updateUserProfile({
          'email': normalizedEmail,
          if (nameParts['first_name'] != null) 'first_name': nameParts['first_name'],
          if (nameParts['last_name'] != null) 'last_name': nameParts['last_name'],
        });
        _log('Profile upsert after signUp: OK');
      } catch (e) {
        _log('Profile upsert after signUp failed: $e');
      }

      state = state.copyWith(user: response.user, isLoading: false, needsEmailConfirmation: false);
      await _loadProfile();
    } catch (e) {
      _log('signUp error: $e');
      String? code;

      if (e is AuthApiException) {
        code = e.code;
        _log('signUp AuthApiException: statusCode=${e.statusCode}, code=${e.code}, message=${e.message}');
      }

      final message = localizeAuthError(
        e,
        fallback: 'Inscription impossible pour le moment. Réessayez plus tard.',
      );

      state = state.copyWith(isLoading: false, error: message, errorCode: code);
    }
  }


  Future<void> verifyOtp(String email, String token, OtpType otpType) async {
    final normalizedEmail = _normalizeEmail(email);
    final normalizedToken = token.trim();
    _log('verifyOtp start: email=$normalizedEmail, type=$otpType');

    if (normalizedEmail.isEmpty || normalizedToken.isEmpty) {
      state = state.copyWith(isLoading: false, error: 'Code OTP invalide.');
      return;
    }

    state = state.copyWith(isLoading: true, error: null, errorCode: null);
    try {
      final response = await Supabase.instance.client.auth.verifyOTP(
        type: otpType,
        email: normalizedEmail,
        token: normalizedToken,
      );

      if (response.user == null) {
        state = state.copyWith(isLoading: false, error: 'OTP invalide.');
        return;
      }

      state = state.copyWith(user: response.user, isLoading: false);
      await _loadProfile();
      _log('verifyOtp success: userId=${response.user!.id}');
    } catch (e) {
      _log('verifyOtp error: $e');
      String message = e.toString();
      if (e is AuthApiException) {
        message = e.message;
      }
      state = state.copyWith(isLoading: false, error: message);
    }
  }

  Future<void> signOut() async {
    _log('signOut start');
    state = state.copyWith(isLoading: true);
    try {
      final userId = state.user?.id;
      await Supabase.instance.client.auth.signOut();
      _log('signOut success');
      
      // Clear saved email if remember me is off
      final prefs = await SharedPreferences.getInstance();
      final remember = prefs.getBool(_kRememberMe) ?? true;
      if (!remember) {
        await _clearSavedEmail();
      }
      
      state = AuthState();
    } catch (e) {
      _log('signOut error: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void clearError() {
    state = state.copyWith(error: null, errorCode: null);
  }

  Future<void> resendEmailConfirmation(String email, [OtpType? otpType]) async {
    final normalizedEmail = _normalizeEmail(email);
    final type = otpType ?? OtpType.signup;
    _log('resendEmailConfirmation start: email=$normalizedEmail, type=$type');
    try {
      await Supabase.instance.client.auth.resend(
        type: type,
        email: normalizedEmail,
      );
      _log('resendEmailConfirmation success');
    } catch (e) {
      _log('resendEmailConfirmation error: $e');
      rethrow;
    }
  }

  // Remember me methods
  Future<bool> getRememberMe() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kRememberMe) ?? true;
  }

  Future<void> setRememberMe(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kRememberMe, value);
    _log('setRememberMe: $value');
  }

  Future<String?> getSavedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kSavedEmail);
  }

  Future<void> _saveEmail(String email) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kSavedEmail, email);
    _log('_saveEmail: $email');
  }

  Future<void> _clearSavedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kSavedEmail);
    _log('_clearSavedEmail');
  }

  Future<void> enforceRememberMePolicy() async {
    final remember = await getRememberMe();
    if (!remember && state.user != null) {
      _log('enforceRememberMePolicy: remember me is off, signing out');
      await signOut();
    }
  }
}
