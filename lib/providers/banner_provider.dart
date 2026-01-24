import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

import '../models/app_banner.dart';

class BannerProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;

  static const String _cacheKey = 'cache_banners_v1';
  static const String _cacheSyncKey = 'cache_banners_v1_sync';

  List<AppBanner> _banners = [];
  bool _isLoading = false;
  String? _error;
  DateTime? _lastLoadedAt;
  DateTime? _lastSyncedAt;

  List<AppBanner> get banners => _banners;
  bool get isLoading => _isLoading;
  String? get error => _error;

  AppBanner? get activeBanner {
    final now = DateTime.now();
    AppBanner? firstActive;

    for (final b in _banners) {
      if (!b.isCurrentlyActive(now)) continue;
      firstActive ??= b;

      final imageUrl = b.imageUrl?.trim();
      if (imageUrl != null && imageUrl.isNotEmpty) {
        return b;
      }
    }

    return firstActive;
  }

  BannerProvider() {
    _hydrateFromCache();
    loadBanners();
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
          .map((e) => AppBanner.fromMap(Map<String, dynamic>.from(e)))
          .toList();
      if (cached.isEmpty) return;

      final syncRaw = prefs.getString(_cacheSyncKey);
      final syncAt = (syncRaw != null) ? DateTime.tryParse(syncRaw) : null;

      _banners = cached;
      _lastSyncedAt = syncAt;
      _lastLoadedAt = DateTime.now();
      notifyListeners();
    } catch (e) {
      print('Erreur cache bannières (hydrate): $e');
    }
  }

  Future<void> _persistToCache(List<Map<String, dynamic>> rows, DateTime? syncAt) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, jsonEncode(rows));
      if (syncAt != null) {
        await prefs.setString(_cacheSyncKey, syncAt.toIso8601String());
      }
    } catch (e) {
      print('Erreur cache bannières (persist): $e');
    }
  }

  Future<void> loadBanners({bool force = false}) async {
    if (_isLoading) return;

    final now = DateTime.now();
    if (!force && _banners.isNotEmpty && _lastLoadedAt != null) {
      final age = now.difference(_lastLoadedAt!);
      if (age < const Duration(seconds: 30)) {
        return;
      }
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final lastSync = _lastSyncedAt;
      List<Map<String, dynamic>> rows;

      if (!force && lastSync != null) {
        try {
          final response = await _supabase
              .from('banners')
              .select('*')
              .gt('updated_at', lastSync.toIso8601String())
              .order('updated_at', ascending: false);
          final incoming = (response as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();

          if (incoming.isNotEmpty) {
            final byId = <String, Map<String, dynamic>>{};
            for (final b in _banners) {
              byId[b.id] = {
                'id': b.id,
                'title': b.title,
                'subtitle': b.subtitle,
                'image_path': b.imagePath,
                'image_url': b.imageUrl,
                'target_route': b.targetRoute,
                'display_order': b.displayOrder,
                'is_active': b.isActive,
                'starts_at': b.startsAt?.toIso8601String(),
                'ends_at': b.endsAt?.toIso8601String(),
                'created_at': b.createdAt?.toIso8601String(),
                'updated_at': b.updatedAt?.toIso8601String(),
              };
            }
            for (final r in incoming) {
              final id = r['id']?.toString();
              if (id == null) continue;
              final isActive = r['is_active'];
              if (isActive == false) {
                byId.remove(id);
              } else {
                byId[id] = r;
              }
            }
            rows = byId.values.toList();
          } else {
            rows = _banners
                .map((b) => {
                      'id': b.id,
                      'title': b.title,
                      'subtitle': b.subtitle,
                      'image_path': b.imagePath,
                      'image_url': b.imageUrl,
                      'target_route': b.targetRoute,
                      'display_order': b.displayOrder,
                      'is_active': b.isActive,
                      'starts_at': b.startsAt?.toIso8601String(),
                      'ends_at': b.endsAt?.toIso8601String(),
                      'created_at': b.createdAt?.toIso8601String(),
                      'updated_at': b.updatedAt?.toIso8601String(),
                    })
                .toList();
          }
        } catch (_) {
          _lastSyncedAt = null;
          force = true;
          rows = [];
        }
      } else {
        final response = await _supabase
            .from('banners')
            .select('*')
            .order('display_order', ascending: true)
            .order('created_at', ascending: false);
        rows = (response as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }

      if (force) {
        final response = await _supabase
            .from('banners')
            .select('*')
            .order('display_order', ascending: true)
            .order('created_at', ascending: false);
        rows = (response as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }

      _banners = rows.map((e) => AppBanner.fromMap(e)).toList()
        ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

      DateTime? maxUpdated;
      for (final r in rows) {
        final raw = r['updated_at'];
        final dt = raw is String ? DateTime.tryParse(raw) : null;
        if (dt == null) continue;
        if (maxUpdated == null || dt.isAfter(maxUpdated)) maxUpdated = dt;
      }

      _lastLoadedAt = now;
      _lastSyncedAt = maxUpdated ?? now;
      await _persistToCache(rows, _lastSyncedAt);
    } catch (e) {
      _error = e.toString();
      print('Erreur chargement bannières: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
