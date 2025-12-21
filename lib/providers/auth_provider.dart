import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user.dart';
import '../services/supabase_service.dart';

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
  AuthNotifier() : super(AuthState()) {
    _init();
  }

  void _log(String message) {
    debugPrint('[Auth] $message');
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
          await SupabaseService.updateUserProfile({
            'email': user.email,
            if (fullName != null && fullName.trim().isNotEmpty) 'full_name': fullName.trim(),
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

  Future<void> signIn(String email, String password) async {
    _log('signIn start: email=$email');
    state = state.copyWith(isLoading: true, error: null, errorCode: null);
    try {
      final response = await Supabase.instance.client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      
      if (response.user != null) {
        _log('signIn success: userId=${response.user!.id}, hasSession=${response.session != null}');
        state = state.copyWith(user: response.user, isLoading: false);
        await _loadProfile();
      } else {
        _log('signIn finished but user is null');
        state = state.copyWith(isLoading: false, error: 'Connexion échouée.');
      }
    } catch (e) {
      _log('signIn error: $e');
      String message = e.toString();
      String? code;

      if (e is AuthApiException) {
        code = e.code;
        _log('signIn AuthApiException: statusCode=${e.statusCode}, code=${e.code}, message=${e.message}');
        if (e.code == 'invalid_credentials') {
          message =
              'Connexion refusée. Vérifie le mot de passe OU confirme ton email (regarde ta boîte mail).';
        }
      }

      state = state.copyWith(isLoading: false, error: message, errorCode: code);
    }
  }

  Future<void> signUp(String email, String password, String fullName) async {
    _log('signUp start: email=$email, fullName=$fullName');
    state = state.copyWith(isLoading: true, error: null, errorCode: null);
    try {
      final response = await Supabase.instance.client.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
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
        await SupabaseService.updateUserProfile({
          'full_name': fullName,
          'email': email,
        });
        _log('Profile upsert after signUp: OK');
      } catch (e) {
        _log('Profile upsert after signUp failed: $e');
      }

      state = state.copyWith(user: response.user, isLoading: false, needsEmailConfirmation: false);
      await _loadProfile();
    } catch (e) {
      _log('signUp error: $e');
      String message = e.toString();
      String? code;

      if (e is AuthApiException) {
        code = e.code;
        _log('signUp AuthApiException: statusCode=${e.statusCode}, code=${e.code}, message=${e.message}');
      }

      state = state.copyWith(isLoading: false, error: message, errorCode: code);
    }
  }

  Future<void> signOut() async {
    _log('signOut start');
    state = state.copyWith(isLoading: true);
    try {
      await Supabase.instance.client.auth.signOut();
      _log('signOut success');
      state = AuthState();
    } catch (e) {
      _log('signOut error: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void clearError() {
    state = state.copyWith(error: null, errorCode: null);
  }

  Future<void> resendEmailConfirmation(String email) async {
    _log('resendEmailConfirmation start: email=$email');
    try {
      await Supabase.instance.client.auth.resend(
        type: OtpType.signup,
        email: email,
      );
      _log('resendEmailConfirmation success');
    } catch (e) {
      _log('resendEmailConfirmation error: $e');
      rethrow;
    }
  }
}
