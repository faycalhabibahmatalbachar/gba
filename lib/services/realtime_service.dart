import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RealtimeService {
  final _supabase = Supabase.instance.client;
  
  // Écouter les changements du panier en temps réel
  void subscribeToCart(String userId, Function() onUpdate) {
    _supabase
        .from('cart_items')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .listen((List<Map<String, dynamic>> data) {
          print('🔄 Mise à jour panier temps réel: ${data.length} articles');
          onUpdate();
        });
  }
  
  // Écouter les changements des favoris en temps réel
  void subscribeToFavorites(String userId, Function() onUpdate) {
    _supabase
        .from('favorites')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .listen((List<Map<String, dynamic>> data) {
          print('🔄 Mise à jour favoris temps réel: ${data.length} articles');
          onUpdate();
        });
  }
  
  // Écouter les changements du profil en temps réel
  void subscribeToProfile(String userId, Function() onUpdate) {
    _supabase
        .from('profiles')
        .stream(primaryKey: ['id'])
        .eq('id', userId)
        .listen((List<Map<String, dynamic>> data) {
          print('🔄 Mise à jour profil temps réel');
          onUpdate();
        });
  }
  
  // Écouter les changements des produits en temps réel
  void subscribeToProducts(Function() onUpdate) {
    _supabase
        .from('products')
        .stream(primaryKey: ['id'])
        .listen((List<Map<String, dynamic>> data) {
          print('🔄 Mise à jour produits temps réel: ${data.length} produits');
          onUpdate();
        });
  }
  
  // Démarrer toutes les souscriptions
  void startAllSubscriptions(String userId, {
    Function()? onCartUpdate,
    Function()? onFavoritesUpdate,
    Function()? onProfileUpdate,
    Function()? onProductsUpdate,
  }) {
    if (onCartUpdate != null) {
      subscribeToCart(userId, onCartUpdate);
    }
    
    if (onFavoritesUpdate != null) {
      subscribeToFavorites(userId, onFavoritesUpdate);
    }
    
    if (onProfileUpdate != null) {
      subscribeToProfile(userId, onProfileUpdate);
    }
    
    if (onProductsUpdate != null) {
      subscribeToProducts(onProductsUpdate);
    }
    
    print('✅ Souscriptions temps réel activées');
  }
  
  // Arrêter toutes les souscriptions
  void stopAllSubscriptions() {
    _supabase.removeAllChannels();
    print('🛑 Souscriptions temps réel arrêtées');
  }
}

// Provider pour le service temps réel
final realtimeServiceProvider = Provider((ref) => RealtimeService());

// Provider pour gérer les souscriptions
final realtimeSubscriptionsProvider = Provider((ref) {
  final service = ref.watch(realtimeServiceProvider);
  final userId = Supabase.instance.client.auth.currentUser?.id;
  
  if (userId != null) {
    service.startAllSubscriptions(
      userId,
      onCartUpdate: () {
        // Rafraîchir le panier
        ref.invalidate(cartProvider);
      },
      onFavoritesUpdate: () {
        // Rafraîchir les favoris
        ref.invalidate(favoritesProvider);
      },
      onProfileUpdate: () {
        // Rafraîchir le profil
        ref.invalidate(profileProvider);
      },
      onProductsUpdate: () {
        // Rafraîchir les produits
        ref.invalidate(productsProvider);
      },
    );
  }
  
  ref.onDispose(() {
    service.stopAllSubscriptions();
  });
  
  return service;
});
