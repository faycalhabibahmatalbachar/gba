import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Centralized TTL-aware cache wrapper over SharedPreferences.
///
/// Usage:
/// ```dart
/// final cache = CacheService.instance;
/// final List<Map>? data = await cache.get('cart_userId', CacheTTL.cart);
/// await cache.set('cart_userId', data);
/// await cache.invalidate('cart_userId');
/// await cache.invalidatePattern('cart_');
/// ```
class CacheService {
  CacheService._();
  static final CacheService instance = CacheService._();

  static const String _expiresAtSuffix = '__exp';

  // ─── TTL constants ──────────────────────────────────────────────────────────
  static const Duration ttlProducts   = Duration(minutes: 5);
  static const Duration ttlCategories = Duration(minutes: 10);
  static const Duration ttlBanners    = Duration(minutes: 2);
  static const Duration ttlCart       = Duration(minutes: 30);
  static const Duration ttlOrders     = Duration(minutes: 10);
  static const Duration ttlSpecials   = Duration(minutes: 15);
  static const Duration ttlProfile    = Duration(minutes: 15);
  static const Duration ttlMessages   = Duration(minutes: 5);
  static const Duration ttlRecommendations = Duration(minutes: 10);

  // ─── Public API ─────────────────────────────────────────────────────────────

  /// Returns decoded JSON value if present and not expired; null otherwise.
  Future<dynamic> get(String key, Duration ttl) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final expMs = prefs.getInt('$key$_expiresAtSuffix');
      if (expMs != null) {
        final exp = DateTime.fromMillisecondsSinceEpoch(expMs);
        if (DateTime.now().isAfter(exp)) {
          await _remove(prefs, key);
          return null;
        }
      } else {
        return null;
      }
      final raw = prefs.getString(key);
      if (raw == null || raw.trim().isEmpty) return null;
      return jsonDecode(raw);
    } catch (e) {
      _log('get($key) error: $e');
      return null;
    }
  }

  /// Encodes [value] as JSON and persists with an expiry timestamp.
  Future<void> set(String key, dynamic value, Duration ttl) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final exp = DateTime.now().add(ttl).millisecondsSinceEpoch;
      await prefs.setString(key, jsonEncode(value));
      await prefs.setInt('$key$_expiresAtSuffix', exp);
    } catch (e) {
      _log('set($key) error: $e');
    }
  }

  /// Removes a single cache entry and its expiry key.
  Future<void> invalidate(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await _remove(prefs, key);
    } catch (e) {
      _log('invalidate($key) error: $e');
    }
  }

  /// Removes all cache entries whose key starts with [prefix].
  Future<void> invalidatePattern(String prefix) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys()
          .where((k) => k.startsWith(prefix) && !k.endsWith(_expiresAtSuffix))
          .toList();
      for (final k in keys) {
        await _remove(prefs, k);
      }
    } catch (e) {
      _log('invalidatePattern($prefix) error: $e');
    }
  }

  /// Returns raw string (already JSON) without TTL check — for legacy compat.
  Future<String?> getRaw(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(key);
    } catch (_) {
      return null;
    }
  }

  /// Persist raw string without TTL — for legacy compat.
  Future<void> setRaw(String key, String value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    } catch (_) {}
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  Future<void> _remove(SharedPreferences prefs, String key) async {
    await prefs.remove(key);
    await prefs.remove('$key$_expiresAtSuffix');
  }

  void _log(String msg) {
    if (kDebugMode) debugPrint('[CacheService] $msg');
  }
}
