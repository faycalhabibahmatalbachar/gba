import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class OnboardingService {
  static const _keyPrefix = 'onboarding_completed_user_';
  static const _dbField = 'onboarding_completed';
  static const _missingColumnKey = 'onboarding_completed_column_missing_v1';

  Future<Map<String, dynamic>?> _fetchProfileCompletionRow(String userId) async {
    final response = await Supabase.instance.client
        .from('profiles')
        .select('first_name, last_name, email, phone, address, city')
        .eq('id', userId)
        .maybeSingle();
    return (response is Map<String, dynamic>) ? response : null;
  }

  bool _isProfileComplete(Map<String, dynamic>? row, {String? authEmail}) {
    if (row == null) return false;
    const total = 6;
    var filled = 0;
    if ((row['first_name']?.toString() ?? '').trim().isNotEmpty) filled++;
    if ((row['last_name']?.toString() ?? '').trim().isNotEmpty) filled++;
    final profileEmail = (row['email']?.toString() ?? '').trim();
    final effectiveEmail = profileEmail.isNotEmpty ? profileEmail : (authEmail ?? '').trim();
    if (effectiveEmail.isNotEmpty) filled++;
    if ((row['phone']?.toString() ?? '').trim().isNotEmpty) filled++;
    if ((row['address']?.toString() ?? '').trim().isNotEmpty) filled++;
    if ((row['city']?.toString() ?? '').trim().isNotEmpty) filled++;
    return (filled / total) >= 0.999;
  }

  Future<bool> isCompleted({required String userId}) async {
    final prefs = await SharedPreferences.getInstance();
    final local = prefs.getBool('$_keyPrefix$userId') ?? false;
    if (local) return true;

    final missingColumn = prefs.getBool(_missingColumnKey) ?? false;
    final authEmail = Supabase.instance.client.auth.currentUser?.email;
    if (missingColumn) {
      try {
        final row = await _fetchProfileCompletionRow(userId);
        final completed = _isProfileComplete(row, authEmail: authEmail);
        if (completed) {
          await prefs.setBool('$_keyPrefix$userId', true);
          try {
            await Supabase.instance.client
                .from('profiles')
                .update({_dbField: true})
                .eq('id', userId);
            await prefs.setBool(_missingColumnKey, false);
          } catch (_) {}
        }
        return completed;
      } catch (_) {
        return false;
      }
    }

    try {
      final response = await Supabase.instance.client
          .from('profiles')
          .select('$_dbField, first_name, last_name, email, phone, address, city')
          .eq('id', userId)
          .maybeSingle();

      final row = (response is Map<String, dynamic>) ? response : null;
      final remote = row?[_dbField];
      final completed = remote == true;
      if (completed) {
        await prefs.setBool('$_keyPrefix$userId', true);
        return true;
      }

      if (_isProfileComplete(row, authEmail: authEmail)) {
        await prefs.setBool('$_keyPrefix$userId', true);
        try {
          await Supabase.instance.client
              .from('profiles')
              .update({_dbField: true})
              .eq('id', userId);
        } catch (_) {}
        return true;
      }

      return false;
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains(_dbField.toLowerCase())) {
        await prefs.setBool(_missingColumnKey, true);
      }

      try {
        final row = await _fetchProfileCompletionRow(userId);
        final completed = _isProfileComplete(row, authEmail: authEmail);
        if (completed) {
          await prefs.setBool('$_keyPrefix$userId', true);
        }
        return completed;
      } catch (_) {
        return false;
      }
    }
  }

  Future<void> setCompleted({required String userId, required bool value}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_keyPrefix$userId', value);

    final missingColumn = prefs.getBool(_missingColumnKey) ?? false;
    if (missingColumn) {
      try {
        await Supabase.instance.client
            .from('profiles')
            .update({_dbField: value})
            .eq('id', userId);
        await prefs.setBool(_missingColumnKey, false);
      } catch (_) {}
      return;
    }

    try {
      await Supabase.instance.client
          .from('profiles')
          .update({_dbField: value})
          .eq('id', userId);
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('column') && msg.contains(_dbField.toLowerCase())) {
        await prefs.setBool(_missingColumnKey, true);
      }
    }
  }
}
