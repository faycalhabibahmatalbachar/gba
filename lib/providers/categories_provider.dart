import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

import '../models/category.dart';
import '../services/supabase_service.dart';

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  return SupabaseService.getCategories();
});

class CategoriesProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  static const String _cacheKey = 'cache_categories_v1';
  static const String _cacheSyncKey = 'cache_categories_v1_sync';
  List<dynamic> _categories = [];
  Map<String, int> _productCounts = {};
  bool _isLoading = false;
  String? _error;
  DateTime? _lastSyncedAt;
  
  List<dynamic> get categories => _categories;
  Map<String, int> get productCounts => _productCounts;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  CategoriesProvider() {
    _hydrateFromCache();
    loadCategories();
  }

  Future<void> _hydrateFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw == null || raw.trim().isEmpty) return;

      final decoded = jsonDecode(raw);
      if (decoded is! List) return;

      final cached = decoded
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (cached.isEmpty) return;

      final syncRaw = prefs.getString(_cacheSyncKey);
      final syncAt = (syncRaw != null) ? DateTime.tryParse(syncRaw) : null;

      _categories = cached;
      _lastSyncedAt = syncAt;
      notifyListeners();
    } catch (e) {
      print('Erreur cache catégories (hydrate): $e');
    }
  }

  Future<void> _persistToCache(List<Map<String, dynamic>> categories, DateTime? syncAt) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, jsonEncode(categories));
      if (syncAt != null) {
        await prefs.setString(_cacheSyncKey, syncAt.toIso8601String());
      }
    } catch (e) {
      print('Erreur cache catégories (persist): $e');
    }
  }
  
  Future<void> loadCategories({bool force = false}) async {
    if (_isLoading) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final lastSync = _lastSyncedAt;
      List<Map<String, dynamic>> incoming;

      if (!force && lastSync != null) {
        try {
          final response = await _supabase
              .from('categories')
              .select('*')
              .gt('updated_at', lastSync.toIso8601String())
              .order('updated_at', ascending: false);
          incoming = (response as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();

          if (incoming.isNotEmpty) {
            final byId = <String, Map<String, dynamic>>{};
            for (final c in _categories.whereType<Map>()) {
              final id = c['id']?.toString();
              if (id != null) byId[id] = Map<String, dynamic>.from(c);
            }
            for (final c in incoming) {
              final id = c['id']?.toString();
              if (id == null) continue;
              final isActive = c['is_active'];
              if (isActive == false) {
                byId.remove(id);
              } else {
                byId[id] = c;
              }
            }
            _categories = byId.values.toList()
              ..sort((a, b) => (a['display_order'] as num? ?? 0).compareTo((b['display_order'] as num? ?? 0)));
          }
        } catch (_) {
          _lastSyncedAt = null;
          force = true;
        }
      } else {
        final response = await _supabase
            .from('categories')
            .select('*')
            .order('display_order');
        incoming = (response as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _categories = incoming;
      }

      if (force) {
        final response = await _supabase
            .from('categories')
            .select('*')
            .order('display_order');
        incoming = (response as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _categories = incoming;
      }

      DateTime? maxUpdated;
      for (final c in _categories.whereType<Map>()) {
        final raw = c['updated_at'];
        final dt = raw is String ? DateTime.tryParse(raw) : null;
        if (dt == null) continue;
        if (maxUpdated == null || dt.isAfter(maxUpdated)) maxUpdated = dt;
      }

      _lastSyncedAt = maxUpdated ?? DateTime.now();
      await _persistToCache(
        _categories.whereType<Map<String, dynamic>>().toList(),
        _lastSyncedAt,
      );
      
      // Load product counts per category
      await _loadProductCounts();
    } catch (e) {
      _error = e.toString();
      print('Erreur chargement catégories: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<void> _loadProductCounts() async {
    try {
      final response = await _supabase
          .from('products')
          .select('category_id')
          .eq('is_active', true);
      
      final counts = <String, int>{};
      for (final product in (response as List)) {
        final catId = product['category_id']?.toString();
        if (catId != null && catId.isNotEmpty) {
          counts[catId] = (counts[catId] ?? 0) + 1;
        }
      }
      
      _productCounts = counts;
      print('✅ Product counts loaded: ${counts.length} categories');
    } catch (e) {
      print('❌ Error loading product counts: $e');
    }
  }
}
