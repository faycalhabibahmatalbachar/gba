import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/activity_tracking_service.dart';

final favoritesProvider = ChangeNotifierProvider<FavoritesProvider>((ref) {
  return FavoritesProvider();
});

class FavoritesProvider extends ChangeNotifier {
  static const String _prefsKey = 'favorite_product_ids';
  static final _db = Supabase.instance.client;

  final List<String> _favoriteIds = [];
  bool _loading = false;
  RealtimeChannel? _channel;

  List<String> get favoriteIds => List.unmodifiable(_favoriteIds);
  bool get isLoading => _loading;

  FavoritesProvider() {
    _init();
    _db.auth.onAuthStateChange.listen((event) {
      if (event.event == AuthChangeEvent.signedIn) {
        _syncFromSupabase();
        _subscribeRealtime();
      } else if (event.event == AuthChangeEvent.signedOut) {
        _channel?.unsubscribe();
        _favoriteIds.clear();
        _clearLocal();
        notifyListeners();
      }
    });
  }

  Future<void> _init() async {
    await _loadLocal();
    final user = _db.auth.currentUser;
    if (user != null) {
      await _syncFromSupabase();
      _subscribeRealtime();
    }
  }

  Future<void> _loadLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getStringList(_prefsKey) ?? [];
    _favoriteIds..clear()..addAll(stored);
    notifyListeners();
  }

  Future<void> _saveLocal() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_prefsKey, List<String>.from(_favoriteIds));
  }

  Future<void> _clearLocal() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
  }

  Future<void> _syncFromSupabase() async {
    final userId = _db.auth.currentUser?.id;
    if (userId == null) return;
    try {
      _loading = true;
      notifyListeners();
      final response = await _db
          .from('favorites')
          .select('product_id')
          .eq('user_id', userId);
      _favoriteIds.clear();
      _favoriteIds.addAll(
        (response as List).map((f) => f['product_id'] as String),
      );
      await _saveLocal();
    } catch (e) {
      debugPrint('[FavoritesProvider] sync error: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void _subscribeRealtime() {
    final userId = _db.auth.currentUser?.id;
    if (userId == null) return;
    _channel?.unsubscribe();
    _channel = _db
        .channel('favorites-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'favorites',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            final id = payload.newRecord['product_id'] as String?;
            if (id != null && !_favoriteIds.contains(id)) {
              _favoriteIds.add(id);
              _saveLocal();
              notifyListeners();
            }
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.delete,
          schema: 'public',
          table: 'favorites',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            final id = payload.oldRecord['product_id'] as String?;
            if (id != null) {
              _favoriteIds.remove(id);
              _saveLocal();
              notifyListeners();
            }
          },
        )
        .subscribe();
  }

  bool isFavorite(String productId) => _favoriteIds.contains(productId);

  Future<void> toggleFavorite(String productId, {String? productName}) async {
    final userId = _db.auth.currentUser?.id;
    final wasFavorite = _favoriteIds.contains(productId);

    // Mise à jour optimiste de l'UI
    if (wasFavorite) {
      _favoriteIds.remove(productId);
    } else {
      _favoriteIds.add(productId);
    }
    notifyListeners();
    await _saveLocal();

    // Persistance Supabase
    try {
      if (userId != null) {
        if (wasFavorite) {
          await _db
              .from('favorites')
              .delete()
              .eq('user_id', userId)
              .eq('product_id', productId);
          ActivityTrackingService()
              .trackFavoriteRemove(productId, productName ?? productId);
        } else {
          await _db.from('favorites').upsert({
            'user_id': userId,
            'product_id': productId,
          });
          ActivityTrackingService()
              .trackFavoriteAdd(productId, productName ?? productId);
        }
      }
    } catch (e) {
      // Rollback en cas d'erreur
      debugPrint('[FavoritesProvider] toggle error: $e');
      if (wasFavorite) {
        _favoriteIds.add(productId);
      } else {
        _favoriteIds.remove(productId);
      }
      notifyListeners();
      await _saveLocal();
    }
  }

  Future<void> refresh() => _syncFromSupabase();

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}
