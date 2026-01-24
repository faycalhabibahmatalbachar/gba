import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import '../models/profile.dart';

class ProfileService {
  final _supabase = Supabase.instance.client;
  static const String _cacheKeyPrefix = 'cache_profile_v1_';
  static const String _cacheAtKeyPrefix = 'cache_profile_v1_at_';
  static const String _coverUrlMissingKey = 'profiles_cover_url_missing_v2';
  static const String _coverUrlCacheKeyPrefix = 'cache_profile_cover_url_v1_';
  static const String _reviewsTableMissingKey = 'reviews_table_missing_v2';

  Future<bool> _isFlagEnabled(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(key) ?? false;
  }

  Future<void> _setFlagEnabled(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, true);
  }

  Future<String?> _getCachedCoverUrl(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_coverUrlCacheKeyPrefix$userId');
      if (raw == null) return null;
      final url = raw.trim();
      return url.isEmpty ? null : url;
    } catch (_) {
      return null;
    }
  }

  Future<void> _setCachedCoverUrl(String userId, String? url) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = '$_coverUrlCacheKeyPrefix$userId';
      final value = (url ?? '').trim();
      if (value.isEmpty) {
        await prefs.remove(key);
      } else {
        await prefs.setString(key, value);
      }
    } catch (_) {}
  }

  bool _isMissingColumnOrTableError(Object e) {
    if (e is PostgrestException) {
      final msg = (e.message).toLowerCase();
      if (msg.contains("could not find") || msg.contains('schema cache')) return true;
      if ((e.code ?? '').toUpperCase().startsWith('PGRST')) return true;
    }
    final s = e.toString().toLowerCase();
    return s.contains("could not find") || s.contains('schema cache') || s.contains('pgrst');
  }

  Future<void> _persistProfileCache(Profile profile) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = '$_cacheKeyPrefix${profile.id}';
      final atKey = '$_cacheAtKeyPrefix${profile.id}';
      await prefs.setString(key, jsonEncode(profile.toJson()));
      await prefs.setInt(atKey, DateTime.now().millisecondsSinceEpoch);
    } catch (e) {
      print('❌ Erreur cache profil (persist): $e');
    }
  }

  Future<Profile?> getCachedUserProfile() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return null;

      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_cacheKeyPrefix$userId');
      if (raw == null || raw.trim().isEmpty) return null;

      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return Profile.fromJson(Map<String, dynamic>.from(decoded));
    } catch (e) {
      print('❌ Erreur cache profil (hydrate): $e');
      return null;
    }
  }
  
  // Récupérer le profil de l'utilisateur actuel
  Future<Profile?> getCurrentUserProfile() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return null;
      
      final response = await _supabase
          .from('profiles')
          .select()
          .eq('id', userId)
          .single();

      final profile = Profile.fromJson(response);
      await _persistProfileCache(profile);
      return profile;
    } catch (e) {
      print('❌ Erreur lors de la récupération du profil: $e');
      return null;
    }
  }
  
  // Mettre à jour le profil
  Future<bool> updateProfile(Profile profile) async {
    try {
      // Créer un Map avec les noms de colonnes snake_case pour Supabase
      final updateData = {
        'first_name': profile.firstName,
        'last_name': profile.lastName,
        'email': profile.email,
        'phone': profile.phone,
        'bio': profile.bio,
        'address': profile.address,
        'city': profile.city,
        'postal_code': profile.postalCode,
        'last_updated': DateTime.now().toIso8601String(),
      };
      
      // Filtrer les valeurs null pour n'envoyer que les champs définis
      updateData.removeWhere((key, value) => value == null);
      
      final response = await _supabase
          .from('profiles')
          .update(updateData)
          .eq('id', profile.id);

      await _persistProfileCache(profile.copyWith(lastUpdated: DateTime.now()));
      return true;
    } catch (e) {
      print('❌ Erreur lors de la mise à jour du profil: $e');
      return false;
    }
  }
  
  // Upload et redimensionner l'avatar
  Future<String?> uploadAvatar(XFile imageFile) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return null;
      
      // Lire l'image
      Uint8List imageBytes;
      if (kIsWeb) {
        imageBytes = await imageFile.readAsBytes();
      } else {
        final file = File(imageFile.path);
        imageBytes = await file.readAsBytes();
      }
      
      // Redimensionner l'image (max 500x500)
      final decodedImage = img.decodeImage(imageBytes);
      if (decodedImage == null) return null;
      
      final resized = img.copyResize(
        decodedImage,
        width: decodedImage.width > 500 ? 500 : decodedImage.width,
        height: decodedImage.height > 500 ? 500 : decodedImage.height,
      );
      
      // Compresser en JPEG avec qualité 85%
      final compressedBytes = img.encodeJpg(resized, quality: 85);
      
      // Générer un nom de fichier unique
      final fileName = '$userId/avatar/${DateTime.now().millisecondsSinceEpoch}_avatar.jpg';
      
      // Supprimer l'ancien avatar s'il existe
      final oldAvatars = await _supabase.storage
          .from('profiles')
          .list(path: '$userId/avatar');
      
      for (final file in oldAvatars) {
        await _supabase.storage
            .from('profiles')
            .remove(['$userId/avatar/${file.name}']);
      }
      
      // Upload le nouveau avatar
      final uploadResponse = await _supabase.storage
          .from('profiles')
          .uploadBinary(
            fileName,
            compressedBytes,
            fileOptions: const FileOptions(
              cacheControl: '3600',
              upsert: true,
            ),
          );
      
      // Récupérer l'URL publique
      final avatarUrl = _supabase.storage
          .from('profiles')
          .getPublicUrl(fileName);
      
      // Mettre à jour l'URL dans le profil
      await _supabase
          .from('profiles')
          .update({'avatar_url': avatarUrl})
          .eq('id', userId);

      final cached = await getCachedUserProfile();
      if (cached != null && cached.id == userId) {
        await _persistProfileCache(cached.copyWith(avatarUrl: avatarUrl));
      }
      
      return avatarUrl;
    } catch (e) {
      print('❌ Erreur lors de l\'upload de l\'avatar: $e');
      return null;
    }
  }

  Future<void> deleteAvatar() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final oldAvatars = await _supabase.storage
          .from('profiles')
          .list(path: '$userId/avatar');

      if (oldAvatars.isNotEmpty) {
        await _supabase.storage.from('profiles').remove(
              oldAvatars.map((f) => '$userId/avatar/${f.name}').toList(),
            );
      }

      await _supabase.from('profiles').update({'avatar_url': null}).eq('id', userId);

      final cached = await getCachedUserProfile();
      if (cached != null && cached.id == userId) {
        await _persistProfileCache(cached.copyWith(avatarUrl: null));
      }
    } catch (e) {
      print('❌ Erreur lors de la suppression de l\'avatar: $e');
    }
  }

  Future<String?> uploadCover(XFile imageFile) async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return null;

      Uint8List imageBytes;
      if (kIsWeb) {
        imageBytes = await imageFile.readAsBytes();
      } else {
        final file = File(imageFile.path);
        imageBytes = await file.readAsBytes();
      }

      final decodedImage = img.decodeImage(imageBytes);
      if (decodedImage == null) return null;

      final resized = img.copyResize(
        decodedImage,
        width: decodedImage.width > 1400 ? 1400 : decodedImage.width,
      );

      final compressedBytes = img.encodeJpg(resized, quality: 85);

      final fileName = '$userId/cover/${DateTime.now().millisecondsSinceEpoch}_cover.jpg';

      final oldCovers = await _supabase.storage.from('profiles').list(path: '$userId/cover');
      for (final file in oldCovers) {
        await _supabase.storage.from('profiles').remove(['$userId/cover/${file.name}']);
      }

      await _supabase.storage.from('profiles').uploadBinary(
            fileName,
            compressedBytes,
            fileOptions: const FileOptions(
              cacheControl: '3600',
              upsert: true,
            ),
          );

      final coverUrl = _supabase.storage.from('profiles').getPublicUrl(fileName);
      await _setCachedCoverUrl(userId, coverUrl);

      if (!await _isFlagEnabled(_coverUrlMissingKey)) {
        try {
          await _supabase.from('profiles').update({'cover_url': coverUrl}).eq('id', userId);
        } catch (e) {
          if (_isMissingColumnOrTableError(e)) {
            await _setFlagEnabled(_coverUrlMissingKey);
          } else {
            rethrow;
          }
        }
      }

      return coverUrl;
    } catch (e) {
      print('❌ Erreur lors de l\'upload de la couverture: $e');
      return null;
    }
  }

  Future<void> deleteCover() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final oldCovers = await _supabase.storage.from('profiles').list(path: '$userId/cover');
      if (oldCovers.isNotEmpty) {
        await _supabase.storage.from('profiles').remove(
              oldCovers.map((f) => '$userId/cover/${f.name}').toList(),
            );
      }

      if (!await _isFlagEnabled(_coverUrlMissingKey)) {
        try {
          await _supabase.from('profiles').update({'cover_url': null}).eq('id', userId);
        } catch (e) {
          if (_isMissingColumnOrTableError(e)) {
            await _setFlagEnabled(_coverUrlMissingKey);
          } else {
            rethrow;
          }
        }
      }

      await _setCachedCoverUrl(userId, null);
    } catch (e) {
      print('❌ Erreur lors de la suppression de la couverture: $e');
    }
  }

  Future<String?> getCoverUrl(String userId) async {
    final cached = await _getCachedCoverUrl(userId);
    if (await _isFlagEnabled(_coverUrlMissingKey)) return cached;
    try {
      final response = await _supabase
          .from('profiles')
          .select('cover_url')
          .eq('id', userId)
          .maybeSingle();
      final url = (response is Map<String, dynamic>) ? response['cover_url'] : null;
      if (url is String && url.trim().isNotEmpty) {
        await _setCachedCoverUrl(userId, url);
        return url;
      }
      return cached;
    } catch (e) {
      if (_isMissingColumnOrTableError(e)) {
        await _setFlagEnabled(_coverUrlMissingKey);
        return cached;
      }
      rethrow;
    }
  }
  
  // Créer un profil initial pour un nouvel utilisateur
  Future<Profile?> createInitialProfile(String userId, String email) async {
    try {
      final profile = Profile(
        id: userId,
        email: email,
        memberSince: DateTime.now(),
        lastUpdated: DateTime.now(),
      );
      
      await _supabase
          .from('profiles')
          .insert(profile.toJson());
      
      return profile;
    } catch (e) {
      print('❌ Erreur lors de la création du profil: $e');
      return null;
    }
  }
  
  // Mettre à jour les points de fidélité
  Future<void> updateLoyaltyPoints(String userId, int pointsToAdd) async {
    try {
      await _supabase.rpc(
        'increment_loyalty_points',
        params: {
          'user_id': userId,
          'points': pointsToAdd,
        },
      );
    } catch (e) {
      print('❌ Erreur lors de la mise à jour des points: $e');
    }
  }
  
  // Récupérer les statistiques du profil
  Future<Map<String, dynamic>> getProfileStats(String userId) async {
    try {
      int orders = 0;
      try {
        final response = await _supabase
            .from('order_details_view')
            .select('id')
            .eq('user_id', userId);
        if (response is List) orders = response.length;
      } catch (_) {
        final response = await _supabase
            .from('orders')
            .select('id')
            .eq('user_id', userId);
        if (response is List) orders = response.length;
      }

      int favorites = 0;
      try {
        final response = await _supabase
            .from('favorites')
            .select('id')
            .eq('user_id', userId);
        if (response is List) favorites = response.length;
      } catch (_) {}

      int reviews = 0;
      if (!await _isFlagEnabled(_reviewsTableMissingKey)) {
        try {
          final response = await _supabase
              .from('reviews')
              .select('id')
              .eq('user_id', userId);
          if (response is List) reviews = response.length;
        } catch (e) {
          if (_isMissingColumnOrTableError(e)) {
            await _setFlagEnabled(_reviewsTableMissingKey);
          }
        }
      }

      return {
        'orders': orders,
        'favorites': favorites,
        'reviews': reviews,
      };
    } catch (e) {
      print('❌ Erreur lors de la récupération des stats: $e');
      return {
        'orders': 0,
        'favorites': 0,
        'reviews': 0,
      };
    }
  }
}
