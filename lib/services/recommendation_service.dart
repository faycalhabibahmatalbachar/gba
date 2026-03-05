import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../models/product.dart';
import 'cache_service.dart';

class RecommendationService {
  RecommendationService({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;
  final CacheService _cache = CacheService.instance;

  String _cacheKey() {
    final uid = Supabase.instance.client.auth.currentUser?.id ?? 'anon';
    return 'recommendations_$uid';
  }

  /// Returns cached recommendations if valid, otherwise null.
  Future<List<Product>?> getCachedRecommendations() async {
    try {
      final decoded = await _cache.get(_cacheKey(), CacheService.ttlRecommendations);
      if (decoded is! List || decoded.isEmpty) return null;
      return decoded
          .whereType<Map>()
          .map((e) => Product.fromSupabase(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode) debugPrint('[Recommendations] cache read error: $e');
      return null;
    }
  }

  Future<void> _persistToCache(List<Product> products) async {
    try {
      final payload = products.map((p) => p.toJson()).toList();
      await _cache.set(_cacheKey(), payload, CacheService.ttlRecommendations);
    } catch (e) {
      if (kDebugMode) debugPrint('[Recommendations] cache write error: $e');
    }
  }

  Future<List<Product>> getRecommendations({int limit = 10}) async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      return [];
    }

    // Try backend API first, fall back to direct Supabase on CORS/network error
    try {
      final url = '${AppConfig.backendUrl}/v1/recommendations';

      final res = await _dio.get(
        url,
        queryParameters: {'limit': limit},
        options: Options(
          headers: {
            'Authorization': 'Bearer ${session.accessToken}',
          },
          responseType: ResponseType.json,
          receiveTimeout: const Duration(seconds: 8),
          sendTimeout: const Duration(seconds: 5),
        ),
      );

      final body = res.data;
      if (body is! Map) return [];

      final items = body['items'];
      if (items is! List) return [];

      final products = items
          .whereType<Map>()
          .map((e) => Product.fromSupabase(Map<String, dynamic>.from(e)))
          .toList();
      await _persistToCache(products);
      return products;
    } catch (e) {
      debugPrint('[Recommendations] API error ($e), falling back to Supabase');
      return _fallbackSupabaseRecommendations(limit);
    }
  }

  /// Fallback: fetch random/recent products directly from Supabase
  Future<List<Product>> _fallbackSupabaseRecommendations(int limit) async {
    try {
      final data = await Supabase.instance.client
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', ascending: false)
          .limit(limit);

      final products = (data as List)
          .map((e) => Product.fromSupabase(Map<String, dynamic>.from(e)))
          .toList();
      await _persistToCache(products);
      return products;
    } catch (e) {
      debugPrint('[Recommendations] Supabase fallback error: $e');
      return [];
    }
  }
}

