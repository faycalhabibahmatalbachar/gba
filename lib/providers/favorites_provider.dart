import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/activity_tracking_service.dart';

final favoritesProvider = ChangeNotifierProvider<FavoritesProvider>((ref) {
  return FavoritesProvider();
});

class FavoritesProvider extends ChangeNotifier {
  static const String _prefsKey = 'favorite_product_ids';

  final List<String> _favoriteIds = [];
  
  List<String> get favoriteIds => _favoriteIds;

  FavoritesProvider() {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getStringList(_prefsKey) ?? const <String>[];
    _favoriteIds
      ..clear()
      ..addAll(stored);
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_prefsKey, List<String>.from(_favoriteIds));
  }
  
  bool isFavorite(String productId) {
    return _favoriteIds.contains(productId);
  }
  
  void toggleFavorite(String productId, {String? productName}) {
    if (_favoriteIds.contains(productId)) {
      _favoriteIds.remove(productId);
      ActivityTrackingService().trackFavoriteRemove(productId, productName ?? productId);
    } else {
      _favoriteIds.add(productId);
      ActivityTrackingService().trackFavoriteAdd(productId, productName ?? productId);
    }
    notifyListeners();
    _persist();
  }
}
