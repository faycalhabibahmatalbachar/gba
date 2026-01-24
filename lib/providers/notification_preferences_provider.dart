import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationPreferencesProvider extends ChangeNotifier {
  static const _keyPushEnabled = 'push_enabled';
  static const _keyCategoryOrders = 'push_cat_orders';
  static const _keyCategoryPromotions = 'push_cat_promotions';
  static const _keyCategoryChat = 'push_cat_chat';

  bool _pushEnabled = true;
  bool _ordersEnabled = true;
  bool _promotionsEnabled = true;
  bool _chatEnabled = true;

  bool get pushEnabled => _pushEnabled;
  bool get ordersEnabled => _ordersEnabled;
  bool get promotionsEnabled => _promotionsEnabled;
  bool get chatEnabled => _chatEnabled;

  NotificationPreferencesProvider() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _pushEnabled = prefs.getBool(_keyPushEnabled) ?? true;
    _ordersEnabled = prefs.getBool(_keyCategoryOrders) ?? true;
    _promotionsEnabled = prefs.getBool(_keyCategoryPromotions) ?? true;
    _chatEnabled = prefs.getBool(_keyCategoryChat) ?? true;
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyPushEnabled, _pushEnabled);
    await prefs.setBool(_keyCategoryOrders, _ordersEnabled);
    await prefs.setBool(_keyCategoryPromotions, _promotionsEnabled);
    await prefs.setBool(_keyCategoryChat, _chatEnabled);
  }

  void setPushEnabled(bool value) {
    _pushEnabled = value;
    notifyListeners();
    _persist();
  }

  void setOrdersEnabled(bool value) {
    _ordersEnabled = value;
    notifyListeners();
    _persist();
  }

  void setPromotionsEnabled(bool value) {
    _promotionsEnabled = value;
    notifyListeners();
    _persist();
  }

  void setChatEnabled(bool value) {
    _chatEnabled = value;
    notifyListeners();
    _persist();
  }

  bool isCategoryEnabled(String? category) {
    if (!_pushEnabled) return false;
    switch (category) {
      case 'orders':
        return _ordersEnabled;
      case 'promotions':
        return _promotionsEnabled;
      case 'chat':
        return _chatEnabled;
      default:
        return true;
    }
  }
}
