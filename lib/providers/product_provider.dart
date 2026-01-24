import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/product.dart';

class ProductProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  static const String _cacheKey = 'cache_products_v1';
  static const String _cacheAtKey = 'cache_products_v1_at';
  static const String _cacheSyncKey = 'cache_products_v1_sync';
  List<Product> _products = [];
  bool _isLoading = false;
  String? _error;
  DateTime? _lastLoadedAt;
  DateTime? _lastSyncedAt;
  
  List<Product> get products => _products;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  ProductProvider() {
    _hydrateFromCache();
    loadProducts();
  }

  Future<void> _hydrateFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw == null || raw.trim().isEmpty) return;

      final decoded = jsonDecode(raw);
      if (decoded is! List) return;

      final cachedProducts = decoded
          .whereType<Map>()
          .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
          .toList();

      if (cachedProducts.isEmpty) return;

      final cachedAtMillis = prefs.getInt(_cacheAtKey);
      final cachedAt = (cachedAtMillis != null)
          ? DateTime.fromMillisecondsSinceEpoch(cachedAtMillis)
          : null;

      _products = cachedProducts;
      _lastLoadedAt = cachedAt ?? DateTime.now();

      final syncRaw = prefs.getString(_cacheSyncKey);
      _lastSyncedAt = (syncRaw != null) ? DateTime.tryParse(syncRaw) : null;
      notifyListeners();
    } catch (e) {
      print('Erreur cache produits (hydrate): $e');
    }
  }

  Future<void> _persistToCache(List<Product> products, DateTime savedAt) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final payload = jsonEncode(products.map((p) => p.toJson()).toList());
      await prefs.setString(_cacheKey, payload);
      await prefs.setInt(_cacheAtKey, savedAt.millisecondsSinceEpoch);
      if (_lastSyncedAt != null) {
        await prefs.setString(_cacheSyncKey, _lastSyncedAt!.toIso8601String());
      }
    } catch (e) {
      print('Erreur cache produits (persist): $e');
    }
  }
  
  Future<void> loadProducts({bool force = false}) async {
    if (_isLoading) return;

    final now = DateTime.now();
    if (!force && _products.isNotEmpty && _lastLoadedAt != null) {
      final age = now.difference(_lastLoadedAt!);
      if (age < const Duration(seconds: 30)) {
        return;
      }
    }

    final shouldShowLoading = _products.isEmpty;
    if (shouldShowLoading) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    } else {
      _error = null;
    }
    
    try {
      Product _mapProduct(Map<String, dynamic> item) {
        final rawTags = item['tags'];
        final rawImages = item['images'];
        final rawSpecs = item['specifications'];

        final quantityRaw = item['quantity'];
        final reviewsCountRaw = item['reviews_count'];
        final trackQuantityRaw = item['track_quantity'];
        final isFeaturedRaw = item['is_featured'];
        final isActiveRaw = item['is_active'];
        final compareAtPriceRaw = item['compare_at_price'];

        final tags = (rawTags is List)
            ? rawTags.map((e) => e.toString()).toList()
            : <String>[];

        final images = (rawImages is List)
            ? rawImages.map((e) => e.toString()).toList()
            : <String>[];

        final specifications = (rawSpecs is Map)
            ? Map<String, dynamic>.from(rawSpecs as Map)
            : <String, dynamic>{};

        final createdAtRaw = item['created_at'];
        final updatedAtRaw = item['updated_at'];

        return Product(
          id: item['id'].toString(),
          name: item['name'] ?? '',
          slug: item['slug'],
          description: item['description'],
          price: (item['price'] ?? 0).toDouble(),
          compareAtPrice: (compareAtPriceRaw is num)
              ? compareAtPriceRaw.toDouble()
              : null,
          sku: item['sku'],
          quantity: (quantityRaw is num) ? quantityRaw.toInt() : 0,
          trackQuantity: (trackQuantityRaw is bool) ? trackQuantityRaw : true,
          categoryId: item['category_id']?.toString(),
          brand: item['brand'],
          mainImage: item['main_image'],
          images: images,
          specifications: specifications,
          tags: tags,
          rating: (item['rating'] ?? 0).toDouble(),
          reviewsCount: (reviewsCountRaw is num) ? reviewsCountRaw.toInt() : 0,
          isFeatured: (isFeaturedRaw is bool) ? isFeaturedRaw : false,
          isActive: (isActiveRaw is bool) ? isActiveRaw : true,
          createdAt: createdAtRaw is String ? DateTime.tryParse(createdAtRaw) : null,
          updatedAt: updatedAtRaw is String ? DateTime.tryParse(updatedAtRaw) : null,
        );
      }

      final lastSync = _lastSyncedAt;
      if (!force && lastSync != null && _products.isNotEmpty) {
        try {
          final response = await _supabase
              .from('products')
              .select('*')
              .gt('updated_at', lastSync.toIso8601String())
              .order('updated_at', ascending: false);
          final incoming = (response as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();

          if (incoming.isNotEmpty) {
            final byId = <String, Product>{
              for (final p in _products) p.id: p,
            };
            for (final item in incoming) {
              final id = item['id']?.toString();
              if (id == null) continue;
              final isActive = item['is_active'];
              if (isActive == false) {
                byId.remove(id);
              } else {
                byId[id] = _mapProduct(item);
              }
            }
            _products = byId.values.toList();
          }
        } catch (_) {
          _lastSyncedAt = null;
          force = true;
        }
      } else {
        final response = await _supabase
            .from('products')
            .select('*')
            .order('created_at', ascending: false);
        _products = (response as List)
            .whereType<Map>()
            .map((item) => _mapProduct(Map<String, dynamic>.from(item)))
            .toList();
      }

      if (force) {
        final response = await _supabase
            .from('products')
            .select('*')
            .order('created_at', ascending: false);
        _products = (response as List)
            .whereType<Map>()
            .map((item) => _mapProduct(Map<String, dynamic>.from(item)))
            .toList();
      }

      _products.sort((a, b) {
        final da = a.createdAt;
        final db = b.createdAt;
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return db.compareTo(da);
      });

      DateTime? maxUpdated;
      for (final p in _products) {
        final dt = p.updatedAt;
        if (dt == null) continue;
        if (maxUpdated == null || dt.isAfter(maxUpdated)) maxUpdated = dt;
      }
      _lastSyncedAt = maxUpdated ?? now;
      _lastLoadedAt = now;
      await _persistToCache(_products, now);
    } catch (e) {
      _error = e.toString();
      print('Erreur chargement produits: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
