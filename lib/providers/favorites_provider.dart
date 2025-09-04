import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/product.dart';
import '../services/favorites_service.dart';

class FavoritesNotifier extends StateNotifier<List<Product>> {
  final FavoritesService _service = FavoritesService();
  
  FavoritesNotifier() : super([]) {
    loadFavorites();
  }

  Future<void> loadFavorites() async {
    try {
      final favorites = await _service.getFavorites();
      state = favorites.map((item) {
        final productData = item['products'] as Map<String, dynamic>;
        return Product.fromJson(productData);
      }).toList();
    } catch (e) {
      print('❌ Erreur chargement favoris: $e');
    }
  }

  Future<void> toggleFavorite(String productId) async {
    try {
      final wasFavorite = state.any((p) => p.id == productId);
      
      // Mise à jour optimiste de l'UI
      if (wasFavorite) {
        state = state.where((p) => p.id != productId).toList();
      }
      
      // Synchroniser avec Supabase
      await _service.toggleFavorite(productId);
      
      // Recharger pour s'assurer de la synchronisation
      await loadFavorites();
    } catch (e) {
      print('❌ Erreur toggle favori: $e');
      // Recharger en cas d'erreur pour restaurer l'état correct
      await loadFavorites();
    }
  }

  bool isFavorite(Product product) {
    return state.any((p) => p.id == product.id);
  }

  Future<void> clearFavorites() async {
    try {
      await _service.clearFavorites();
      state = [];
    } catch (e) {
      print('❌ Erreur vidage favoris: $e');
    }
  }
}

final favoritesProvider = StateNotifierProvider<FavoritesNotifier, List<Product>>((ref) {
  return FavoritesNotifier();
});

// Provider pour le nombre de favoris
final favoritesCountProvider = Provider<int>((ref) {
  final favorites = ref.watch(favoritesProvider);
  return favorites.length;
});
