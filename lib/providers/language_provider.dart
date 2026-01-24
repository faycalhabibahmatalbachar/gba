import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
    if (stored == null || stored.isEmpty) return;
    _locale = Locale(stored, '');
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, _locale.languageCode);
  }
  
  void setLocale(Locale locale) {
    _locale = locale;
    notifyListeners();
    _persist();
  }
}
