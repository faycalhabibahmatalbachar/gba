import 'package:supabase_flutter/supabase_flutter.dart';

class FavoritesService {
  final _supabase = Supabase.instance.client;

  // Ajouter aux favoris
  Future<void> addToFavorites(String productId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Utilisateur non connecté');

    try {
      await _supabase.from('favorites').insert({
        'user_id': userId,
        'product_id': productId,
      });
    } catch (e) {
      if (e.toString().contains('duplicate')) {
        // Déjà en favoris
        return;
      }
      throw Exception('Erreur ajout favoris: $e');
    }
  }

  // Retirer des favoris
  Future<void> removeFromFavorites(String productId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Utilisateur non connecté');

    try {
      await _supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId);
    } catch (e) {
      throw Exception('Erreur suppression favoris: $e');
    }
  }

  // Vérifier si un produit est en favoris
  Future<bool> isFavorite(String productId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      final response = await _supabase
          .from('favorites')
          .select('id')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .maybeSingle();
      
      return response != null;
    } catch (e) {
      print('Erreur vérification favoris: $e');
      return false;
    }
  }

  // Obtenir tous les favoris
  Future<List<Map<String, dynamic>>> getFavorites() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    try {
      // D'abord récupérer les favoris
      final favoritesResponse = await _supabase
          .from('favorites')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', ascending: false);
      
      if (favoritesResponse.isEmpty) return [];
      
      // Extraire les product_ids
      final productIds = favoritesResponse
          .map((f) => f['product_id'] as String)
          .toList();
      
      // Récupérer les produits séparément
      final productsResponse = await _supabase
          .from('products')
          .select('*')
          .inFilter('id', productIds);
      
      // Créer une map pour accès rapide aux produits
      final productsMap = Map<String, dynamic>.fromIterable(
        productsResponse,
        key: (p) => p['id'],
        value: (p) => p,
      );
      
      // Combiner les données
      return favoritesResponse.map((favorite) {
        final productId = favorite['product_id'];
        return {
          ...favorite,
          'products': productsMap[productId],
        };
      }).toList();
    } catch (e) {
      print('Erreur récupération favoris: $e');
      return [];
    }
  }

  // Obtenir le nombre de favoris
  Future<int> getFavoritesCount() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return 0;

    try {
      final response = await _supabase
          .from('favorites')
          .select('id')
          .eq('user_id', userId);
      
      return response.length;
    } catch (e) {
      print('Erreur comptage favoris: $e');
      return 0;
    }
  }

  // Basculer le statut favori
  Future<bool> toggleFavorite(String productId) async {
    final isFav = await isFavorite(productId);
    
    if (isFav) {
      await removeFromFavorites(productId);
      return false;
    } else {
      await addToFavorites(productId);
      return true;
    }
  }

  // Vider tous les favoris
  Future<void> clearFavorites() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    try {
      await _supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId);
    } catch (e) {
      throw Exception('Erreur vidage favoris: $e');
    }
  }
}
