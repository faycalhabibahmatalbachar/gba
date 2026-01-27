import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class LanguageProvider extends ChangeNotifier {
  static const _prefsKey = 'app_locale';

  Locale _locale = const Locale('fr', '');
  
  Locale get locale => _locale;

  LanguageProvider() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_prefsKey);
    if (stored != null && stored.isNotEmpty) {
      _locale = Locale(stored, '');
      notifyListeners();
    }
    await _syncToSupabase();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, _locale.languageCode);
  }
  
  void setLocale(Locale locale) {
    if (locale.languageCode == _locale.languageCode) return;
    _locale = locale;
    notifyListeners();
    _persist();
    _syncToSupabase();
  }

  Future<void> _syncToSupabase() async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;

    final languageCode = _locale.languageCode;

    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(data: {'locale': languageCode}),
      );
    } catch (_) {}

    try {
      await Supabase.instance.client
          .from('profiles')
          .update({'language_preference': languageCode})
          .eq('id', userId);
    } catch (_) {}

    try {
      await Supabase.instance.client
          .from('device_tokens')
          .update({
            'locale': languageCode,
            'last_seen_at': DateTime.now().toIso8601String(),
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('user_id', userId);
    } catch (_) {}
  }
}
