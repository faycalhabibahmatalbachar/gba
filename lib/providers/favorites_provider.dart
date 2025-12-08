import 'package:flutter/material.dart';

class FavoritesProvider extends ChangeNotifier {
  final List<String> _favoriteIds = [];
  
  List<String> get favoriteIds => _favoriteIds;
  
  bool isFavorite(String productId) {
    return _favoriteIds.contains(productId);
  }
  
  void toggleFavorite(String productId) {
    if (_favoriteIds.contains(productId)) {
      _favoriteIds.remove(productId);
    } else {
      _favoriteIds.add(productId);
    }
    notifyListeners();
  }
}
