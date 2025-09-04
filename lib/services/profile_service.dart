import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import '../models/profile.dart';

class ProfileService {
  final _supabase = Supabase.instance.client;
  
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
      
      return Profile.fromJson(response);
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
      final fileName = '${userId}/${DateTime.now().millisecondsSinceEpoch}_avatar.jpg';
      
      // Supprimer l'ancien avatar s'il existe
      final oldAvatars = await _supabase.storage
          .from('profiles')
          .list(path: userId);
      
      for (final file in oldAvatars) {
        await _supabase.storage
            .from('profiles')
            .remove(['$userId/${file.name}']);
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
      
      return avatarUrl;
    } catch (e) {
      print('❌ Erreur lors de l\'upload de l\'avatar: $e');
      return null;
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
      final ordersCount = await _supabase
          .from('orders')
          .select('id')
          .eq('user_id', userId)
          .count();
      
      final favoriteCount = await _supabase
          .from('favorites')
          .select('id')
          .eq('user_id', userId)
          .count();
      
      return {
        'orders': ordersCount.count ?? 0,
        'favorites': favoriteCount.count ?? 0,
        'reviews': 0, // À implémenter
        'member_days': DateTime.now().difference(
          DateTime.now().subtract(const Duration(days: 365))
        ).inDays,
      };
    } catch (e) {
      print('❌ Erreur lors de la récupération des stats: $e');
      return {
        'orders': 0,
        'favorites': 0,
        'reviews': 0,
        'member_days': 0,
      };
    }
  }
}
