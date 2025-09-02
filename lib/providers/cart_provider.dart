import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/cart_service.dart';

class CartNotifier extends StateNotifier<List<CartItem>> {
  final CartService _cartService = CartService();
  
  CartNotifier() : super([]) {
    loadCart();
  }

  Future<void> loadCart() async {
    try {
      final items = await _cartService.getCartItems();
      state = items.map((item) {
        final productData = item['products'] as Map<String, dynamic>;
        return CartItem(
          id: item['id'] as String,
          userId: item['user_id'] as String,
          productId: item['product_id'] as String,
          quantity: item['quantity'] as int,
          product: Product.fromJson(productData),
          createdAt: item['created_at'] != null 
              ? DateTime.parse(item['created_at']) 
              : null,
          updatedAt: item['updated_at'] != null 
              ? DateTime.parse(item['updated_at']) 
              : null,
        );
      }).toList();
    } catch (e) {
      print('Erreur chargement panier: $e');
    }
  }

  Future<void> addItem(Product product, int quantity) async {
    try {
      await _cartService.addToCart(product.id, quantity);
      await loadCart();
    } catch (e) {
      throw Exception('Erreur ajout au panier: $e');
    }
  }

  Future<void> removeItem(String cartItemId) async {
    try {
      await _cartService.removeFromCart(cartItemId);
      await loadCart();
    } catch (e) {
      throw Exception('Erreur suppression: $e');
    }
  }

  Future<void> updateQuantity(String cartItemId, int quantity) async {
    try {
      await _cartService.updateQuantity(cartItemId, quantity);
      await loadCart();
    } catch (e) {
      throw Exception('Erreur mise à jour: $e');
    }
  }

  Future<void> clearCart() async {
    try {
      await _cartService.clearCart();
      state = [];
    } catch (e) {
      throw Exception('Erreur vidage panier: $e');
    }
  }

  double get totalAmount {
    return state.fold(0, (total, item) {
      if (item.product != null) {
        return total + (item.product!.price * item.quantity);
      }
      return total;
    });
  }

  int get totalItems {
    return state.fold(0, (total, item) => total + item.quantity);
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, List<CartItem>>((ref) {
  return CartNotifier();
});

// Provider pour le nombre d'articles dans le panier
final cartItemCountProvider = Provider<int>((ref) {
  final cart = ref.watch(cartProvider);
  return cart.fold(0, (total, item) => total + item.quantity);
});

// Provider pour le total du panier
final cartTotalProvider = Provider<double>((ref) {
  final cart = ref.watch(cartProvider);
  return cart.fold(0, (total, item) {
    if (item.product != null) {
      return total + (item.product!.price * item.quantity);
    }
    return total;
  });
});
