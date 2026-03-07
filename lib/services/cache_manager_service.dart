import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Enterprise-grade caching service with 3-tier architecture
/// Tier 1: Memory cache (ultra-fast)
/// Tier 2: Disk cache (persistent)
/// Tier 3: Network (source of truth)
class CacheManagerService {
  static final CacheManagerService _instance = CacheManagerService._internal();
  factory CacheManagerService() => _instance;
  CacheManagerService._internal();

  // Memory cache (Tier 1)
  final Map<String, _CacheEntry> _memoryCache = {};
  
  // Cache strategies
  static const Duration defaultTTL = Duration(minutes: 5);
  static const Duration productsTTL = Duration(minutes: 5);
  static const Duration categoriesTTL = Duration(minutes: 10);
  static const Duration cartTTL = Duration(seconds: 30);
  static const Duration favoritesTTL = Duration(minutes: 3);
  static const Duration bannersTTL = Duration(minutes: 15);
  
  // Memory cache size limit (entries)
  static const int maxMemoryCacheSize = 100;
  
  /// Get cached data with TTL validation
  Future<T?> get<T>(
    String key, {
    Duration? ttl,
    bool memoryOnly = false,
  }) async {
    final effectiveTTL = ttl ?? defaultTTL;
    
    // Tier 1: Check memory cache
    final memEntry = _memoryCache[key];
    if (memEntry != null && !memEntry.isExpired(effectiveTTL)) {
      debugPrint('✅ [Cache] Memory HIT: $key');
      return memEntry.data as T?;
    }
    
    if (memoryOnly) {
      debugPrint('⚠️ [Cache] Memory MISS: $key (memory-only mode)');
      return null;
    }
    
    // Tier 2: Check disk cache
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('cache_$key');
      
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        final timestamp = DateTime.parse(decoded['timestamp'] as String);
        final age = DateTime.now().difference(timestamp);
        
        if (age <= effectiveTTL) {
          final data = decoded['data'];
          
          // Promote to memory cache
          _setMemoryCache(key, data);
          
          debugPrint('✅ [Cache] Disk HIT: $key (age: ${age.inSeconds}s)');
          return data as T?;
        } else {
          debugPrint('⏰ [Cache] Disk EXPIRED: $key (age: ${age.inSeconds}s > ${effectiveTTL.inSeconds}s)');
          await prefs.remove('cache_$key');
        }
      }
    } catch (e) {
      debugPrint('❌ [Cache] Disk read error for $key: $e');
    }
    
    debugPrint('❌ [Cache] MISS: $key');
    return null;
  }
  
  /// Set cache data (both memory and disk)
  Future<void> set(
    String key,
    dynamic data, {
    bool memoryOnly = false,
  }) async {
    // Tier 1: Set memory cache
    _setMemoryCache(key, data);
    
    if (memoryOnly) {
      debugPrint('💾 [Cache] Memory SET: $key (memory-only)');
      return;
    }
    
    // Tier 2: Set disk cache
    try {
      final prefs = await SharedPreferences.getInstance();
      final payload = {
        'timestamp': DateTime.now().toIso8601String(),
        'data': data,
      };
      await prefs.setString('cache_$key', jsonEncode(payload));
      debugPrint('💾 [Cache] Disk SET: $key');
    } catch (e) {
      debugPrint('❌ [Cache] Disk write error for $key: $e');
    }
  }
  
  /// Set memory cache with LRU eviction
  void _setMemoryCache(String key, dynamic data) {
    // LRU eviction if cache is full
    if (_memoryCache.length >= maxMemoryCacheSize) {
      final oldestKey = _memoryCache.entries
          .reduce((a, b) => a.value.timestamp.isBefore(b.value.timestamp) ? a : b)
          .key;
      _memoryCache.remove(oldestKey);
      debugPrint('🗑️ [Cache] Evicted oldest entry: $oldestKey');
    }
    
    _memoryCache[key] = _CacheEntry(data: data, timestamp: DateTime.now());
  }
  
  /// Invalidate cache entry
  Future<void> invalidate(String key) async {
    _memoryCache.remove(key);
    
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cache_$key');
      debugPrint('🗑️ [Cache] Invalidated: $key');
    } catch (e) {
      debugPrint('❌ [Cache] Invalidation error for $key: $e');
    }
  }
  
  /// Invalidate all cache entries matching pattern
  Future<void> invalidatePattern(String pattern) async {
    // Memory cache
    final keysToRemove = _memoryCache.keys
        .where((k) => k.contains(pattern))
        .toList();
    
    for (final key in keysToRemove) {
      _memoryCache.remove(key);
    }
    
    // Disk cache
    try {
      final prefs = await SharedPreferences.getInstance();
      final allKeys = prefs.getKeys();
      final matchingKeys = allKeys
          .where((k) => k.startsWith('cache_') && k.contains(pattern))
          .toList();
      
      for (final key in matchingKeys) {
        await prefs.remove(key);
      }
      
      debugPrint('🗑️ [Cache] Invalidated pattern: $pattern (${keysToRemove.length + matchingKeys.length} entries)');
    } catch (e) {
      debugPrint('❌ [Cache] Pattern invalidation error: $e');
    }
  }
  
  /// Clear all cache
  Future<void> clearAll() async {
    _memoryCache.clear();
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final allKeys = prefs.getKeys();
      final cacheKeys = allKeys.where((k) => k.startsWith('cache_')).toList();
      
      for (final key in cacheKeys) {
        await prefs.remove(key);
      }
      
      debugPrint('🗑️ [Cache] Cleared all cache (${cacheKeys.length} entries)');
    } catch (e) {
      debugPrint('❌ [Cache] Clear all error: $e');
    }
  }
  
  /// Get cache statistics
  Map<String, dynamic> getStats() {
    return {
      'memory_entries': _memoryCache.length,
      'memory_size_limit': maxMemoryCacheSize,
      'memory_usage_percent': (_memoryCache.length / maxMemoryCacheSize * 100).toStringAsFixed(1),
    };
  }
  
  /// Warm up cache with frequently accessed data
  Future<void> warmUp(Map<String, dynamic> data) async {
    for (final entry in data.entries) {
      await set(entry.key, entry.value);
    }
    debugPrint('🔥 [Cache] Warmed up ${data.length} entries');
  }
}

/// Cache entry with timestamp
class _CacheEntry {
  final dynamic data;
  final DateTime timestamp;
  
  _CacheEntry({required this.data, required this.timestamp});
  
  bool isExpired(Duration ttl) {
    final age = DateTime.now().difference(timestamp);
    return age > ttl;
  }
}

/// Cache keys constants
class CacheKeys {
  static const String products = 'products_list';
  static const String categories = 'categories_list';
  static const String banners = 'banners_list';
  static const String cart = 'cart_items';
  static const String favorites = 'favorites_list';
  static const String recommendations = 'recommendations_list';
  
  static String product(String id) => 'product_$id';
  static String category(String id) => 'category_$id';
  static String userProfile(String id) => 'profile_$id';
  static String productReviews(String id) => 'reviews_$id';
}
