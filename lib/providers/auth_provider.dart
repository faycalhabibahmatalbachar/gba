import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  AuthState({
    this.user,
    this.profile,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    User? user,
    UserProfile? profile,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      profile: profile ?? this.profile,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(AuthState()) {
    _init();
  }

  void _init() {
    final user = SupabaseService.currentUser;
    if (user != null) {
      state = state.copyWith(user: user);
      _loadProfile();
    }

    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      final user = data.session?.user;
      state = state.copyWith(user: user);
      if (user != null) {
        _loadProfile();
      } else {
        state = state.copyWith(profile: null);
      }
    });
  }

  Future<void> _loadProfile() async {
    final profile = await SupabaseService.getUserProfile();
    if (profile != null) {
      state = state.copyWith(profile: profile);
    }
  }

  Future<void> signIn(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await Supabase.instance.client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      
      if (response.user != null) {
        state = state.copyWith(user: response.user, isLoading: false);
        await _loadProfile();
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> signUp(String email, String password, String fullName) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await Supabase.instance.client.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
      );
      
      if (response.user != null) {
        // Create profile
        await SupabaseService.updateUserProfile({
          'full_name': fullName,
          'email': email,
        });
        
        state = state.copyWith(user: response.user, isLoading: false);
        await _loadProfile();
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> signOut() async {
    state = state.copyWith(isLoading: true);
    try {
      await Supabase.instance.client.auth.signOut();
      state = AuthState();
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}
