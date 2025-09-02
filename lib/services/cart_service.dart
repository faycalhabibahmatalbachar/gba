import 'package:supabase_flutter/supabase_flutter.dart';

class CartService {
  final _supabase = Supabase.instance.client;

  // Ajouter au panier
  Future<void> addToCart(String productId, int quantity) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Utilisateur non connecté');

    try {
      // Vérifier si le produit est déjà dans le panier
      final existing = await _supabase
          .from('cart_items')
          .select()
          .eq('user_id', userId)
          .eq('product_id', productId)
          .maybeSingle();

      if (existing != null) {
        // Mettre à jour la quantité
        await _supabase
            .from('cart_items')
            .update({'quantity': existing['quantity'] + quantity})
            .eq('id', existing['id']);
      } else {
        // Ajouter nouveau produit
        await _supabase.from('cart_items').insert({
          'user_id': userId,
          'product_id': productId,
          'quantity': quantity,
        });
      }
    } catch (e) {
      throw Exception('Erreur ajout panier: $e');
    }
  }

  // Obtenir les articles du panier
  Future<List<Map<String, dynamic>>> getCartItems() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    try {
      final response = await _supabase
          .from('cart_items')
          .select('*, products(*)')
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      print('Erreur récupération panier: $e');
      return [];
    }
  }

  // Mettre à jour la quantité
  Future<void> updateQuantity(String cartItemId, int quantity) async {
    try {
      if (quantity <= 0) {
        await removeFromCart(cartItemId);
      } else {
        await _supabase
            .from('cart_items')
            .update({'quantity': quantity})
            .eq('id', cartItemId);
      }
    } catch (e) {
      throw Exception('Erreur mise à jour quantité: $e');
    }
  }

  // Supprimer du panier
  Future<void> removeFromCart(String cartItemId) async {
    try {
      await _supabase
          .from('cart_items')
          .delete()
          .eq('id', cartItemId);
    } catch (e) {
      throw Exception('Erreur suppression panier: $e');
    }
  }

  // Vider le panier
  Future<void> clearCart() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    try {
      await _supabase
          .from('cart_items')
          .delete()
          .eq('user_id', userId);
    } catch (e) {
      throw Exception('Erreur vidage panier: $e');
    }
  }

  // Obtenir le nombre d'articles
  Future<int> getCartItemCount() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return 0;

    try {
      final response = await _supabase
          .from('cart_items')
          .select('quantity')
          .eq('user_id', userId);

      int total = 0;
      for (var item in response) {
        total += (item['quantity'] as int);
      }
      return total;
    } catch (e) {
      print('Erreur comptage panier: $e');
      return 0;
    }
  }

  // Calculer le total
  Future<double> getCartTotal() async {
    final items = await getCartItems();
    double total = 0;
    
    for (var item in items) {
      if (item['products'] != null) {
        final price = item['products']['price'] ?? 0;
        final quantity = item['quantity'] ?? 0;
        total += price * quantity;
      }
    }
    
    return total;
  }
}
